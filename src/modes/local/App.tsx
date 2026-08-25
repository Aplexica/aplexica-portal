// SPDX-License-Identifier: AGPL-3.0-or-later
import { lazy, Suspense, useEffect, useMemo, useRef } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster, toast } from 'sonner';
import { t } from '@shared/i18n';
import { AppShell } from '@shared/components/AppShell';
import { LOCAL_ITEMS, type NavEntry } from '@shared/components/Sidebar';
import { Loading } from '@shared/components/Loading';
import { useBootstrap } from './hooks/useBootstrap';
import { usePendingCount } from './hooks/usePending';
import { useConflictsCount } from './hooks/useConflicts';
import { setSessionExpiryHandler } from './lib/api/client';
import { bootstrap as bootstrapApi, logout as logoutApi } from './lib/api/auth';

const DashboardPage = lazy(() => import('./routes/DashboardPage'));
const AgentsPage = lazy(() => import('./routes/AgentsPage'));
const AgentDetailPage = lazy(() => import('./routes/AgentDetailPage'));
const EventsPage = lazy(() => import('./routes/EventsPage'));
const RulesPage = lazy(() => import('./routes/RulesPage'));
const RuleDetailPage = lazy(() => import('./routes/RuleDetailPage'));
const ConflictsPage = lazy(() => import('./routes/ConflictsPage'));
const ConflictDetailPage = lazy(() => import('./routes/ConflictDetailPage'));
const ForkingPage = lazy(() => import('./routes/ForkingPage'));
const PendingProjectsPage = lazy(() => import('./routes/PendingProjectsPage'));
const ProjectsPage = lazy(() => import('./routes/ProjectsPage'));
const ConnectPage = lazy(() => import('./routes/ConnectPage'));
const BackupsPage = lazy(() => import('./routes/BackupsPage'));
const SettingsPage = lazy(() => import('./routes/SettingsPage'));
const SettingsTransportPage = lazy(() => import('./routes/SettingsTransportPage'));
const HelpPage = lazy(() => import('./routes/HelpPage'));
const OnboardingPage = lazy(() => import('./routes/OnboardingPage'));

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 60_000,
        retry: 1,
      },
    },
  });
}

/**
 * One-shot session-expiry recovery. The api client invokes this when a
 * request hits 401; we try to consume any pending bootstrap token in
 * the URL exactly once. Subsequent 401s after recovery fail surface
 * normally to the caller.
 */
function installSessionRecovery() {
  const tried = { value: false };
  setSessionExpiryHandler(async () => {
    if (tried.value) return false;
    tried.value = true;
    const url = new URL(window.location.href);
    const token = url.searchParams.get('bootstrap');
    if (!token) {
      toast.error(t('app.sessionExpired'));
      return false;
    }
    try {
      await bootstrapApi(token);
      url.searchParams.delete('bootstrap');
      history.replaceState({}, '', url.pathname + url.search + url.hash);
      return true;
    } catch {
      toast.error(t('app.sessionExpired'));
      return false;
    }
  });
}

function ScrollToTop() {
  const { pathname } = useLocation();
  const prev = useRef<string | null>(null);
  useEffect(() => {
    if (prev.current !== pathname) {
      prev.current = pathname;
      window.scrollTo(0, 0);
    }
  }, [pathname]);
  return null;
}

/**
 * Decorate the static local nav with mode-specific live data. The shared
 * Sidebar stays free of local-mode hooks: we inject the polled pending count
 * here (where the QueryClientProvider is in scope) and pass it down as a
 * NavEntry badge.
 */
function useLocalNavItems(): NavEntry[] {
  const pendingCount = usePendingCount();
  const conflictsCount = useConflictsCount();
  return useMemo(
    () =>
      LOCAL_ITEMS.map((item) => {
        if (item.to === '/pending') {
          return {
            ...item,
            badge: pendingCount,
            badgeAriaLabel: t('nav.pendingBadge', { count: pendingCount }),
          };
        }
        if (item.to === '/conflicts') {
          return {
            ...item,
            badge: conflictsCount,
            badgeAriaLabel: t('nav.conflictsBadge', { count: conflictsCount }),
          };
        }
        return item;
      }),
    [pendingCount, conflictsCount],
  );
}

function ShellRoutes() {
  const navItems = useLocalNavItems();
  const onLogout = async () => {
    try {
      await logoutApi();
    } finally {
      window.location.replace('/');
    }
  };
  return (
    <AppShell onLogout={onLogout} navItems={navItems}>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/agents/:name" element={<AgentDetailPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/rules" element={<RulesPage />} />
          <Route path="/rules/:id" element={<RuleDetailPage />} />
          <Route path="/conflicts" element={<ConflictsPage />} />
          <Route path="/conflicts/:id" element={<ConflictDetailPage />} />
          <Route path="/forking" element={<ForkingPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/pending" element={<PendingProjectsPage />} />
          <Route path="/connect" element={<ConnectPage />} />
          <Route path="/backups" element={<BackupsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/transport" element={<SettingsTransportPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/onboarding/*" element={<OnboardingPage />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}

function BootstrapFailure({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <section
        role="alert"
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm"
      >
        <h1 className="text-lg font-semibold text-foreground">{t('app.bootstrap.failedTitle')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('app.bootstrap.failedBody')}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
        >
          {t('app.bootstrap.retry')}
        </button>
      </section>
    </main>
  );
}

export default function App() {
  const bootstrap = useBootstrap();
  const qc = useMemo(makeQueryClient, []);

  useEffect(() => {
    installSessionRecovery();
    return () => setSessionExpiryHandler(null);
  }, []);

  if (bootstrap.status === 'idle' || bootstrap.status === 'exchanging') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loading label={t('app.bootstrap.establishing')} />
      </main>
    );
  }

  if (bootstrap.status === 'failed') {
    return <BootstrapFailure onRetry={bootstrap.retry} />;
  }

  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <ScrollToTop />
        <ShellRoutes />
        <Toaster position="bottom-right" />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
