import { ThemeProvider } from './context/ThemeContext';
import { SocialProvider, useSocial } from './context/SocialContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthScreen } from './components/AuthScreen';
import { AppShell } from './components/AppShell';
import { BrandMark } from './components/BrandMark';

function RootRouter() {
  const { authReady, currentUser, needsOnboarding } = useSocial();

  if (!authReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-zinc-50 dark:bg-[#050507] text-zinc-950 dark:text-zinc-100">
        <BrandMark className="w-10 h-10" />
        <p className="text-sm font-medium text-zinc-500">Connecting to CONNECTLY...</p>
      </div>
    );
  }

  if (!currentUser || needsOnboarding) {
    return <AuthScreen />;
  }

  return <AppShell />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <SocialProvider>
          <RootRouter />
        </SocialProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
