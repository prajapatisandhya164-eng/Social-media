import { useMemo } from 'react';
import { Hash, Search, UserCheck, UserPlus, X } from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { Avatar } from './Avatar';
import { PostCard } from './PostCard';
import { formatCompactCount } from '../utils/formatters';

interface DiscoverViewProps {
  isSlowConnection: boolean;
}

export function DiscoverView({ isSlowConnection }: DiscoverViewProps) {
  const {
    currentUser,
    allUsers,
    posts,
    followingIds,
    discoverQuery,
    setDiscoverQuery,
    toggleFollowUser,
    openProfile,
    startOrOpenDirectChat,
    openConversation,
  } = useSocial();

  const normalizedQuery = discoverQuery.trim().toLowerCase();

  const trendingHashtags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of posts) {
      for (const tag of post.hashtags) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [posts]);

  const matchingUsers = useMemo(() => {
    const candidates = allUsers.filter((u) => u.uid !== currentUser?.uid);
    if (!normalizedQuery) {
      return candidates
        .sort((a, b) => b.followersCount - a.followersCount)
        .slice(0, 8);
    }
    const clean = normalizedQuery.replace(/^@/, '');
    return candidates.filter(
      (u) =>
        u.displayName.toLowerCase().includes(clean) ||
        u.username.toLowerCase().includes(clean) ||
        u.bio.toLowerCase().includes(clean)
    );
  }, [allUsers, currentUser?.uid, normalizedQuery]);

  const matchingPosts = useMemo(() => {
    if (!normalizedQuery) return posts.slice(0, 15);
    if (normalizedQuery.startsWith('#')) {
      const tag = normalizedQuery.slice(1);
      return posts.filter(
        (p) =>
          p.hashtags.includes(tag) || p.content.toLowerCase().includes(normalizedQuery)
      );
    }
    return posts.filter(
      (p) =>
        p.content.toLowerCase().includes(normalizedQuery) ||
        p.authorName.toLowerCase().includes(normalizedQuery) ||
        p.authorUsername.toLowerCase().includes(normalizedQuery)
    );
  }, [posts, normalizedQuery]);

  return (
    <div className="min-h-full">
      <div className="sticky top-12 lg:top-0 z-20 bg-zinc-50/90 dark:bg-[#050507]/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800/80 px-4 sm:px-6 py-3.5">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={discoverQuery}
            onChange={(e) => setDiscoverQuery(e.target.value)}
            placeholder="Search people, posts, or #hashtags..."
            className="w-full h-11 pl-10 pr-10 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {discoverQuery && (
            <button
              type="button"
              onClick={() => setDiscoverQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] inline-flex items-center justify-center text-zinc-400 hover:text-zinc-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Trending Hashtags */}
      <section className="px-4 sm:px-6 py-5 border-b border-zinc-200 dark:border-zinc-800/80 space-y-3">
        <h2 className="font-display text-sm font-semibold text-zinc-950 dark:text-white">
          Trending Hashtags
        </h2>
        {trendingHashtags.length === 0 ? (
          <p className="text-xs text-zinc-500">
            Hashtags from community posts will appear here automatically.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {trendingHashtags.map(([tag, count]) => (
              <button
                key={tag}
                type="button"
                onClick={() => setDiscoverQuery(`#${tag}`)}
                className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hover:border-indigo-500/50 text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1 text-sm font-semibold text-indigo-600 dark:text-indigo-400 truncate">
                  <Hash className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{tag}</span>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5 tabular-nums">
                  {formatCompactCount(count)} {count === 1 ? 'post' : 'posts'}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Suggested / Matching Accounts */}
      <section className="px-4 sm:px-6 py-5 border-b border-zinc-200 dark:border-zinc-800/80 space-y-3">
        <h2 className="font-display text-sm font-semibold text-zinc-950 dark:text-white">
          {normalizedQuery ? 'Matching People' : 'Suggested Accounts'}
        </h2>
        {matchingUsers.length === 0 ? (
          <p className="text-xs text-zinc-500">No matching accounts found.</p>
        ) : (
          <div className="divide-y divide-zinc-200/70 dark:divide-zinc-800/60">
            {matchingUsers.map((user) => {
              const isFollowing = followingIds.has(user.uid);
              return (
                <div key={user.uid} className="py-3 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => openProfile(user.uid)}
                    className="flex items-center gap-3 min-w-0 text-left cursor-pointer"
                  >
                    <Avatar
                      src={user.photoURL}
                      name={user.displayName}
                      size="md"
                      showPresence
                      isOnline={user.isOnline}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-950 dark:text-white truncate hover:underline">
                        {user.displayName}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">
                        @{user.username} · {formatCompactCount(user.followersCount)} followers
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={async () => {
                        const convId = await startOrOpenDirectChat(user);
                        if (convId) openConversation(convId);
                      }}
                      className="min-h-[38px] px-3 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
                    >
                      Message
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleFollowUser(user.uid)}
                      className={`min-h-[38px] px-3.5 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                        isFollowing
                          ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200'
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
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Matching Posts */}
      <section>
        <div className="px-4 sm:px-6 pt-5 pb-2">
          <h2 className="font-display text-sm font-semibold text-zinc-950 dark:text-white">
            {normalizedQuery ? 'Matching Posts' : 'Explore Posts'}
          </h2>
        </div>
        {matchingPosts.length === 0 ? (
          <p className="px-6 py-10 text-center text-xs text-zinc-500">
            No posts match your search yet.
          </p>
        ) : (
          matchingPosts.map((post) => (
            <PostCard key={post.id} post={post} isSlowConnection={isSlowConnection} />
          ))
        )}
      </section>
    </div>
  );
}
