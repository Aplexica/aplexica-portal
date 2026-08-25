// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeft, Layers, Clock, FolderGit2, Boxes, Activity } from 'lucide-react';
import { t } from '@shared/i18n';
import { Loading } from '@shared/components/Loading';
import { EmptyState } from '@shared/components/EmptyState';
import {
  Panel,
  Badge,
  AgentGlyph,
  AgentStatusBadge,
  VersionTag,
  agentMeta,
} from '@shared/components/ui';
import { formatRelative } from '@shared/lib/time';
import { useAgent } from '../hooks/useAgents';
import { useProjects, useRemoveProject } from '../hooks/useProjects';
import { formatTimestamp } from '../lib/format';

export default function AgentDetailPage() {
  const { name } = useParams<{ name: string }>();
  const { data, isLoading, error } = useAgent(name);
  const { data: projects } = useProjects();
  const remove = useRemoveProject();
  const meta = agentMeta(name ?? '');
  const installed = data ? data.installed !== false : true;

  // Which watched-location rows are removable projects (vs the agent's native
  // storage roots), keyed by absolute path → project id.
  const projectIdByPath = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects ?? []) m.set(p.path, p.id);
    return m;
  }, [projects]);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const doRemove = async (id: string) => {
    try {
      await remove.mutateAsync(id);
      toast.success(t('projects.toast.removed'));
      setRemovingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('projects.toast.removeError'));
    }
  };

  return (
    <div className="apx-rise flex flex-col gap-6">
      <Link
        to="/agents"
        className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        {t('agents.detail.back')}
      </Link>

      {isLoading ? (
        <Loading />
      ) : error ? (
        <p className="text-sm text-danger">{error instanceof Error ? error.message : t('app.error')}</p>
      ) : !data ? (
        <EmptyState title={t('app.empty')} />
      ) : (
        <>
          <header className="flex flex-wrap items-start justify-between gap-4 rounded-md border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <AgentGlyph id={data.name} size="lg" muted={!installed} />
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">{meta.name}</h1>
                <p className="mt-0.5 text-sm text-muted-foreground">{meta.blurb || data.name}</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <AgentStatusBadge installed={installed} syncState={data.syncState} />
                  {installed ? (
                    <>
                      <Badge tone="neutral">
                        <Layers className="h-3.5 w-3.5 text-faint" aria-hidden="true" />
                        <span className="font-mono text-foreground">{data.artifactCount ?? 0}</span>
                        {t('agents.artifacts')}
                      </Badge>
                      <span className="inline-flex items-center gap-1.5 text-xs text-faint">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        {formatRelative(data.lastActivity)}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <VersionTag label={t('agents.adapterVersion')} value={data.version} tip={t('agents.adapterVersionTip')} />
              <VersionTag label={t('agents.agentVersion')} value={null} tip={t('agents.agentVersionTip')} />
            </div>
          </header>

          {Array.isArray(data.globalRoots) && data.globalRoots.length > 0 ? (
            <Panel title={t('agents.detail.globalRoots')} icon={<FolderGit2 className="h-3.5 w-3.5" aria-hidden="true" />}>
              <ul className="flex flex-col gap-1.5">
                {data.globalRoots.map((root) => {
                  const projectId = projectIdByPath.get(root);
                  const confirming = projectId != null && removingId === projectId;
                  return (
                    <li
                      key={root}
                      className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-raised/40 px-3 py-2 text-xs"
                    >
                      <span className="truncate font-mono text-foreground">{root}</span>
                      {projectId == null ? (
                        <span className="shrink-0 text-faint">{t('agents.detail.nativeRoot')}</span>
                      ) : confirming ? (
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="text-muted-foreground">{t('projects.remove.confirm')}</span>
                          <button
                            type="button"
                            onClick={() => void doRemove(projectId)}
                            disabled={remove.isPending}
                            className="rounded-md bg-destructive px-2 py-0.5 font-medium text-white hover:opacity-90 disabled:opacity-60"
                          >
                            {t('projects.remove.yes')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setRemovingId(null)}
                            className="rounded-md border border-border bg-background px-2 py-0.5 hover:bg-muted"
                          >
                            {t('projects.remove.no')}
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRemovingId(projectId)}
                          className="shrink-0 rounded-md border border-border bg-background px-2 py-0.5 text-destructive hover:bg-muted"
                        >
                          {t('projects.remove.button')}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Panel>
          ) : null}

          <Panel title={t('agents.detail.namespaces')} icon={<Boxes className="h-3.5 w-3.5" aria-hidden="true" />}>
            {data.namespaces.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('agents.detail.noNamespaces')}</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {data.namespaces.map((ns) => (
                  <li key={ns}>
                    <Badge tone="accent">{ns}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={t('agents.detail.recentEvents')} icon={<Activity className="h-3.5 w-3.5" aria-hidden="true" />}>
            {data.recentEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('agents.detail.noEvents')}</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.recentEvents.map((ev, idx) => (
                  <li key={`${ev.timestamp}-${idx}`} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <Badge tone="outline" className="font-mono">
                      {ev.type}
                    </Badge>
                    {ev.detail ? <span className="truncate text-sm text-muted-foreground">{ev.detail}</span> : null}
                    <span className="ml-auto shrink-0 font-mono text-xs text-faint">{formatTimestamp(ev.timestamp)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
