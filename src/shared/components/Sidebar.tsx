// SPDX-License-Identifier: AGPL-3.0-or-later
import { Fragment, useLayoutEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { NavLink } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Boxes,
  Activity,
  Route as RouteIcon,
  GitMerge,
  GitBranch,
  FolderClock,
  FolderGit2,
  DatabaseBackup,
  Settings,
  Share2,
  Cloud,
  LifeBuoy,
  X,
} from 'lucide-react';
import { t } from '@shared/i18n';
import { cn } from '@shared/lib/utils';
import { useSidebar } from '@shared/stores/sidebar';
import { BrandMark } from './BrandMark';
import { Badge } from './ui';

export interface NavEntry {
  to: string;
  /** i18n key (preferred) or already-resolved label. */
  label: string;
  end?: boolean;
  /** Optional lucide icon. */
  icon?: LucideIcon;
  /** Optional group key (i18n) used to render section headers. */
  group?: string;
  /**
   * Optional count pill shown next to the label. Rendered only when > 0.
   * Mode-specific data (e.g. the local-mode pending-projects count) is
   * injected by the mode's App, so this shared component never reaches into
   * a mode's hooks. `badgeAriaLabel` provides an accessible description.
   */
  badge?: number;
  /** Accessible label for the badge, e.g. "3 pending projects". */
  badgeAriaLabel?: string;
}

export const LOCAL_ITEMS: NavEntry[] = [
  { to: '/', label: 'nav.dashboard', end: true, icon: LayoutDashboard, group: 'nav.group.overview' },
  { to: '/agents', label: 'nav.agents', icon: Boxes, group: 'nav.group.overview' },
  { to: '/events', label: 'nav.events', icon: Activity, group: 'nav.group.overview' },
  { to: '/rules', label: 'nav.rules', icon: RouteIcon, group: 'nav.group.sync' },
  { to: '/conflicts', label: 'nav.conflicts', icon: GitMerge, group: 'nav.group.sync' },
  { to: '/forking', label: 'nav.forking', icon: GitBranch, group: 'nav.group.sync' },
  { to: '/projects', label: 'nav.projects', icon: FolderGit2, group: 'nav.group.sync' },
  { to: '/pending', label: 'nav.pending', icon: FolderClock, group: 'nav.group.sync' },
  { to: '/connect', label: 'nav.connect', icon: Cloud, group: 'nav.group.sync' },
  { to: '/backups', label: 'nav.backups', icon: DatabaseBackup, group: 'nav.group.system' },
  { to: '/settings', label: 'nav.settings', end: true, icon: Settings, group: 'nav.group.system' },
  { to: '/settings/transport', label: 'nav.transport', icon: Share2, group: 'nav.group.system' },
  { to: '/help', label: 'nav.help', icon: LifeBuoy, group: 'nav.group.system' },
];

function NavItem({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavEntry;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const label = t(item.label);
  const Icon = item.icon;
  const count = item.badge ?? 0;
  const showBadge = count > 0;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
          collapsed && 'sm:justify-center sm:px-0',
          isActive
            ? 'bg-accent/12 text-accent'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              aria-hidden="true"
              className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent"
            />
          )}
          {Icon ? (
            <span className="relative shrink-0">
              <Icon
                className={cn('h-[1.05rem] w-[1.05rem]', isActive ? 'text-accent' : 'text-faint group-hover:text-foreground')}
                aria-hidden="true"
              />
              {collapsed && showBadge ? (
                <span
                  aria-label={item.badgeAriaLabel}
                  className="absolute -right-1.5 -top-1.5 hidden min-w-[1rem] items-center justify-center rounded-full bg-accent px-1 text-[0.6rem] font-semibold leading-4 text-accent-foreground sm:inline-flex"
                >
                  {count}
                </span>
              ) : null}
            </span>
          ) : null}
          <span className={cn('truncate', collapsed && 'sm:hidden')}>{label}</span>
          {showBadge ? (
            <Badge
              tone="accent"
              aria-label={item.badgeAriaLabel}
              className={cn('ml-auto px-1.5 py-0 leading-5', collapsed && 'sm:hidden')}
            >
              {count}
            </Badge>
          ) : null}
        </>
      )}
    </NavLink>
  );
}

/**
 * Grouped, icon-led sidebar. Renders section eyebrow
 * headers when items carry a `group`, otherwise falls back to a flat list.
 */
export function Sidebar({
  items,
  isMobile = false,
  mobileOpen = false,
  onMobileClose,
}: {
  items?: NavEntry[];
  isMobile?: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
} = {}) {
  const collapsed = useSidebar((s) => s.collapsed);
  const list = items ?? LOCAL_ITEMS;
  const sidebarRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (isMobile && mobileOpen) closeButtonRef.current?.focus({ preventScroll: true });
  }, [isMobile, mobileOpen]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (!isMobile || !mobileOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      onMobileClose?.();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(
      sidebarRef.current?.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter((element) => element.tabIndex >= 0);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  // Build ordered groups (preserve first-seen order).
  const groups: { key: string | undefined; items: NavEntry[] }[] = [];
  for (const item of list) {
    const last = groups[groups.length - 1];
    if (last && last.key === item.group) last.items.push(item);
    else groups.push({ key: item.group, items: [item] });
  }

  return (
    <aside
      ref={sidebarRef}
      id="aplexica-sidebar"
      className={cn(
        'fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col border-r border-border bg-surface/95 backdrop-blur-sm transition-[transform,width] duration-200 ease-out sm:static sm:z-auto sm:translate-x-0 sm:bg-surface/60',
        mobileOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0',
        collapsed ? 'sm:w-16' : 'sm:w-60',
      )}
      aria-label={t('app.title')}
      role={isMobile && mobileOpen ? 'dialog' : undefined}
      aria-modal={isMobile && mobileOpen ? 'true' : undefined}
      aria-hidden={isMobile && !mobileOpen ? 'true' : undefined}
      inert={isMobile && !mobileOpen ? true : undefined}
      onKeyDown={onKeyDown}
    >
      <div className={cn('flex h-14 items-center gap-2.5 border-b border-border px-3 text-foreground', collapsed && 'sm:justify-center sm:px-0')}>
        <BrandMark size={26} />
        <span className={cn('font-mono text-[0.95rem] font-medium uppercase tracking-tight text-foreground', collapsed && 'sm:hidden')}>
          {t('app.title')}
        </span>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onMobileClose}
          aria-label={t('topbar.menuClose')}
          className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:hidden"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        {groups.map((g, gi) => (
          <Fragment key={g.key ?? gi}>
            {g.key ? (
              <>
                <p className={cn('px-2.5 pb-1 pt-3 text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-faint first:pt-1', collapsed && 'sm:hidden')}>
                  {t(g.key)}
                </p>
                {collapsed && gi > 0 ? <div className="my-2 hidden border-t border-border/60 sm:block" /> : null}
              </>
            ) : gi > 0 ? (
              <div className="my-2 border-t border-border/60" />
            ) : null}
            <div className="flex flex-col gap-0.5">
              {g.items.map((item) => (
                <NavItem key={item.to} item={item} collapsed={collapsed} onNavigate={isMobile ? onMobileClose : undefined} />
              ))}
            </div>
          </Fragment>
        ))}
      </nav>
    </aside>
  );
}
