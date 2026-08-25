// SPDX-License-Identifier: AGPL-3.0-or-later
import { Link } from 'react-router';
import { Boxes, Layers, ChevronRight } from 'lucide-react';
import type { AgentSummary } from '@shared/schemas';
import { t } from '@shared/i18n';
import { cn } from '@shared/lib/utils';
import { Loading } from '@shared/components/Loading';
import { EmptyState } from '@shared/components/EmptyState';
import {
  PageHeader,
  Panel,
  Badge,
  AgentGlyph,
  AgentStatusBadge,
  VersionTag,
  agentMeta,
} from '@shared/components/ui';
import { formatRelative } from '@shared/lib/time';
import { useAgents } from '../hooks/useAgents';
import { useSetAgentSync, useSetSyncAll, useSyncState } from '../hooks/useSync';

export default function AgentsPage() {
  const { data, isLoading, error } = useAgents();
  const syncState = useSyncState();
  const setAll = useSetSyncAll();
  const setAgent = useSetAgentSync();
  const list = data ?? [];
  const installed = list.filter((a) => a.installed !== false);
  const notInstalled = list.filter((a) => a.installed === false);
  const allOn = syncState.data?.all ?? false;

  const onToggleAgent = (name: string, enabled: boolean) => setAgent.mutate({ name, enabled });

  return (
    <div className="apx-rise flex flex-col gap-6">
      <PageHeader
        icon={<Boxes className="h-5 w-5" aria-hidden="true" />}
        title={t('agents.title')}
        subtitle={t('agents.subtitle')}
        actions={
          <div className="flex items-center gap-2">
            {list.length > 0 ? (
              <Badge tone="neutral">
                <span className="font-mono text-foreground">{installed.length}</span>
                {/* muted-foreground (≈7:1 on bg-muted), not text-faint (≈3.7:1) —
                    the dim faint token fails WCAG-AA contrast on the lighter
                    neutral-badge background. */}
                <span className="text-muted-foreground">/ {list.length}</span>
                {t('agents.connected').toLowerCase()}
              </Badge>
            ) : null}
            {installed.length > 0 ? (
              <button
                type="button"
                onClick={() => setAll.mutate(!allOn)}
                disabled={setAll.isPending}
                title={t('agents.fanOut.tip')}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
              >
                {allOn ? t('agents.fanOut.disableAll') : t('agents.fanOut.enableAll')}
              </button>
            ) : null}
          </div>
        }
      />

      {isLoading ? (
        <Loading />
      ) : error ? (
        <p className="text-sm text-danger">{error instanceof Error ? error.message : t('app.error')}</p>
      ) : list.length === 0 ? (
        <EmptyState title={t('agents.empty')} />
      ) : (
        <div className="flex flex-col gap-6">
          <AgentTable
            title={t('agents.connected')}
            subtitle={t('agents.connectedSub', { count: installed.length, total: list.length })}
            rows={installed}
            onToggle={onToggleAgent}
            togglePending={setAgent.isPending}
          />
          {notInstalled.length > 0 ? (
            <AgentTable title={t('agents.notDetected')} subtitle={t('agents.notDetectedSub')} rows={notInstalled} />
          ) : null}
        </div>
      )}
    </div>
  );
}

function AgentTable({
  title,
  subtitle,
  rows,
  onToggle,
  togglePending,
}: {
  title: string;
  subtitle: string;
  rows: AgentSummary[];
  onToggle?: (name: string, enabled: boolean) => void;
  togglePending?: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <Panel
      title={title}
      icon={<Boxes className="h-3.5 w-3.5" aria-hidden="true" />}
      right={<span className="text-xs font-normal normal-case tracking-normal text-faint">{subtitle}</span>}
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-border">
        {rows.map((a) => (
          <AgentRow key={a.name} agent={a} onToggle={onToggle} togglePending={togglePending} />
        ))}
      </ul>
    </Panel>
  );
}

function AgentRow({
  agent,
  onToggle,
  togglePending,
}: {
  agent: AgentSummary;
  onToggle?: (name: string, enabled: boolean) => void;
  togglePending?: boolean;
}) {
  const meta = agentMeta(agent.name);
  const installed = agent.installed !== false;
  const href = `/agents/${encodeURIComponent(agent.name)}`;
  const fanOutOn = agent.syncEnabled ?? false;

  const inner = (
    <div className={cn('flex items-center gap-4 px-4 py-3', !installed && 'opacity-70')}>
      <AgentGlyph id={agent.name} muted={!installed} />
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-medium', installed ? 'text-foreground' : 'text-muted-foreground')}>
          {meta.name}
        </p>
        <p className="truncate text-xs text-faint">{meta.blurb}</p>
      </div>

      <div className="hidden shrink-0 md:block">
        <AgentStatusBadge installed={installed} syncState={agent.syncState} />
      </div>

      {installed ? (
        <div className="hidden w-24 shrink-0 items-center gap-1.5 text-xs text-muted-foreground lg:flex">
          <Layers className="h-3.5 w-3.5 text-faint" aria-hidden="true" />
          <span className="font-mono text-foreground">{agent.artifactCount ?? 0}</span>
          <span>{t('agents.artifacts')}</span>
        </div>
      ) : (
        <div className="hidden w-24 shrink-0 lg:block" />
      )}

      <div className="hidden shrink-0 xl:flex">
        <VersionTag label={t('agents.adapterVersion')} value={agent.version} tip={t('agents.adapterVersionTip')} />
      </div>

      <div className="hidden w-28 shrink-0 text-right font-mono text-xs text-faint sm:block">
        {installed ? formatRelative(agent.lastActivity) : ''}
      </div>

      {installed && onToggle ? (
        <button
          type="button"
          // The whole row is a <Link>; keep the toggle from navigating.
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggle(agent.name, !fanOutOn);
          }}
          disabled={togglePending}
          aria-pressed={fanOutOn}
          title={t('agents.fanOut.tip')}
          className={cn(
            'shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60',
            fanOutOn
              ? 'border-accent/40 bg-accent/10 text-accent hover:bg-accent/20'
              : 'border-border text-muted-foreground hover:bg-muted',
          )}
        >
          {fanOutOn ? t('agents.fanOut.on') : t('agents.fanOut.off')}
        </button>
      ) : null}

      {installed ? (
        <ChevronRight className="h-4 w-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent" aria-hidden="true" />
      ) : (
        <span className="h-4 w-4 shrink-0" />
      )}
    </div>
  );

  if (!installed) {
    return <li>{inner}</li>;
  }
  return (
    <li>
      <Link to={href} className="group block transition-colors hover:bg-muted/40 focus:bg-muted/40 focus:outline-none">
        {inner}
      </Link>
    </li>
  );
}
