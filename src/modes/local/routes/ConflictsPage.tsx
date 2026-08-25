// SPDX-License-Identifier: AGPL-3.0-or-later
import { Link } from 'react-router';
import { t } from '@shared/i18n';
import { Loading } from '@shared/components/Loading';
import { EmptyState } from '@shared/components/EmptyState';
import { useConflicts } from '../hooks/useConflicts';

export default function ConflictsPage() {
  const { data, isLoading, error } = useConflicts();
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">{t('conflicts.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('conflicts.subtitle')}</p>
      </header>
      {isLoading ? (
        <Loading />
      ) : error ? (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : t('app.error')}
        </p>
      ) : !data || data.length === 0 ? (
        <EmptyState title={t('conflicts.empty')} body={t('conflicts.emptyBody')} />
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-4 font-medium">{t('conflicts.columns.artifactId')}</th>
              <th className="py-2 pr-4 font-medium">{t('conflicts.columns.kind')}</th>
              <th className="py-2 pr-4 font-medium">{t('conflicts.columns.heads')}</th>
              <th className="py-2 pr-4 font-medium">{t('conflicts.columns.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c) => {
              const hasReadableTitle = Boolean(c.title?.trim());
              return (
                <tr key={c.artifactId} className="border-b border-border last:border-b-0 hover:bg-muted/40">
                  <td className="max-w-0 py-2 pr-4">
                    <div className="min-w-0">
                      <div className={hasReadableTitle ? 'truncate text-sm font-medium' : 'truncate font-mono text-xs'}>
                        {hasReadableTitle ? c.title : c.artifactId}
                      </div>
                      {c.description ? (
                        <div className="mt-1 truncate text-xs text-muted-foreground">{c.description}</div>
                      ) : null}
                      {hasReadableTitle ? (
                        <div className="mt-1 truncate font-mono text-[11px] text-faint">{c.artifactId}</div>
                      ) : null}
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground">{c.kind}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{c.heads.length}</td>
                  <td className="py-2 pr-4">
                    <Link
                      to={`/conflicts/${encodeURIComponent(c.artifactId)}`}
                      className="text-accent hover:underline"
                    >
                      {t('common.edit')} →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
