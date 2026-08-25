// SPDX-License-Identifier: AGPL-3.0-or-later
import { lazy, Suspense, useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  LayoutDashboard,
  Tag,
  Cpu,
  Clock,
  Inbox,
  Pause,
  Play,
  ArrowRight,
  Activity,
  Boxes,
} from 'lucide-react';
import { t } from '@shared/i18n';
import { Loading } from '@shared/components/Loading';
import { EmptyState } from '@shared/components/EmptyState';
import {
  PageHeader,
  Panel,
  StatTile,
  Badge,
  StatusDot,
  AgentCard,
  type StatusTone,
} from '@shared/components/ui';
import { formatRelative } from '@shared/lib/time';
import { useDaemon, usePauseDaemon, useResumeDaemon } from '../hooks/useDaemon';
import { useAgents } from '../hooks/useAgents';
import { useEventsBackfill } from '../hooks/useEvents';
import { useEventStream } from '../lib/events/sse';
import { describeSSEEvent } from '../lib/events/labels';
import { formatUptime } from '../lib/format';

const DashboardAnalyticsPanels = lazy(() => import('./DashboardAnalyticsPanels'));

const PRIMARY_BTN =
  'inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground transition-colors hover:bg-accent-strong disabled:opacity-60';
const GHOST_BTN =
  'inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60';
const SYNC_EVENT_LIMIT = 200;

function daemonState(paused: boolean, state: string): { tone: StatusTone; label: string } {
  if (paused) return { tone: 'warning', label: t('dashboard.daemon.paused') };
  if (state === 'active') return { tone: 'success', label: t('agentStatus.active.label') };
  return { tone: 'idle', label: t('agentStatus.idle.label') };
}

export default function DashboardPage() {
  const daemon = useDaemon();
  const agents = useAgents();
  const stream = useEventStream({ limit: SYNC_EVENT_LIMIT });
  const eventHistory = useEventsBackfill();
  const pause = usePauseDaemon();
  const resume = useResumeDaemon();

  const installed = useMemo(
    () => (agents.data ?? []).filter((a) => a.installed !== false),
    [agents.data],
  );
  const backfillEvents = useMemo(
    () => eventHistory.data?.pages.flatMap((page) => page.events) ?? [],
    [eventHistory.data?.pages],
  );

  return (
    <div className="apx-rise flex flex-col gap-6">
      <PageHeader
        icon={<LayoutDashboard className="h-5 w-5" aria-hidden="true" />}
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
      />

      {/* Daemon */}
      <Panel
        title={t('dashboard.daemon.title')}
        icon={<Activity className="h-3.5 w-3.5" aria-hidden="true" />}
        right={
          daemon.data ? (
            daemon.data.paused ? (
              <button type="button" onClick={() => resume.mutate()} disabled={resume.isPending} className={PRIMARY_BTN}>
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
                {t('dashboard.daemon.resume')}
              </button>
            ) : (
              <button type="button" onClick={() => pause.mutate()} disabled={pause.isPending} className={GHOST_BTN}>
                <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                {t('dashboard.daemon.pause')}
              </button>
            )
          ) : null
        }
      >
        {daemon.isLoading ? (
          <Loading />
        ) : daemon.error || !daemon.data ? (
          <p className="text-sm text-danger">
            {daemon.error instanceof Error ? daemon.error.message : t('app.error')}
          </p>
        ) : (
          (() => {
            const ds = daemonState(daemon.data.paused, daemon.data.state);
            return (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
                <StatTile label={t('dashboard.daemon.version')} value={`v${daemon.data.version.replace(/^v/, '')}`} icon={<Tag className="h-3 w-3" aria-hidden="true" />} />
                <StatTile label={t('dashboard.daemon.pid')} value={String(daemon.data.pid)} icon={<Cpu className="h-3 w-3" aria-hidden="true" />} />
                <StatTile
                  label={t('dashboard.daemon.state')}
                  mono={false}
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <StatusDot tone={ds.tone} pulse={ds.tone === 'success'} size="sm" />
                      {ds.label}
                    </span>
                  }
                />
                <StatTile label={t('dashboard.daemon.uptime')} value={formatUptime(daemon.data.uptime)} icon={<Clock className="h-3 w-3" aria-hidden="true" />} />
                <StatTile label={t('dashboard.daemon.pendingImports')} value={String(daemon.data.pendingImports)} icon={<Inbox className="h-3 w-3" aria-hidden="true" />} />
              </div>
            );
          })()
        )}
      </Panel>

      <Suspense fallback={<AnalyticsLoading />}>
        <DashboardAnalyticsPanels
          liveEvents={stream.events}
          backfillEvents={backfillEvents}
          installedAgents={installed}
        />
      </Suspense>

      {/* Agents */}
      <Panel
        title={t('dashboard.agents.title')}
        icon={<Boxes className="h-3.5 w-3.5" aria-hidden="true" />}
        right={
          installed.length > 0 ? (
            <Badge tone="neutral">
              <span className="font-mono text-foreground">{installed.length}</span>
              {t('agents.connected').toLowerCase()}
            </Badge>
          ) : null
        }
      >
        {agents.isLoading ? (
          <Loading />
        ) : installed.length === 0 ? (
          <EmptyState title={t('dashboard.agents.none')} />
        ) : (
          <AgentGrid>
            {installed.map((a) => (
              <AgentCard key={a.name} agent={a} href={`/agents/${encodeURIComponent(a.name)}`} />
            ))}
          </AgentGrid>
        )}
      </Panel>

      {/* Recent activity */}
      <Panel
        title={t('dashboard.events.title')}
        icon={<Activity className="h-3.5 w-3.5" aria-hidden="true" />}
        right={
          <Link to="/events" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
            {t('common.viewAll')}
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        }
      >
        {stream.events.length === 0 ? (
          <EmptyState title={t('dashboard.events.none')} />
        ) : (
          <ul className="divide-y divide-border">
            {stream.events.slice(0, 8).map((e) => (
              <RecentEventRow key={`${e.seq}-${e.ts}`} event={e} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function AnalyticsLoading() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <Panel
        title={t('dashboard.analytics.agentActivity.title')}
        icon={<Activity className="h-3.5 w-3.5" aria-hidden="true" />}
        bodyClassName="min-h-[22rem]"
      >
        <Loading />
      </Panel>

      <Panel
        title={t('dashboard.analytics.direction.title')}
        icon={<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
        bodyClassName="min-h-[22rem]"
      >
        <Loading />
      </Panel>
    </div>
  );
}

function RecentEventRow({ event }: { event: ReturnType<typeof useEventStream>['events'][number] }) {
  const display = describeSSEEvent(event);
  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <StatusDot tone="idle" size="sm" />
      <Badge tone="outline">{display.typeLabel}</Badge>
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{display.title}</span>
      <span className="shrink-0 font-mono text-xs text-faint">{formatRelative(event.ts)}</span>
    </li>
  );
}

function AgentGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}
