import React, { useState } from 'react';
import { ArrowRight, Globe, Lock, MessageSquare, Moon, Sparkles, Sun, Zap } from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { useTheme } from '../context/ThemeContext';
import { BrandMark } from './BrandMark';
import {
  MAX_BIO_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_USERNAME_LENGTH,
  validateWithServerOrFallback,
} from '../utils/validation';

export function AuthScreen() {
  const {
    needsOnboarding,
    onboardingDefaults,
    signedInEmail,
    signInWithGoogle,
    completeOnboarding,
    isSigningIn,
    authError,
    signOut,
  } = useSocial();
  const { theme, toggleTheme } = useTheme();

  const [displayName, setDisplayName] = useState(onboardingDefaults.displayName);
  const [username, setUsername] = useState(onboardingDefaults.username);
  const [bio, setBio] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isEmbeddedIframe =
    typeof window !== 'undefined' && window.self !== window.top;

  React.useEffect(() => {
    if (needsOnboarding) {
      if (!displayName && onboardingDefaults.displayName) {
        setDisplayName(onboardingDefaults.displayName);
      }
      if (!username && onboardingDefaults.username) {
        setUsername(onboardingDefaults.username);
      }
    }
  }, [needsOnboarding, onboardingDefaults.displayName, onboardingDefaults.username]);

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const result = await validateWithServerOrFallback({
        type: 'profile',
        displayName,
        username,
        bio,
      });
      if (!result.valid || !result.sanitizedProfile) {
        setFormError(result.error || 'Please check your profile details.');
        return;
      }
      await completeOnboarding(result.sanitizedProfile);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#050507] text-zinc-950 dark:text-zinc-100 flex flex-col">
      <header className="w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between gap-8">
        <div className="flex items-center gap-3 shrink-0">
          <BrandMark className="w-9 h-9" />
          <span className="font-display text-lg font-bold tracking-tight whitespace-nowrap">
            CONNECTLY
          </span>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle color theme"
          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
        <section className="lg:col-span-6 space-y-6">
          <p className="text-xs font-medium tracking-wide text-indigo-600 dark:text-indigo-400">
            Share · Connect · Discover
          </p>

          <h1
            className="font-display text-4xl sm:text-5xl font-bold tracking-tight leading-[1.08] text-zinc-950 dark:text-white"
            style={{ textWrap: 'balance' }}
          >
            {needsOnboarding
              ? 'Claim your handle and introduce yourself.'
              : 'Real conversations, visual stories, and instant messaging.'}
          </h1>

          <p className="text-base text-zinc-600 dark:text-zinc-400 max-w-xl leading-relaxed">
            {needsOnboarding
              ? `${signedInEmail ? `Signed in as ${signedInEmail}. ` : ''}Finish setting up your CONNECTLY profile to publish posts, follow creators, and start private real-time chats.`
              : 'A fast, privacy-first social platform engineered for crisp photo feeds, encrypted-session direct chats, and smooth performance even on 2G and 3G networks.'}
          </p>

          {!needsOnboarding ? (
            <div className="space-y-4 pt-2">
              <button
                type="button"
                onClick={signInWithGoogle}
                disabled={isSigningIn}
                className="w-full sm:w-auto min-h-[48px] px-6 py-3 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-indigo-600 via-violet-600 to-blue-600 hover:brightness-110 active:scale-[0.99] transition-all inline-flex items-center justify-center gap-3 shadow-lg shadow-indigo-500/20 disabled:opacity-60 cursor-pointer"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z"
                  />
                </svg>
                <span>{isSigningIn ? 'Signing in...' : 'Continue with Google'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {authError && (
                <div
                  role="alert"
                  className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs leading-relaxed max-w-lg space-y-2"
                >
                  <p>{authError}</p>
                  {isEmbeddedIframe && (
                    <a
                      href={window.location.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-semibold underline text-indigo-600 dark:text-indigo-300"
                    >
                      Open CONNECTLY in a full browser tab
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-zinc-200 dark:border-zinc-800/80">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    <Globe className="w-4 h-4 text-blue-500" />
                    <span>Live Feed</span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Text-first loading with adaptive image compression.
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    <MessageSquare className="w-4 h-4 text-violet-500" />
                    <span>Private Chat</span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Read receipts, online status, and offline message retry.
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    <Lock className="w-4 h-4 text-indigo-500" />
                    <span>Strict Privacy</span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Only conversation participants can read private threads.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleOnboardingSubmit}
              className="space-y-4 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950"
            >
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={MAX_DISPLAY_NAME_LENGTH}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Alex Rivera"
                  className="w-full h-11 px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-zinc-400">
                    @
                  </span>
                  <input
                    type="text"
                    required
                    maxLength={MAX_USERNAME_LENGTH}
                    value={username}
                    onChange={(e) =>
                      setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                    }
                    placeholder="alexrivera"
                    className="w-full h-11 pl-8 pr-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  3–30 lowercase letters, numbers, or underscores.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                  Bio (optional)
                </label>
                <textarea
                  rows={3}
                  maxLength={MAX_BIO_LENGTH}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Photographer, builder, exploring ideas."
                  className="w-full p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {formError && (
                <p className="text-xs text-rose-500" role="alert">
                  {formError}
                </p>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 min-h-[44px] px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:brightness-110 transition-all disabled:opacity-60"
                >
                  {submitting ? 'Creating profile...' : 'Enter CONNECTLY'}
                </button>
                <button
                  type="button"
                  onClick={signOut}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-medium border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>

        <section className="lg:col-span-6">
          <div className="relative rounded-3xl overflow-hidden border border-zinc-200 dark:border-zinc-800/90 bg-zinc-950 aspect-[4/3]">
            <img
              src="/src/assets/images/connectly_welcome_visual_1794872619700.jpg"
              alt="Architectural frosted glass panels refracting cobalt blue and indigo light"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent flex flex-col justify-end p-6 sm:p-8">
              <div className="flex items-center gap-2 text-xs text-blue-300 mb-2">
                <Zap className="w-3.5 h-3.5" />
                <span>2G / 3G Optimized · Real-Time Sync</span>
              </div>
              <p className="font-display text-xl sm:text-2xl font-semibold text-white">
                Built for clarity, speed, and meaningful reach.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
