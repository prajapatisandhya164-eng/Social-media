import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  User as FirebaseUser,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  OperationType,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  uploadMediaWithFallback,
} from '../lib/firebase';
import {
  AppTab,
  Conversation,
  DirectMessage,
  FeedFilter,
  MessageStatus,
  NotificationItem,
  Post,
  PostComment,
  UserPublicProfile,
} from '../types/social';
import { extractHashtags, sanitizeLocalText } from '../utils/validation';

export interface SocialContextValue {
  authReady: boolean;
  firebaseConfigured: boolean;
  needsOnboarding: boolean;
  onboardingDefaults: { displayName: string; username: string };
  signedInEmail: string | null;
  currentUser: UserPublicProfile | null;
  authError: string | null;
  isSigningIn: boolean;

  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  viewedProfileId: string | null;
  openProfile: (uid: string) => void;
  activeConversationId: string | null;
  openConversation: (conversationId: string) => void;
  discoverQuery: string;
  setDiscoverQuery: (q: string) => void;
  openHashtag: (tag: string) => void;
  highlightedPostId: string | null;
  setHighlightedPostId: (id: string | null) => void;

  feedFilter: FeedFilter;
  setFeedFilter: (filter: FeedFilter) => void;
  posts: Post[];
  postsLoading: boolean;
  hasMorePosts: boolean;
  loadMorePosts: () => Promise<void>;
  likedPostIds: Set<string>;
  commentsByPost: Record<string, PostComment[]>;
  loadCommentsForPost: (postId: string) => () => void;

  allUsers: UserPublicProfile[];
  followingIds: Set<string>;
  followerIds: Set<string>;

  conversations: Conversation[];
  messagesByConversation: Record<string, DirectMessage[]>;
  notifications: NotificationItem[];
  unreadMessagesCount: number;
  unreadNotificationsCount: number;

  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  completeOnboarding: (data: { displayName: string; username: string; bio: string }) => Promise<void>;
  updateUserProfile: (data: {
    displayName: string;
    username: string;
    bio: string;
    photoURL?: string;
  }) => Promise<void>;

  createPost: (data: { content: string; imageURL?: string }) => Promise<void>;
  toggleLikePost: (postId: string) => Promise<void>;
  addComment: (postId: string, content: string) => Promise<void>;
  sharePost: (postId: string) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;

  toggleFollowUser: (targetUid: string) => Promise<void>;
  startOrOpenDirectChat: (targetUser: UserPublicProfile) => Promise<string>;
  sendMessage: (
    conversationId: string,
    payload: { text: string; imageURL?: string }
  ) => Promise<void>;
  retryMessage: (conversationId: string, messageId: string) => Promise<void>;
  markConversationRead: (conversationId: string) => Promise<void>;

  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  getFollowersList: (uid: string) => Promise<UserPublicProfile[]>;
  getFollowingList: (uid: string) => Promise<UserPublicProfile[]>;
}

const SocialContext = createContext<SocialContextValue | null>(null);

const CACHE_POSTS_KEY = 'connectly_cached_posts';
const CACHE_CONVS_KEY = 'connectly_cached_conversations';

