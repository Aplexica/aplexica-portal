// SPDX-License-Identifier: AGPL-3.0-or-later
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { t } from '@shared/i18n';

interface State {
  error: Error | null;
}

interface Props {
  fallback?: (error: Error, reset: () => void) => ReactNode;
  children: ReactNode;
}

/**
 * Local-mode error boundary. Used at the App level to keep a runaway
 * render error in one route from blanking the whole shell.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
      return (
        <div className="rounded-md border border-destructive bg-destructive/10 p-4">
          <p className="text-sm font-medium text-destructive">{t('app.error')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{this.state.error.message}</p>
          <button
            type="button"
            onClick={this.reset}
            className="mt-3 rounded border border-border bg-background px-3 py-1 text-xs font-medium hover:bg-muted"
          >
            {t('app.errorRetry')}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
