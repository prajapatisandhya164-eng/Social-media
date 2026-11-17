import { useMemo, useState } from 'react';
import {
  Bell,
  Compass,
  Gauge,
  Home,
  LogOut,
  MessageSquare,
  Moon,
  Plus,
  Search,
  Sun,
  User,
  WifiOff,
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { useTheme } from '../context/ThemeContext';
import { useNetworkStatus } from '../utils/network';
import { BrandMark } from './BrandMark';
import { Avatar } from './Avatar';
import { FeedView } from './FeedView';
import { DiscoverView } from './DiscoverView';
import { MessagesView } from './MessagesView';
import { NotificationsView } from './NotificationsView';
import { ProfileView } from './ProfileView';
import { PostComposerModal } from './PostComposerModal';
import { AppTab } from '../types/social';
import { formatCompactCount } from '../utils/formatters';

export function AppShell() {
  const {
    currentUser,
    activeTab,
    setActiveTab,
    openProfile,
    unreadMessagesCount,
    unreadNotificationsCount,
    posts,
    allUsers,
    followingIds,
    toggleFollowUser,
    openHashtag,
    setDiscoverQuery,
    signOut,
  } = useSocial();
  const { theme, toggleTheme } = useTheme();
  const { isOnline, effectiveType, dataSaver, toggleDataSaver, isSlowConnection } =
    useNetworkStatus();

  const [composerOpen, setComposerOpen] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');

  const topHashtags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of posts) {
      for (const t of p.hashtags) {
        counts.set(t, (counts.get(t) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [posts]);

  const suggestedAccounts = useMemo(() => {
    return allUsers
      .filter((u) => u.uid !== currentUser?.uid && !followingIds.has(u.uid))
      .slice(0, 4);
  }, [allUsers, currentUser?.uid, followingIds]);

  const navItems: {
    id: AppTab;
    label: string;
    icon: typeof Home;
    badge?: number;
  }[] = [
    { id: 'feed', label: 'Feed', icon: Home },
    { id: 'discover', label: 'Discover', icon: Compass },
    { id: 'messages', label: 'Messages', icon: MessageSquare, badge: unreadMessagesCount },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      badge: unreadNotificationsCount,
    },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  const handleNavClick = (id: AppTab) => {
    if (id === 'profile' && currentUser) {
      openProfile(currentUser.uid);
    } else {
      setActiveTab(id);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#050507] text-zinc-950 dark:text-zinc-100">
      {/* Mobile Sticky Top Header (48px) */}
      <header className="lg:hidden sticky top-0 z-30 h-12 px-4 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/90 dark:bg-[#050507]/90 backdrop-blur-md flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('feed')}
          className="flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <BrandMark className="w-7 h-7" />
          <span className="font-display text-base font-bold tracking-tight whitespace-nowrap">
            CONNECTLY
          </span>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={toggleDataSaver}
            aria-label={dataSaver ? 'Disable Data Saver' : 'Enable Data Saver'}
            title={`Network: ${effectiveType.toUpperCase()} · Data Saver ${dataSaver ? 'On' : 'Off'}`}
            className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl transition-colors cursor-pointer ${
              dataSaver ? 'text-indigo-500' : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            <Gauge className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('notifications')}
            aria-label="Notifications"
            className="relative min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-zinc-600 dark:text-zinc-300 cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-2 right-2 min-w-[16px] h-4 px-1 rounded-full bg-indigo-600 text-white text-[10px] font-semibold flex items-center justify-center tabular-nums">
                {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-zinc-600 dark:text-zinc-300 cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Desktop 3-Column Layout */}
      <div className="max-w-7xl mx-auto flex min-h-screen">
        {/* Left Navigation Sidebar (Desktop) */}
        <aside className="hidden lg:flex lg:w-64 shrink-0 flex-col justify-between sticky top-0 h-screen border-r border-zinc-200 dark:border-zinc-800/80 px-4 py-6">
          <div className="space-y-6">
            <button
              type="button"
              onClick={() => setActiveTab('feed')}
              className="px-3 flex items-center gap-3 cursor-pointer"
            >
              <BrandMark className="w-8 h-8" />
              <span className="font-display text-lg font-bold tracking-tight">
                CONNECTLY
              </span>
            </button>

            <nav className="space-y-1" aria-label="Primary navigation">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl flex items-center justify-between text-sm font-medium transition-colors cursor-pointer ${
                      active
                        ? 'bg-indigo-600/10 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-900 hover:text-zinc-950 dark:hover:text-zinc-100'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-indigo-600 text-white text-[11px] font-semibold inline-flex items-center justify-center tabular-nums">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="w-full min-h-[46px] px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 via-violet-600 to-blue-600 hover:brightness-110 transition-all inline-flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Post</span>
            </button>
          </div>

          <div className="space-y-3 pt-4 border-t border-zinc-200 dark:border-zinc-800/80">
            <div className="flex items-center justify-between px-2">
              <button
                type="button"
                onClick={toggleDataSaver}
                className={`min-h-[36px] px-2.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  dataSaver
                    ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                    : 'text-zinc-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-900'
                }`}
              >
                <Gauge className="w-3.5 h-3.5" />
                <span>Data Saver: {dataSaver ? 'On' : 'Off'}</span>
              </button>

              <button
                type="button"
                onClick={toggleTheme}
                aria-label="Toggle color theme"
                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>

            {currentUser && (
              <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => openProfile(currentUser.uid)}
                  className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
                >
                  <Avatar
                    src={currentUser.photoURL}
                    name={currentUser.displayName}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-950 dark:text-white truncate">
                      {currentUser.displayName}
                    </p>
                    <p className="text-[11px] text-zinc-500 truncate">
                      @{currentUser.username}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={signOut}
                  aria-label="Sign out"
                  title="Sign out"
                  className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-zinc-500 hover:text-rose-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-900 transition-colors cursor-pointer shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Center Main Content */}
        <main className="flex-1 min-w-0 pb-16 lg:pb-0 border-r border-zinc-200 dark:border-zinc-800/80">
          {!isOnline && (
            <div className="px-4 py-2 bg-amber-500/15 border-b border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
              <WifiOff className="w-3.5 h-3.5 shrink-0" />
              <span>
                You are offline · Showing cached content. Queued messages will retry when reconnected.
              </span>
            </div>
          )}

          {activeTab === 'feed' && (
            <FeedView
              onOpenComposer={() => setComposerOpen(true)}
              isSlowConnection={isSlowConnection}
            />
          )}
          {activeTab === 'discover' && (
            <DiscoverView isSlowConnection={isSlowConnection} />
          )}
          {activeTab === 'messages' && (
            <MessagesView isSlowConnection={isSlowConnection} />
          )}
          {activeTab === 'notifications' && <NotificationsView />}
          {activeTab === 'profile' && (
            <ProfileView isSlowConnection={isSlowConnection} />
          )}
        </main>

        {/* Right Context Rail (Desktop, hidden on Messages) */}
        {activeTab !== 'messages' && (
          <aside className="hidden xl:block w-80 shrink-0 px-5 py-6 space-y-6 sticky top-0 h-screen overflow-y-auto">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setDiscoverQuery(quickSearch);
                setActiveTab('discover');
              }}
              className="relative"
            >
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                placeholder="Search CONNECTLY..."
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </form>

            <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-4 space-y-3">
              <h3 className="font-display text-sm font-semibold text-zinc-950 dark:text-white">
                Trending Hashtags
              </h3>
              {topHashtags.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  No trending tags yet. Use #tags in your posts.
                </p>
              ) : (
                <div className="space-y-2">
                  {topHashtags.map(([tag, count]) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => openHashtag(tag)}
                      className="w-full flex items-center justify-between text-left py-1 hover:text-indigo-500 transition-colors cursor-pointer"
                    >
                      <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400 truncate">
                        #{tag}
                      </span>
                      <span className="text-xs text-zinc-500 tabular-nums">
                        {formatCompactCount(count)} posts
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-4 space-y-3">
              <h3 className="font-display text-sm font-semibold text-zinc-950 dark:text-white">
                Who to Follow
              </h3>
              {suggestedAccounts.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  New community accounts will appear here.
                </p>
              ) : (
                <div className="space-y-3">
                  {suggestedAccounts.map((user) => (
                    <div key={user.uid} className="flex items-center justify-between gap-2.5">
                      <button
                        type="button"
                        onClick={() => openProfile(user.uid)}
                        className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
                      >
                        <Avatar src={user.photoURL} name={user.displayName} size="sm" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-zinc-950 dark:text-white truncate hover:underline">
                            {user.displayName}
                          </p>
                          <p className="text-[11px] text-zinc-500 truncate">
                            @{user.username}
                          </p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleFollowUser(user.uid)}
                        className="min-h-[34px] px-3 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shrink-0 cursor-pointer"
                      >
                        Follow
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </aside>
        )}
      </div>

      {/* Mobile Fixed Bottom Tab Bar (56px, total sticky mobile bars 48 + 56 = 104px <= 15% of 740px+) */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-14 pb-safe border-t border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/95 dark:bg-[#050507]/95 backdrop-blur-md grid grid-cols-5 items-center"
      >
        <button
          type="button"
          onClick={() => setActiveTab('feed')}
          className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
            activeTab === 'feed'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-medium">Feed</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('discover')}
          className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
            activeTab === 'discover'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          <Compass className="w-5 h-5" />
          <span className="text-[10px] font-medium">Discover</span>
        </button>

        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          aria-label="Create post"
          className="min-h-[44px] flex items-center justify-center cursor-pointer"
        >
          <span className="w-10 h-9 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-blue-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/25">
            <Plus className="w-5 h-5" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('messages')}
          className={`relative min-h-[44px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
            activeTab === 'messages'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px] font-medium">Chats</span>
          {unreadMessagesCount > 0 && (
            <span className="absolute top-1 right-3 min-w-[16px] h-4 px-1 rounded-full bg-indigo-600 text-white text-[9px] font-semibold flex items-center justify-center tabular-nums">
              {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => currentUser && openProfile(currentUser.uid)}
          className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
            activeTab === 'profile'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] font-medium">Profile</span>
        </button>
      </nav>

      <PostComposerModal
        isOpen={composerOpen}
        onClose={() => setComposerOpen(false)}
        isSlowConnection={isSlowConnection}
      />
    </div>
  );
}
