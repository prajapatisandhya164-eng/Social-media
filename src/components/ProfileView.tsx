import React, { useMemo, useRef, useState } from 'react';
import {
  Camera,
  Edit3,
  Loader2,
  LogOut,
  MessageSquare,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { Avatar } from './Avatar';
import { PostCard } from './PostCard';
import { UserPublicProfile } from '../types/social';
import { formatCompactCount } from '../utils/formatters';
import { compressImageFile } from '../utils/imageCompression';
import {
  MAX_BIO_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_USERNAME_LENGTH,
  validateWithServerOrFallback,
} from '../utils/validation';

interface ProfileViewProps {
  isSlowConnection: boolean;
}

export function ProfileView({ isSlowConnection }: ProfileViewProps) {
  const {
    currentUser,
    viewedProfileId,
    allUsers,
    posts,
    followingIds,
    toggleFollowUser,
    startOrOpenDirectChat,
    openConversation,
    updateUserProfile,
    signOut,
    getFollowersList,
    getFollowingList,
    openProfile,
  } = useSocial();

  const targetUid = viewedProfileId || currentUser?.uid || '';
  const isOwnProfile = targetUid === currentUser?.uid;

  const profileUser: UserPublicProfile | null = useMemo(() => {
    if (isOwnProfile && currentUser) return currentUser;
    return allUsers.find((u) => u.uid === targetUid) || null;
  }, [isOwnProfile, currentUser, allUsers, targetUid]);

  const userPosts = useMemo(
    () => posts.filter((p) => p.authorId === targetUid),
    [posts, targetUid]
  );

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editPhoto, setEditPhoto] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [listModal, setListModal] = useState<{
    title: string;
    users: UserPublicProfile[];
    loading: boolean;
  } | null>(null);

  if (!profileUser) {
    return (
      <div className="p-10 text-center text-sm text-zinc-500">
        Profile not found or still loading.
      </div>
    );
  }

  const isFollowing = followingIds.has(profileUser.uid);

  const openEditModal = () => {
    setEditName(profileUser.displayName);
    setEditUsername(profileUser.username);
    setEditBio(profileUser.bio);
    setEditPhoto(profileUser.photoURL);
    setEditError(null);
    setIsEditing(true);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressing(true);
    setEditError(null);
    try {
      const result = await compressImageFile(file, {
        lowBandwidth: true,
        maxDimension: 360,
        maxTargetBytes: 55_000,
      });
      setEditPhoto(result.dataUrl);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Unable to process profile picture.');
    } finally {
      setCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    setSaving(true);
    try {
      const check = await validateWithServerOrFallback({
        type: 'profile',
        displayName: editName,
        username: editUsername,
        bio: editBio,
      });
      if (!check.valid || !check.sanitizedProfile) {
        setEditError(check.error || 'Invalid profile fields.');
        return;
      }
      await updateUserProfile({
        ...check.sanitizedProfile,
        photoURL: editPhoto,
      });
      setIsEditing(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Unable to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const openFollowModal = async (kind: 'followers' | 'following') => {
    setListModal({
      title: kind === 'followers' ? 'Followers' : 'Following',
      users: [],
      loading: true,
    });
    const users =
      kind === 'followers'
        ? await getFollowersList(profileUser.uid)
        : await getFollowingList(profileUser.uid);
    setListModal({
      title: kind === 'followers' ? 'Followers' : 'Following',
      users,
      loading: false,
    });
  };

  return (
    <div className="min-h-full">
      <div className="h-28 sm:h-36 bg-gradient-to-r from-indigo-950 via-violet-950 to-blue-950 relative" />

      <div className="px-4 sm:px-6 pb-6 border-b border-zinc-200 dark:border-zinc-800/80">
        <div className="flex items-end justify-between gap-4 -mt-12 relative z-10">
          <Avatar
            src={profileUser.photoURL}
            name={profileUser.displayName}
            size="xl"
            showPresence
            isOnline={profileUser.isOnline}
            className="ring-4 ring-zinc-50 dark:ring-[#050507] rounded-full"
          />

          <div className="flex items-center gap-2 pt-14">
            {isOwnProfile ? (
              <>
                <button
                  type="button"
                  onClick={openEditModal}
                  className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Profile</span>
                </button>
                <button
                  type="button"
                  onClick={signOut}
                  aria-label="Sign out"
                  className="min-h-[40px] min-w-[40px] px-3 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-rose-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 inline-flex items-center justify-center transition-colors cursor-pointer lg:hidden"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={async () => {
                    const convId = await startOrOpenDirectChat(profileUser);
                    if (convId) openConversation(convId);
                  }}
                  className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Message</span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleFollowUser(profileUser.uid)}
                  className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isFollowing
                      ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                >
                  {isFollowing ? (
                    <>
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Following</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Follow</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-1.5">
          <h1 className="font-display text-xl font-bold text-zinc-950 dark:text-white">
            {profileUser.displayName}
          </h1>
          <p className="text-sm text-zinc-500">@{profileUser.username}</p>
          {profileUser.bio && (
            <p className="text-sm text-zinc-800 dark:text-zinc-200 pt-1 leading-relaxed max-w-xl">
              {profileUser.bio}
            </p>
          )}
        </div>

        <div className="mt-4 flex items-center gap-6 text-sm">
          <div className="tabular-nums">
            <span className="font-semibold text-zinc-950 dark:text-white">
              {formatCompactCount(userPosts.length)}
            </span>{' '}
            <span className="text-zinc-500">Posts</span>
          </div>
          <button
            type="button"
            onClick={() => openFollowModal('followers')}
            className="tabular-nums hover:underline cursor-pointer"
          >
            <span className="font-semibold text-zinc-950 dark:text-white">
              {formatCompactCount(profileUser.followersCount)}
            </span>{' '}
            <span className="text-zinc-500">Followers</span>
          </button>
          <button
            type="button"
            onClick={() => openFollowModal('following')}
            className="tabular-nums hover:underline cursor-pointer"
          >
            <span className="font-semibold text-zinc-950 dark:text-white">
              {formatCompactCount(profileUser.followingCount)}
            </span>{' '}
            <span className="text-zinc-500">Following</span>
          </button>
        </div>
      </div>

      <div>
        {userPosts.length === 0 ? (
          <p className="p-10 text-center text-sm text-zinc-500">
            No posts published yet.
          </p>
        ) : (
          userPosts.map((post) => (
            <PostCard key={post.id} post={post} isSlowConnection={isSlowConnection} />
          ))
        )}
      </div>

      {/* Edit Profile Modal */}
      {isEditing && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Edit profile"
        >
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-zinc-950 dark:text-white">
                Edit Profile
              </h2>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar src={editPhoto} name={editName || 'User'} size="lg" />
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={compressing}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 inline-flex items-center gap-2 cursor-pointer"
                  >
                    {compressing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Camera className="w-3.5 h-3.5" />
                    )}
                    <span>{compressing ? 'Optimizing...' : 'Change Photo'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={MAX_DISPLAY_NAME_LENGTH}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  maxLength={MAX_USERNAME_LENGTH}
                  value={editUsername}
                  onChange={(e) =>
                    setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                  }
                  className="w-full h-11 px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">
                  Bio
                </label>
                <textarea
                  rows={3}
                  maxLength={MAX_BIO_LENGTH}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {editError && (
                <p className="text-xs text-rose-500" role="alert">
                  {editError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="min-h-[44px] px-4 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || compressing}
                  className="min-h-[44px] px-5 rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Followers / Following List Modal */}
      {listModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={listModal.title}
        >
          <div className="w-full sm:max-w-md max-h-[75vh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-zinc-950 dark:text-white">
                {listModal.title}
              </h3>
              <button
                type="button"
                onClick={() => setListModal(null)}
                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-zinc-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-200 dark:divide-zinc-800">
              {listModal.loading ? (
                <p className="p-6 text-center text-xs text-zinc-500">Loading...</p>
              ) : listModal.users.length === 0 ? (
                <p className="p-6 text-center text-xs text-zinc-500">No accounts yet.</p>
              ) : (
                listModal.users.map((u) => (
                  <button
                    key={u.uid}
                    type="button"
                    onClick={() => {
                      setListModal(null);
                      openProfile(u.uid);
                    }}
                    className="w-full px-5 py-3 flex items-center gap-3 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-left cursor-pointer"
                  >
                    <Avatar src={u.photoURL} name={u.displayName} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-950 dark:text-white truncate">
                        {u.displayName}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">@{u.username}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
