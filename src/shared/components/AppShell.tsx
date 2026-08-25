// SPDX-License-Identifier: AGPL-3.0-or-later
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Sidebar, type NavEntry } from './Sidebar';
import { Topbar } from './Topbar';
import { ErrorBoundary } from './ErrorBoundary';
import { useSidebar } from '@shared/stores/sidebar';

const mobileNavigationQuery = '(max-width: 639px)';

/**
 * Application shell for the sidebar, topbar, and local routes.
 */
export function AppShell({
  children,
  onLogout,
  navItems,
}: {
  children: ReactNode;
  onLogout?: () => void;
  navItems?: NavEntry[];
}) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(mobileNavigationQuery).matches
      : false,
  );
  const collapsed = useSidebar((state) => state.collapsed);
  const toggleSidebar = useSidebar((state) => state.toggle);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(mobileNavigationQuery);
    const update = () => {
      setIsMobile(query.matches);
      if (!query.matches) setMobileNavigationOpen(false);
    };
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const closeMobileNavigation = useCallback(() => {
    setMobileNavigationOpen(false);
    const restoreFocus = () => menuButtonRef.current?.focus({ preventScroll: true });
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(restoreFocus);
    else restoreFocus();
  }, []);

  const toggleNavigation = () => {
    if (isMobile) setMobileNavigationOpen((open) => !open);
    else toggleSidebar();
  };

  return (
    <div className="flex h-screen min-h-screen flex-col bg-background text-foreground antialiased">
      <div className="flex min-h-0 flex-1">
        <Sidebar
          items={navItems}
          isMobile={isMobile}
          mobileOpen={mobileNavigationOpen}
          onMobileClose={closeMobileNavigation}
        />
        {isMobile && mobileNavigationOpen ? (
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-black/50 sm:hidden"
            onClick={closeMobileNavigation}
          />
        ) : null}
        <div
          className="flex min-w-0 flex-1 flex-col"
          inert={isMobile && mobileNavigationOpen ? true : undefined}
        >
          <Topbar
            ref={menuButtonRef}
            onLogout={onLogout}
            onMenuToggle={toggleNavigation}
            menuExpanded={isMobile ? mobileNavigationOpen : !collapsed}
          />
          <main className="flex-1 overflow-auto">
            <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-7">
              <ErrorBoundary>{children}</ErrorBoundary>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