function toMillis(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === 'number') return value;
  if (value && typeof (value as { toMillis?: () => number }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function mapUserDoc(data: Record<string, unknown>, id: string): UserPublicProfile {
  return {
    uid: String(data.uid || id),
    username: String(data.username || 'member'),
    displayName: String(data.displayName || 'CONNECTLY User'),
    bio: String(data.bio || ''),
    photoURL: String(data.photoURL || ''),
    followersCount: Number(data.followersCount || 0),
    followingCount: Number(data.followingCount || 0),
    postsCount: Number(data.postsCount || 0),
    isOnline: Boolean(data.isOnline),
    lastSeenAt: toMillis(data.lastSeenAt),
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
  };
}

function mapPostDoc(data: Record<string, unknown>, id: string): Post {
  return {
    id,
    authorId: String(data.authorId || ''),
    authorName: String(data.authorName || 'Member'),
    authorUsername: String(data.authorUsername || 'member'),
    authorPhotoURL: String(data.authorPhotoURL || ''),
    content: String(data.content || ''),
    imageURL: typeof data.imageURL === 'string' && data.imageURL ? data.imageURL : undefined,
    hashtags: Array.isArray(data.hashtags) ? data.hashtags.map(String) : [],
    likesCount: Number(data.likesCount || 0),
    commentsCount: Number(data.commentsCount || 0),
    sharesCount: Number(data.sharesCount || 0),
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
  };
}

function mapConversationDoc(data: Record<string, unknown>, id: string): Conversation {
  const uidA = String(data.participantAId || '');
  const uidB = String(data.participantBId || '');
  return {
    id,
    participantIds: Array.isArray(data.participantIds)
      ? data.participantIds.map(String)
      : [uidA, uidB],
    participants: {
      [uidA]: {
        uid: uidA,
        displayName: String(data.participantAName || 'Member'),
        username: String(data.participantAUsername || 'member'),
        photoURL: String(data.participantAPhotoURL || ''),
      },
      [uidB]: {
        uid: uidB,
        displayName: String(data.participantBName || 'Member'),
        username: String(data.participantBUsername || 'member'),
        photoURL: String(data.participantBPhotoURL || ''),
      },
    },
    lastMessageText: String(data.lastMessageText || ''),
    lastMessageSenderId: String(data.lastMessageSenderId || ''),
    lastMessageAt: toMillis(data.lastMessageAt),
    unreadCounts: {
      [uidA]: Number(data.unreadA || 0),
      [uidB]: Number(data.unreadB || 0),
    },
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
  };
}

export function SocialProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserPublicProfile | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const [activeTab, setActiveTab] = useState<AppTab>('feed');
  const [viewedProfileId, setViewedProfileId] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [discoverQuery, setDiscoverQuery] = useState('');
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('for-you');

  const [postLimit, setPostLimit] = useState(15);
  const [posts, setPosts] = useState<Post[]>(() => {
    try {
      const cached = localStorage.getItem(CACHE_POSTS_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [postsLoading, setPostsLoading] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [commentsByPost, setCommentsByPost] = useState<Record<string, PostComment[]>>({});

  const [allUsers, setAllUsers] = useState<UserPublicProfile[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [followerIds, setFollowerIds] = useState<Set<string>>(new Set());

  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      const cached = localStorage.getItem(CACHE_CONVS_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [serverMessagesByConv, setServerMessagesByConv] = useState<
    Record<string, DirectMessage[]>
  >({});
  const [pendingMessagesByConv, setPendingMessagesByConv] = useState<
    Record<string, DirectMessage[]>
  >({});
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const profileUnsubRef = useRef<(() => void) | null>(null);

  // Merge live Firestore messages with optimistic/failed local messages
  const messagesByConversation = useMemo(() => {
    const merged: Record<string, DirectMessage[]> = { ...serverMessagesByConv };
    for (const [convId, pendingList] of Object.entries(pendingMessagesByConv)) {
      const existing = merged[convId] || [];
      const existingIds = new Set(existing.map((m) => m.id));
      const remaining = pendingList.filter((m) => !existingIds.has(m.id));
      merged[convId] = [...existing, ...remaining].sort((a, b) => a.createdAt - b.createdAt);
    }
    return merged;
  }, [serverMessagesByConv, pendingMessagesByConv]);

  const attachProfileListener = useCallback((uid: string) => {
    if (profileUnsubRef.current) {
      profileUnsubRef.current();
      profileUnsubRef.current = null;
    }

    const userPath = `users/${uid}`;
    profileUnsubRef.current = onSnapshot(
      doc(db, 'users', uid),
      (docSnap) => {
        if (docSnap.exists()) {
          setCurrentUser(mapUserDoc(docSnap.data(), docSnap.id));
          setNeedsOnboarding(false);
        } else {
          setCurrentUser(null);
          setNeedsOnboarding(true);
        }
        setAuthError(null);
        setAuthReady(true);
      },
      (error) => {
        console.error('[CONNECTLY Auth] Profile listener error:', error);
        setAuthError(
          `Signed in, but could not load profile (${error instanceof Error ? error.message : 'Firestore error'}).`
        );
        setAuthReady(true);
      }
    );
  }, []);

  const syncSignedInUser = useCallback(
    async (user: FirebaseUser | null) => {
      if (profileUnsubRef.current) {
        profileUnsubRef.current();
        profileUnsubRef.current = null;
      }

      setFirebaseUser(user);
      setAuthError(null);

      if (!user) {
        setCurrentUser(null);
        setNeedsOnboarding(false);
        setAuthReady(true);
        return;
      }

      try {
        attachProfileListener(user.uid);
      } catch (error) {
        console.error('[CONNECTLY Auth] Failed attaching profile listener:', error);
        setAuthError(
          error instanceof Error ? error.message : 'Unable to load user profile.'
        );
        setAuthReady(true);
      }
    },
    [attachProfileListener]
  );

  // 1. Firebase Auth Session Listener + Redirect Result Check
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          void syncSignedInUser(result.user);
        }
      })
      .catch((error) => {
        console.error('[CONNECTLY Auth] Redirect result error:', error);
        setAuthError(error instanceof Error ? error.message : 'Google Sign-In failed.');
      });

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      void syncSignedInUser(user);
    });

    return () => {
      unsubscribeAuth();
      if (profileUnsubRef.current) {
        profileUnsubRef.current();
        profileUnsubRef.current = null;
      }
    };
  }, [syncSignedInUser]);

  // 2. Online Presence Sync
  useEffect(() => {
    if (!currentUser?.uid) return;
    const uid = currentUser.uid;
    const userRef = doc(db, 'users', uid);

    const setPresence = async (online: boolean) => {
      if (!auth.currentUser) return;
      try {
        await updateDoc(userRef, {
          isOnline: online,
          lastSeenAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Ignore transient offline presence update failures
      }
    };

    setPresence(true);

    const handleVisibility = () => {
      setPresence(!document.hidden);
    };
    const handleUnload = () => {
      setPresence(false);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [currentUser?.uid]);

  // 3. Real-Time Collections (ONLY when authenticated + onboarded)
  useEffect(() => {
    if (!authReady || !firebaseUser || !currentUser) return;
    const uid = currentUser.uid;

    // Users list
    const usersQuery = query(
      collection(db, 'users'),
      where('followersCount', '>=', 0),
      orderBy('followersCount', 'desc'),
      limit(100)
    );
    const unsubUsers = onSnapshot(
      usersQuery,
      (snap) => {
        setAllUsers(snap.docs.map((d) => mapUserDoc(d.data(), d.id)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'users')
    );

    // Following & Followers
    const followingQuery = query(
      collection(db, 'users', uid, 'following'),
      where('followerId', '==', uid)
    );
    const unsubFollowing = onSnapshot(
      followingQuery,
      (snap) => {
        setFollowingIds(new Set(snap.docs.map((d) => d.id)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `users/${uid}/following`)
    );

    const followersQuery = query(
      collection(db, 'users', uid, 'followers'),
      where('followingId', '==', uid)
    );
    const unsubFollowers = onSnapshot(
      followersQuery,
      (snap) => {
        setFollowerIds(new Set(snap.docs.map((d) => d.id)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `users/${uid}/followers`)
    );

    // Conversations
    const convsQuery = query(
      collection(db, 'conversations'),
      where('participantIds', 'array-contains', uid)
    );
    const unsubConvs = onSnapshot(
      convsQuery,
      (snap) => {
        const list = snap.docs
          .map((d) => mapConversationDoc(d.data(), d.id))
          .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
        setConversations(list);
        try {
          localStorage.setItem(CACHE_CONVS_KEY, JSON.stringify(list.slice(0, 20)));
        } catch {
          // ignore cache error
        }
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'conversations')
    );

    // Notifications
    const notifQuery = query(
      collection(db, 'notifications'),
      where('recipientId', '==', uid)
    );
    const unsubNotifs = onSnapshot(
      notifQuery,
      (snap) => {
        const list: NotificationItem[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              recipientId: String(data.recipientId || ''),
              actorId: String(data.actorId || ''),
              actorName: String(data.actorName || 'Member'),
              actorUsername: String(data.actorUsername || 'member'),
              actorPhotoURL: String(data.actorPhotoURL || ''),
              type: (data.type as NotificationItem['type']) || 'like',
              postId: typeof data.postId === 'string' ? data.postId : undefined,
              conversationId:
                typeof data.conversationId === 'string' ? data.conversationId : undefined,
              previewText: String(data.previewText || ''),
              read: Boolean(data.read),
              createdAt: toMillis(data.createdAt),
            };
          })
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 60);
        setNotifications(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'notifications')
    );

    return () => {
      unsubUsers();
      unsubFollowing();
      unsubFollowers();
      unsubConvs();
      unsubNotifs();
    };
  }, [authReady, firebaseUser, currentUser?.uid]);

  // 4. Posts Live Feed with Pagination
  useEffect(() => {
    if (!authReady || !firebaseUser || !currentUser) return;
    setPostsLoading(true);
    const postsQuery = query(
      collection(db, 'posts'),
      where('createdAt', '>=', Timestamp.fromMillis(0)),
      orderBy('createdAt', 'desc'),
      limit(postLimit)
    );

    const unsubPosts = onSnapshot(
      postsQuery,
      async (snap) => {
        const mapped = snap.docs.map((d) => mapPostDoc(d.data(), d.id));
        setPosts(mapped);
        setHasMorePosts(snap.docs.length >= postLimit);
        setPostsLoading(false);

        try {
          localStorage.setItem(CACHE_POSTS_KEY, JSON.stringify(mapped.slice(0, 15)));
        } catch {
          // ignore storage quota errors
        }

        // Check liked status for loaded posts
        if (mapped.length > 0 && auth.currentUser) {
          const uid = auth.currentUser.uid;
          const likeChecks = await Promise.all(
            mapped.map(async (p) => {
              try {
                const likeSnap = await getDoc(doc(db, 'posts', p.id, 'likes', uid));
                return likeSnap.exists() ? p.id : null;
              } catch {
                return null;
              }
            })
          );
          setLikedPostIds(new Set(likeChecks.filter((id): id is string => Boolean(id))));
        }
      },
      (error) => {
        setPostsLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'posts');
      }
    );

    return () => unsubPosts();
  }, [authReady, firebaseUser, currentUser?.uid, postLimit]);

  // 5. Active Conversation Messages Listener + Read Receipts
  useEffect(() => {
    if (!authReady || !firebaseUser || !currentUser || !activeConversationId) return;
    const convPath = `conversations/${activeConversationId}/messages`;
    const msgQuery = query(
      collection(db, 'conversations', activeConversationId, 'messages'),
      where('conversationId', '==', activeConversationId)
    );

    const unsubMsgs = onSnapshot(
      msgQuery,
      async (snap) => {
        const list: DirectMessage[] = snap.docs
          .map((d) => {
            const data = d.data();
            const readBy = Array.isArray(data.readBy) ? data.readBy.map(String) : [];
            const senderId = String(data.senderId || '');
            const otherRead = readBy.some((id) => id !== senderId);
            return {
              id: d.id,
              conversationId: String(data.conversationId || activeConversationId),
              senderId,
              text: String(data.text || ''),
              imageURL:
                typeof data.imageURL === 'string' && data.imageURL
                  ? data.imageURL
                  : undefined,
              status: (otherRead ? 'read' : 'sent') as MessageStatus,
              readBy,
              createdAt: toMillis(data.createdAt),
            };
          })
          .sort((a, b) => a.createdAt - b.createdAt);

        setServerMessagesByConv((prev) => ({ ...prev, [activeConversationId]: list }));

        // Mark unread incoming messages as read
        const uid = currentUser.uid;
        const unreadIncoming = list.filter(
          (m) => m.senderId !== uid && !m.readBy.includes(uid)
        );
        if (unreadIncoming.length > 0 && navigator.onLine) {
          const batch = writeBatch(db);
          for (const msg of unreadIncoming.slice(0, 20)) {
            batch.update(
              doc(db, 'conversations', activeConversationId, 'messages', msg.id),
              { readBy: Array.from(new Set([...msg.readBy, uid])).slice(0, 2) }
            );
          }
          try {
            await batch.commit();
          } catch {
            // ignore transient read-receipt conflict
          }
        }
      },
      (error) => handleFirestoreError(error, OperationType.LIST, convPath)
    );

    return () => unsubMsgs();
  }, [authReady, firebaseUser, currentUser?.uid, activeConversationId]);

  const onboardingDefaults = useMemo(() => {
    const rawName = firebaseUser?.displayName || '';
    const emailPrefix = firebaseUser?.email?.split('@')[0] || 'member';
    const cleanHandle = emailPrefix
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 24);
    return {
      displayName: rawName.slice(0, 50),
      username: cleanHandle.length >= 3 ? cleanHandle : `${cleanHandle}123`,
    };
  }, [firebaseUser?.displayName, firebaseUser?.email]);

  const openProfile = useCallback((uid: string) => {
    setViewedProfileId(uid);
    setActiveTab('profile');
  }, []);

  const openConversation = useCallback((conversationId: string) => {
    setActiveConversationId(conversationId || null);
    setActiveTab('messages');
  }, []);

  const openHashtag = useCallback((tag: string) => {
    setDiscoverQuery(`#${tag.replace(/^#/, '')}`);
    setActiveTab('discover');
  }, []);

  const signInWithGoogle = async () => {
    setAuthError(null);
    setIsSigningIn(true);
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      if (credential?.user) {
        await syncSignedInUser(credential.user);
      }
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code || '';
      const rawMsg = error instanceof Error ? error.message : 'Google Sign-In failed.';
      console.error('[CONNECTLY Auth] signInWithPopup failed:', code, rawMsg);

      if (code === 'auth/popup-closed-by-user') {
        setAuthError(
          'Google sign-in popup closed before finishing. If clicking your email closed the popup without signing in, your browser may be blocking cross-origin popup storage inside this preview frame — try opening CONNECTLY in a full browser tab.'
        );
      } else if (code === 'auth/popup-blocked') {
        setAuthError(
          'Your browser blocked the Google sign-in popup. Allow popups for this site or open CONNECTLY in a new browser tab.'
        );
      } else if (code === 'auth/unauthorized-domain') {
        setAuthError(
          `Domain "${window.location.hostname}" is not authorized in Firebase Authentication. Add it under Firebase Console → Authentication → Settings → Authorized domains.`
        );
      } else if (code === 'auth/operation-not-supported-in-this-environment') {
        setAuthError(
          'Popup sign-in is not supported in this embedded frame. Please open CONNECTLY in a full browser tab.'
        );
      } else if (code === 'auth/cancelled-popup-request') {
        setAuthError(null);
      } else {
        setAuthError(code ? `${code}: ${rawMsg}` : rawMsg);
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const signOut = async () => {
    if (currentUser?.uid) {
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
          isOnline: false,
          lastSeenAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch {
        // ignore sign-out presence error
      }
    }
    await firebaseSignOut(auth);
    setCurrentUser(null);
    setNeedsOnboarding(false);
    setActiveConversationId(null);
    setActiveTab('feed');
  };

  const completeOnboarding = async (data: {
    displayName: string;
    username: string;
    bio: string;
  }) => {
    if (!firebaseUser) throw new Error('You must sign in with Google first.');
    const uid = firebaseUser.uid;
    const username = data.username.toLowerCase().trim();
    const displayName = sanitizeLocalText(data.displayName, 50);
    const bio = sanitizeLocalText(data.bio, 240);
    const photoURL = (firebaseUser.photoURL || '').slice(0, 200000);
    const email = (firebaseUser.email || '').slice(0, 254);

    // Check username availability
    const usernameRef = doc(db, 'usernames', username);
    const existingHandle = await getDoc(usernameRef);
    if (existingHandle.exists() && existingHandle.data()?.uid !== uid) {
      throw new Error(`@${username} is already taken. Try another username.`);
    }

    const batch = writeBatch(db);
    batch.set(doc(db, 'users', uid), {
      uid,
      username,
      displayName,
      bio,
      photoURL,
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      isOnline: true,
      lastSeenAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'users', uid, 'private', 'info'), {
      uid,
      email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(usernameRef, {
      uid,
      createdAt: serverTimestamp(),
    });

    try {
      await batch.commit();
      const now = Date.now();
      setCurrentUser({
        uid,
        username,
        displayName,
        bio,
        photoURL,
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        isOnline: true,
        lastSeenAt: now,
        createdAt: now,
        updatedAt: now,
      });
      setNeedsOnboarding(false);
      attachProfileListener(uid);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
    }
  };

  const updateUserProfile = async (data: {
    displayName: string;
    username: string;
    bio: string;
    photoURL?: string;
  }) => {
    if (!currentUser) throw new Error('Not signed in.');
    const uid = currentUser.uid;
    const newUsername = data.username.toLowerCase().trim();
    const oldUsername = currentUser.username;

    let finalPhoto = currentUser.photoURL;
    if (data.photoURL && data.photoURL !== currentUser.photoURL) {
      finalPhoto = data.photoURL.startsWith('data:')
        ? await uploadMediaWithFallback(`avatars/${uid}/${Date.now()}.webp`, data.photoURL)
        : data.photoURL;
    }

    const batch = writeBatch(db);
    if (newUsername !== oldUsername) {
      const nextHandleSnap = await getDoc(doc(db, 'usernames', newUsername));
      if (nextHandleSnap.exists() && nextHandleSnap.data()?.uid !== uid) {
        throw new Error(`@${newUsername} is already taken.`);
      }
      batch.delete(doc(db, 'usernames', oldUsername));
      batch.set(doc(db, 'usernames', newUsername), {
        uid,
        createdAt: serverTimestamp(),
      });
    }

    batch.update(doc(db, 'users', uid), {
      displayName: sanitizeLocalText(data.displayName, 50),
      username: newUsername,
      bio: sanitizeLocalText(data.bio, 240),
      photoURL: finalPhoto.slice(0, 200000),
      updatedAt: serverTimestamp(),
    });

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const createPost = async (data: { content: string; imageURL?: string }) => {
    if (!currentUser) throw new Error('Sign in to publish posts.');
    const postId = generateId('post');
    const cleanContent = sanitizeLocalText(data.content, 1000);
    const hashtags = extractHashtags(cleanContent);

    let finalImageUrl: string | undefined;
    if (data.imageURL) {
      finalImageUrl = await uploadMediaWithFallback(
        `posts/${currentUser.uid}/${postId}.webp`,
        data.imageURL
      );
    }

    const postDoc: Record<string, unknown> = {
      authorId: currentUser.uid,
      authorName: currentUser.displayName,
      authorUsername: currentUser.username,
      authorPhotoURL: currentUser.photoURL,
      content: cleanContent,
      hashtags,
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (finalImageUrl) {
      postDoc.imageURL = finalImageUrl.slice(0, 250000);
    }

    const batch = writeBatch(db);
    batch.set(doc(db, 'posts', postId), postDoc);
    batch.update(doc(db, 'users', currentUser.uid), {
      postsCount: increment(1),
      updatedAt: serverTimestamp(),
    });

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `posts/${postId}`);
    }
  };

  const toggleLikePost = async (postId: string) => {
    if (!currentUser) return;
    const uid = currentUser.uid;
    const targetPost = posts.find((p) => p.id === postId);
    const alreadyLiked = likedPostIds.has(postId);

    // Optimistic update
    setLikedPostIds((prev) => {
      const next = new Set(prev);
      if (alreadyLiked) next.delete(postId);
      else next.add(postId);
      return next;
    });

    const batch = writeBatch(db);
    const likeRef = doc(db, 'posts', postId, 'likes', uid);
    const postRef = doc(db, 'posts', postId);

    if (alreadyLiked) {
      batch.delete(likeRef);
      batch.update(postRef, {
        likesCount: increment(-1),
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(likeRef, {
        postId,
        userId: uid,
        createdAt: serverTimestamp(),
      });
      batch.update(postRef, {
        likesCount: increment(1),
        updatedAt: serverTimestamp(),
      });

      if (targetPost && targetPost.authorId !== uid) {
        const notifId = generateId('notif');
        batch.set(doc(db, 'notifications', notifId), {
          recipientId: targetPost.authorId,
          actorId: uid,
          actorName: currentUser.displayName,
          actorUsername: currentUser.username,
          actorPhotoURL: currentUser.photoURL,
          type: 'like',
          postId,
          previewText: targetPost.content.slice(0, 140) || 'Photo post',
          read: false,
          createdAt: serverTimestamp(),
        });
      }
    }

    try {
      await batch.commit();
    } catch (error) {
      // Revert optimistic toggle
      setLikedPostIds((prev) => {
        const next = new Set(prev);
        if (alreadyLiked) next.add(postId);
        else next.delete(postId);
        return next;
      });
      handleFirestoreError(error, OperationType.WRITE, `posts/${postId}/likes/${uid}`);
    }
  };

  const loadCommentsForPost = useCallback((postId: string) => {
    const commentsPath = `posts/${postId}/comments`;
    const q = query(collection(db, 'posts', postId, 'comments'), where('postId', '==', postId));
    return onSnapshot(
      q,
      (snap) => {
        const list: PostComment[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              postId: String(data.postId || postId),
              authorId: String(data.authorId || ''),
              authorName: String(data.authorName || 'Member'),
              authorUsername: String(data.authorUsername || 'member'),
              authorPhotoURL: String(data.authorPhotoURL || ''),
              content: String(data.content || ''),
              createdAt: toMillis(data.createdAt),
            };
          })
          .sort((a, b) => a.createdAt - b.createdAt);
        setCommentsByPost((prev) => ({ ...prev, [postId]: list }));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, commentsPath)
    );
  }, []);

  const addComment = async (postId: string, content: string) => {
    if (!currentUser) return;
    const clean = sanitizeLocalText(content, 400);
    if (!clean) return;
    const commentId = generateId('cmt');
    const targetPost = posts.find((p) => p.id === postId);

    const batch = writeBatch(db);
    batch.set(doc(db, 'posts', postId, 'comments', commentId), {
      postId,
      authorId: currentUser.uid,
      authorName: currentUser.displayName,
      authorUsername: currentUser.username,
      authorPhotoURL: currentUser.photoURL,
      content: clean,
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, 'posts', postId), {
      commentsCount: increment(1),
      updatedAt: serverTimestamp(),
    });

    if (targetPost && targetPost.authorId !== currentUser.uid) {
      const notifId = generateId('notif');
      batch.set(doc(db, 'notifications', notifId), {
        recipientId: targetPost.authorId,
        actorId: currentUser.uid,
        actorName: currentUser.displayName,
        actorUsername: currentUser.username,
        actorPhotoURL: currentUser.photoURL,
        type: 'comment',
        postId,
        previewText: clean.slice(0, 140),
        read: false,
        createdAt: serverTimestamp(),
      });
    }

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `posts/${postId}/comments/${commentId}`);
    }
  };

  const sharePost = async (postId: string) => {
    const targetPost = posts.find((p) => p.id === postId);
    const shareUrl = `${window.location.origin}/?post=${postId}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: targetPost ? `${targetPost.authorName} on CONNECTLY` : 'CONNECTLY Post',
          text: targetPost?.content.slice(0, 120) || 'Check out this post on CONNECTLY',
          url: shareUrl,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      }
    } catch {
      // User dismissed native share sheet
    }

    try {
      await updateDoc(doc(db, 'posts', postId), {
        sharesCount: increment(1),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `posts/${postId}`);
    }
  };

  const deletePost = async (postId: string) => {
    if (!currentUser) return;
    const batch = writeBatch(db);
    batch.delete(doc(db, 'posts', postId));
    batch.update(doc(db, 'users', currentUser.uid), {
      postsCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `posts/${postId}`);
    }
  };

  const toggleFollowUser = async (targetUid: string) => {
    if (!currentUser || targetUid === currentUser.uid) return;
    const uid = currentUser.uid;
    const isCurrentlyFollowing = followingIds.has(targetUid);

    const batch = writeBatch(db);
    const followingRef = doc(db, 'users', uid, 'following', targetUid);
    const followerRef = doc(db, 'users', targetUid, 'followers', uid);
    const meRef = doc(db, 'users', uid);
    const targetRef = doc(db, 'users', targetUid);

    if (isCurrentlyFollowing) {
      batch.delete(followingRef);
      batch.delete(followerRef);
      batch.update(meRef, {
        followingCount: increment(-1),
        updatedAt: serverTimestamp(),
      });
      batch.update(targetRef, {
        followersCount: increment(-1),
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(followingRef, {
        followerId: uid,
        followingId: targetUid,
        createdAt: serverTimestamp(),
      });
      batch.set(followerRef, {
        followerId: uid,
        followingId: targetUid,
        createdAt: serverTimestamp(),
      });
      batch.update(meRef, {
        followingCount: increment(1),
        updatedAt: serverTimestamp(),
      });
      batch.update(targetRef, {
        followersCount: increment(1),
        updatedAt: serverTimestamp(),
      });
      const notifId = generateId('notif');
      batch.set(doc(db, 'notifications', notifId), {
        recipientId: targetUid,
        actorId: uid,
        actorName: currentUser.displayName,
        actorUsername: currentUser.username,
        actorPhotoURL: currentUser.photoURL,
        type: 'follow',
        previewText: `@${currentUser.username} started following you`,
        read: false,
        createdAt: serverTimestamp(),
      });
    }

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}/following/${targetUid}`);
    }
  };

  const startOrOpenDirectChat = async (targetUser: UserPublicProfile): Promise<string> => {
    if (!currentUser || targetUser.uid === currentUser.uid) return '';
    const [userA, userB] =
      currentUser.uid < targetUser.uid
        ? [currentUser, targetUser]
        : [targetUser, currentUser];
    const convId = `${userA.uid}__${userB.uid}`;
    const convRef = doc(db, 'conversations', convId);

    try {
      const existing = await getDoc(convRef);
      if (!existing.exists()) {
        await setDoc(convRef, {
          participantIds: [userA.uid, userB.uid],
          participantAId: userA.uid,
          participantBId: userB.uid,
          participantAName: userA.displayName,
          participantAUsername: userA.username,
          participantAPhotoURL: userA.photoURL,
          participantBName: userB.displayName,
          participantBUsername: userB.username,
          participantBPhotoURL: userB.photoURL,
          lastMessageText: '',
          lastMessageSenderId: '',
          lastMessageAt: serverTimestamp(),
          unreadA: 0,
          unreadB: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      return convId;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `conversations/${convId}`);
    }
  };

  const dispatchMessageWrite = async (
    conversationId: string,
    msgId: string,
    cleanText: string,
    imageURL?: string
  ) => {
    if (!currentUser) return;
    const conv = conversations.find((c) => c.id === conversationId);
    const otherUid =
      conv?.participantIds.find((id) => id !== currentUser.uid) ||
      conversationId.split('__').find((id) => id !== currentUser.uid) ||
      '';
    const isSenderA = currentUser.uid < otherUid;

    let finalImageUrl: string | undefined;
    if (imageURL) {
      finalImageUrl = imageURL.startsWith('data:')
        ? await uploadMediaWithFallback(`messages/${conversationId}/${msgId}.webp`, imageURL)
        : imageURL;
    }

    const msgDoc: Record<string, unknown> = {
      conversationId,
      senderId: currentUser.uid,
      text: cleanText,
      readBy: [currentUser.uid],
      createdAt: serverTimestamp(),
    };
    if (finalImageUrl) {
      msgDoc.imageURL = finalImageUrl.slice(0, 250000);
    }

    const preview = cleanText ? cleanText.slice(0, 140) : 'Sent a photo';

    const batch = writeBatch(db);
    batch.set(doc(db, 'conversations', conversationId, 'messages', msgId), msgDoc);
    batch.update(doc(db, 'conversations', conversationId), {
      lastMessageText: preview,
      lastMessageSenderId: currentUser.uid,
      lastMessageAt: serverTimestamp(),
      ...(isSenderA ? { unreadB: increment(1) } : { unreadA: increment(1) }),
      updatedAt: serverTimestamp(),
    });

    if (otherUid && otherUid !== currentUser.uid) {
      const notifId = generateId('notif');
      batch.set(doc(db, 'notifications', notifId), {
        recipientId: otherUid,
        actorId: currentUser.uid,
        actorName: currentUser.displayName,
        actorUsername: currentUser.username,
        actorPhotoURL: currentUser.photoURL,
        type: 'message',
        conversationId,
        previewText: preview,
        read: false,
        createdAt: serverTimestamp(),
      });
    }

    await batch.commit();
  };

  const sendMessage = async (
    conversationId: string,
    payload: { text: string; imageURL?: string }
  ) => {
    if (!currentUser) return;
    const msgId = generateId('msg');
    const cleanText = sanitizeLocalText(payload.text, 1500);
    if (!cleanText && !payload.imageURL) return;

    const optimistic: DirectMessage = {
      id: msgId,
      conversationId,
      senderId: currentUser.uid,
      text: cleanText,
      imageURL: payload.imageURL,
      status: navigator.onLine ? 'sending' : 'failed',
      readBy: [currentUser.uid],
      createdAt: Date.now(),
    };

    setPendingMessagesByConv((prev) => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] || []), optimistic],
    }));

    if (!navigator.onLine) {
      return;
    }

    try {
      await dispatchMessageWrite(conversationId, msgId, cleanText, payload.imageURL);
      setPendingMessagesByConv((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).filter((m) => m.id !== msgId),
      }));
    } catch {
      setPendingMessagesByConv((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).map((m) =>
          m.id === msgId ? { ...m, status: 'failed' } : m
        ),
      }));
    }
  };

  const retryMessage = async (conversationId: string, messageId: string) => {
    const pendingList = pendingMessagesByConv[conversationId] || [];
    const target = pendingList.find((m) => m.id === messageId);
    if (!target) return;

    setPendingMessagesByConv((prev) => ({
      ...prev,
      [conversationId]: (prev[conversationId] || []).map((m) =>
        m.id === messageId ? { ...m, status: 'sending' } : m
      ),
    }));

    try {
      await dispatchMessageWrite(
        conversationId,
        messageId,
        target.text,
        target.imageURL
      );
      setPendingMessagesByConv((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).filter((m) => m.id !== messageId),
      }));
    } catch {
      setPendingMessagesByConv((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).map((m) =>
          m.id === messageId ? { ...m, status: 'failed' } : m
        ),
      }));
    }
  };

  const markConversationRead = useCallback(
    async (conversationId: string) => {
      if (!currentUser || !conversationId || !navigator.onLine) return;
      const conv = conversations.find((c) => c.id === conversationId);
      if (!conv) return;
      const unread = conv.unreadCounts[currentUser.uid] || 0;
      if (unread === 0) return;

      const [uidA] = [...conv.participantIds].sort();
      const isParticipantA = currentUser.uid === uidA;

      try {
        await updateDoc(doc(db, 'conversations', conversationId), {
          ...(isParticipantA ? { unreadA: 0 } : { unreadB: 0 }),
          updatedAt: serverTimestamp(),
        });
      } catch {
        // ignore transient mark-read conflict
      }
    },
    [currentUser?.uid, conversations]
  );

  const markNotificationRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), { read: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
    }
  };

  const markAllNotificationsRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    for (const item of unread.slice(0, 50)) {
      batch.update(doc(db, 'notifications', item.id), { read: true });
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'notifications');
    }
  };

  const getFollowersList = async (uid: string): Promise<UserPublicProfile[]> => {
    try {
      const snap = await getDocs(
        query(collection(db, 'users', uid, 'followers'), where('followingId', '==', uid))
      );
      const ids = snap.docs.map((d) => d.id);
      const profiles = await Promise.all(
        ids.map(async (id) => {
          const cached = allUsers.find((u) => u.uid === id);
          if (cached) return cached;
          const uSnap = await getDoc(doc(db, 'users', id));
          return uSnap.exists() ? mapUserDoc(uSnap.data(), uSnap.id) : null;
        })
      );
      return profiles.filter((u): u is UserPublicProfile => Boolean(u));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, `users/${uid}/followers`);
    }
  };

  const getFollowingList = async (uid: string): Promise<UserPublicProfile[]> => {
    try {
      const snap = await getDocs(
        query(collection(db, 'users', uid, 'following'), where('followerId', '==', uid))
      );
      const ids = snap.docs.map((d) => d.id);
      const profiles = await Promise.all(
        ids.map(async (id) => {
          const cached = allUsers.find((u) => u.uid === id);
          if (cached) return cached;
          const uSnap = await getDoc(doc(db, 'users', id));
          return uSnap.exists() ? mapUserDoc(uSnap.data(), uSnap.id) : null;
        })
      );
      return profiles.filter((u): u is UserPublicProfile => Boolean(u));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, `users/${uid}/following`);
    }
  };

  const loadMorePosts = async () => {
    setPostLimit((prev) => prev + 15);
  };

  const unreadMessagesCount = useMemo(() => {
    if (!currentUser) return 0;
    return conversations.reduce(
      (sum, c) => sum + (c.unreadCounts[currentUser.uid] || 0),
      0
    );
  }, [conversations, currentUser]);

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const value: SocialContextValue = {
    authReady,
    firebaseConfigured: true,
    needsOnboarding,
    onboardingDefaults,
    signedInEmail: firebaseUser?.email || null,
    currentUser,
    authError,
    isSigningIn,

    activeTab,
    setActiveTab,
    viewedProfileId,
    openProfile,
    activeConversationId,
    openConversation,
    discoverQuery,
    setDiscoverQuery,
    openHashtag,
    highlightedPostId,
    setHighlightedPostId,

    feedFilter,
    setFeedFilter,
    posts,
    postsLoading,
    hasMorePosts,
    loadMorePosts,
    likedPostIds,
    commentsByPost,
    loadCommentsForPost,

    allUsers,
    followingIds,
    followerIds,

    conversations,
    messagesByConversation,
    notifications,
    unreadMessagesCount,
    unreadNotificationsCount,

    signInWithGoogle,
    signOut,
    completeOnboarding,
    updateUserProfile,

    createPost,
    toggleLikePost,
    addComment,
    sharePost,
    deletePost,

    toggleFollowUser,
    startOrOpenDirectChat,
    sendMessage,
    retryMessage,
    markConversationRead,

    markNotificationRead,
    markAllNotificationsRead,
    getFollowersList,
    getFollowingList,
  };

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

export function useSocial(): SocialContextValue {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error('useSocial must be used within SocialProvider');
  return ctx;
}
