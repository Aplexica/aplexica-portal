// SPDX-License-Identifier: AGPL-3.0-or-later
import { forwardRef } from 'react';
import { PanelLeft, Search, LogOut } from 'lucide-react';
import { t } from '@shared/i18n';
import { DeployModeBadge } from './DeployModeBadge';

export const Topbar = forwardRef<HTMLButtonElement, {
  onLogout?: () => void;
  onMenuToggle: () => void;
  menuExpanded: boolean;
}>(function Topbar({ onLogout, onMenuToggle, menuExpanded }, menuButtonRef) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md">
      <button
        ref={menuButtonRef}
        type="button"
        onClick={onMenuToggle}
        aria-label={t('topbar.menuToggle')}
        aria-controls="aplexica-sidebar"
        aria-expanded={menuExpanded}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <PanelLeft className="h-4 w-4" aria-hidden="true" />
      </button>

      <label className="relative hidden flex-1 sm:block">
        <span className="sr-only">{t('topbar.search')}</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden="true" />
        <input
          type="search"
          disabled
          placeholder={t('topbar.searchPlaceholder')}
          className="w-full max-w-sm rounded-md border border-border bg-surface/60 py-1.5 pl-9 pr-3 text-sm text-foreground placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed"
        />
      </label>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <DeployModeBadge />
        {onLogout ? (
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            {t('topbar.logout')}
          </button>
        ) : null}
      </div>
    </header>
  );
});
