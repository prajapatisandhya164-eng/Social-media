import { useMemo } from 'react';
import { Flame, ImagePlus, Sparkles, Users } from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { Avatar } from './Avatar';
import { PostCard } from './PostCard';
import { FeedFilter } from '../types/social';

interface FeedViewProps {
  onOpenComposer: () => void;
  isSlowConnection: boolean;
}

export function FeedView({ onOpenComposer, isSlowConnection }: FeedViewProps) {
  const {
    currentUser,
    posts,
    postsLoading,
    hasMorePosts,
    loadMorePosts,
    feedFilter,
    setFeedFilter,
    followingIds,
  } = useSocial();

  const visiblePosts = useMemo(() => {
    if (feedFilter === 'following') {
      return posts.filter(
        (p) => p.authorId === currentUser?.uid || followingIds.has(p.authorId)
      );
    }
    if (feedFilter === 'trending') {
      return [...posts].sort((a, b) => {
        const scoreA = a.likesCount * 2 + a.commentsCount * 3 + a.sharesCount * 4;
        const scoreB = b.likesCount * 2 + b.commentsCount * 3 + b.sharesCount * 4;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return b.createdAt - a.createdAt;
      });
    }
    return posts;
  }, [posts, feedFilter, followingIds, currentUser?.uid]);

  const filterTabs: { id: FeedFilter; label: string; icon: typeof Sparkles }[] = [
    { id: 'for-you', label: 'For You', icon: Sparkles },
    { id: 'following', label: 'Following', icon: Users },
    { id: 'trending', label: 'Trending', icon: Flame },
  ];

  return (
    <div className="min-h-full">
      <div className="sticky top-12 lg:top-0 z-20 bg-zinc-50/90 dark:bg-[#050507]/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800/80 px-4 sm:px-6 py-3">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-200/70 dark:bg-zinc-900">
          {filterTabs.map((tab) => {
            const Icon = tab.icon;
            const active = feedFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFeedFilter(tab.id)}
                className={`flex-1 min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {currentUser && (
        <div className="border-b border-zinc-200 dark:border-zinc-800/80 px-4 sm:px-6 py-4">
          <button
            type="button"
            onClick={onOpenComposer}
            className="w-full flex items-center gap-3.5 text-left group cursor-pointer"
          >
            <Avatar src={currentUser.photoURL} name={currentUser.displayName} size="md" />
            <div className="flex-1 min-h-[44px] px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 flex items-center justify-between text-sm text-zinc-500 group-hover:border-indigo-500/50 transition-colors">
              <span className="truncate">Share something with your network...</span>
              <ImagePlus className="w-4 h-4 text-indigo-500 shrink-0 ml-2" />
            </div>
          </button>
        </div>
      )}

      {postsLoading && visiblePosts.length === 0 ? (
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800/80">
          {[1, 2, 3].map((item) => (
            <div key={item} className="px-6 py-5 flex gap-3.5 animate-pulse">
              <div className="w-11 h-11 rounded-full bg-zinc-200 dark:bg-zinc-800 shrink-0" />
              <div className="flex-1 space-y-2.5">
                <div className="h-3.5 w-44 rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-3.5 w-full rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-3.5 w-2/3 rounded bg-zinc-200 dark:bg-zinc-800" />
              </div>
            </div>
          ))}
        </div>
      ) : visiblePosts.length === 0 ? (
        <div className="px-6 py-14 text-center space-y-4">
          <div className="max-w-md mx-auto rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
            <img
              src="/src/assets/images/connectly_feed_placeholder_1794872620454.jpg"
              alt="Minimal dark slate editorial showcase"
              referrerPolicy="no-referrer"
              className="w-full h-40 object-cover"
            />
          </div>
          <div className="space-y-1.5">
            <h3 className="font-display text-lg font-semibold text-zinc-950 dark:text-white">
              {feedFilter === 'following'
                ? 'Your Following feed is quiet'
                : 'No posts published yet'}
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
              {feedFilter === 'following'
                ? 'Follow people in Discover or switch to For You to explore community updates.'
                : 'Be the first to share a note, photo, or hashtag with CONNECTLY.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenComposer}
            className="min-h-[44px] px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:brightness-110 transition-all cursor-pointer"
          >
            Create First Post
          </button>
        </div>
      ) : (
        <>
          <div>
            {visiblePosts.map((post) => (
              <PostCard key={post.id} post={post} isSlowConnection={isSlowConnection} />
            ))}
          </div>

          {hasMorePosts && (
            <div className="p-6 text-center">
              <button
                type="button"
                onClick={loadMorePosts}
                disabled={postsLoading}
                className="min-h-[44px] px-5 py-2 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors disabled:opacity-60 cursor-pointer"
              >
                {postsLoading ? 'Loading more...' : 'Load more posts'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
