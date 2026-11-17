import { useMemo, useState } from 'react';
import { Bell, CheckCheck, Heart, MessageCircle, MessageSquare, UserPlus } from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { Avatar } from './Avatar';
import { NotificationFilter, NotificationItem } from '../types/social';
import { formatRelativeTime } from '../utils/formatters';

export function NotificationsView() {
  const {
    notifications,
    unreadNotificationsCount,
    markNotificationRead,
    markAllNotificationsRead,
    openProfile,
    openConversation,
    setActiveTab,
    setHighlightedPostId,
  } = useSocial();

  const [filter, setFilter] = useState<NotificationFilter>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return notifications;
    return notifications.filter((n) => n.type === filter);
  }, [notifications, filter]);

  const handleNotificationClick = async (item: NotificationItem) => {
    if (!item.read) {
      await markNotificationRead(item.id);
    }
    if (item.type === 'message' && item.conversationId) {
      openConversation(item.conversationId);
    } else if (item.type === 'follow') {
      openProfile(item.actorId);
    } else if (item.postId) {
      setHighlightedPostId(item.postId);
      setActiveTab('feed');
    } else {
      openProfile(item.actorId);
    }
  };

  const renderIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'like':
        return <Heart className="w-4 h-4 text-rose-500 fill-current" />;
      case 'comment':
        return <MessageCircle className="w-4 h-4 text-blue-500" />;
      case 'follow':
        return <UserPlus className="w-4 h-4 text-indigo-500" />;
      case 'message':
        return <MessageSquare className="w-4 h-4 text-violet-500" />;
    }
  };

  const tabs: { id: NotificationFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'like', label: 'Likes' },
    { id: 'comment', label: 'Comments' },
    { id: 'follow', label: 'Followers' },
    { id: 'message', label: 'Messages' },
  ];

  return (
    <div className="min-h-full">
      <div className="sticky top-12 lg:top-0 z-20 bg-zinc-50/90 dark:bg-[#050507]/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800/80 px-4 sm:px-6 py-4 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-lg font-bold text-zinc-950 dark:text-white">
            Notifications
          </h2>
          {unreadNotificationsCount > 0 && (
            <button
              type="button"
              onClick={markAllNotificationsRead}
              className="min-h-[36px] px-3 rounded-xl text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark all read</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-200/70 dark:bg-zinc-900 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                filter === tab.id
                  ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-12 text-center space-y-2.5">
          <div className="w-12 h-12 rounded-2xl bg-zinc-200/70 dark:bg-zinc-900 text-zinc-500 flex items-center justify-center mx-auto">
            <Bell className="w-5 h-5" />
          </div>
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            No notifications yet
          </p>
          <p className="text-xs text-zinc-500">
            Likes, comments, new followers, and message alerts will show up here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-200/80 dark:divide-zinc-800/70">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNotificationClick(item)}
              className={`w-full px-4 sm:px-6 py-4 flex items-start gap-3.5 text-left transition-colors cursor-pointer ${
                item.read
                  ? 'hover:bg-zinc-100/60 dark:hover:bg-zinc-900/40'
                  : 'bg-indigo-500/[0.06] hover:bg-indigo-500/[0.1]'
              }`}
            >
              <div className="mt-1 shrink-0">{renderIcon(item.type)}</div>
              <Avatar src={item.actorPhotoURL} name={item.actorName} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-900 dark:text-zinc-100">
                  <span className="font-semibold">{item.actorName}</span>{' '}
                  <span className="text-zinc-500">@{item.actorUsername}</span>{' '}
                  <span className="text-zinc-600 dark:text-zinc-300">
                    {item.type === 'like' && 'liked your post'}
                    {item.type === 'comment' && 'replied to your post'}
                    {item.type === 'follow' && 'started following you'}
                    {item.type === 'message' && 'sent you a message'}
                  </span>
                </p>
                {item.previewText && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
                    {item.previewText}
                  </p>
                )}
              </div>
              <span className="text-xs text-zinc-500 shrink-0 tabular-nums">
                {formatRelativeTime(item.createdAt)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
