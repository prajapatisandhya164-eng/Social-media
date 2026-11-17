export type AppTab = 'feed' | 'discover' | 'messages' | 'notifications' | 'profile';
export type FeedFilter = 'for-you' | 'following' | 'trending';
export type NotificationFilter = 'all' | 'like' | 'comment' | 'follow' | 'message';
export type ThemeMode = 'dark' | 'light';

export interface UserPublicProfile {
  uid: string;
  username: string;
  displayName: string;
  bio: string;
  photoURL: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isOnline: boolean;
  lastSeenAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface UserPrivateInfo {
  uid: string;
  email: string;
  createdAt: number;
  updatedAt: number;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorPhotoURL: string;
  content: string;
  imageURL?: string;
  hashtags: string[];
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface PostComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorPhotoURL: string;
  content: string;
  createdAt: number;
}

export interface Conversation {
  id: string;
  participantIds: string[];
  participants: Record<
    string,
    {
      uid: string;
      displayName: string;
      username: string;
      photoURL: string;
    }
  >;
  lastMessageText: string;
  lastMessageSenderId: string;
  lastMessageAt: number;
  unreadCounts: Record<string, number>;
  createdAt: number;
  updatedAt: number;
}

export type MessageStatus = 'sending' | 'sent' | 'read' | 'failed';

export interface DirectMessage {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  imageURL?: string;
  status: MessageStatus;
  readBy: string[];
  createdAt: number;
  clientTempId?: string;
}

export interface NotificationItem {
  id: string;
  recipientId: string;
  actorId: string;
  actorName: string;
  actorUsername: string;
  actorPhotoURL: string;
  type: 'like' | 'comment' | 'follow' | 'message';
  postId?: string;
  conversationId?: string;
  previewText: string;
  read: boolean;
  createdAt: number;
}

export interface NetworkStatus {
  isOnline: boolean;
  effectiveType: string;
  dataSaver: boolean;
}
