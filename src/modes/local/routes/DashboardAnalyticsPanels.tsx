// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMemo } from 'react';
import { Activity, ArrowRight } from 'lucide-react';
import { t } from '@shared/i18n';
import { EmptyState } from '@shared/components/EmptyState';
import { Panel, Badge, agentMeta } from '@shared/components/ui';
import type { AgentSummary, EventRecord, SSEEvent } from '@shared/schemas';
import { agentFromPath } from '../lib/events/labels';

const SYNC_EVENT_LIMIT = 200;
const ARTIFACT_BUCKETS = ['conversation', 'memory', 'tool', 'skill', 'other'] as const;
const DIRECTION_BUCKETS = ['inbound', 'outbound'] as const;
const CHART_COLORS: Record<ArtifactBucket | DirectionBucket, string> = {
  conversation: 'rgb(var(--color-accent))',
  memory: 'rgb(var(--color-info))',
  tool: 'rgb(var(--color-success))',
  skill: 'rgb(var(--color-warning))',
  other: 'rgb(var(--color-neutral))',
  inbound: 'rgb(var(--color-idle))',
  outbound: 'rgb(var(--color-accent))',
};

interface DashboardAnalyticsPanelsProps {
  liveEvents: SSEEvent[];
  backfillEvents: EventRecord[];
  installedAgents: AgentSummary[];
}

export default function DashboardAnalyticsPanels({
  liveEvents,
  backfillEvents,
  installedAgents,
}: DashboardAnalyticsPanelsProps) {
  const analytics = useMemo(
    () => buildSyncAnalytics(liveEvents, backfillEvents, installedAgents),
    [backfillEvents, installedAgents, liveEvents],
  );
  const hasActivityRows = analytics.activityRows.length > 0;
  const hasDirectionRows = analytics.directionRows.length > 0;
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <Panel
        title={t('dashboard.analytics.agentActivity.title')}
        icon={<Activity className="h-3.5 w-3.5" aria-hidden="true" />}
        right={<Badge tone="neutral">{t('dashboard.analytics.window', { count: analytics.windowSize })}</Badge>}
        bodyClassName="min-h-[22rem]"
      >
        {!hasActivityRows ? (
          <EmptyState title={t('dashboard.analytics.empty')} />
        ) : (
          <div className="flex h-full min-h-[19rem] flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <ChartLegend keys={ARTIFACT_BUCKETS} />
              {analytics.topAgent ? (
                <span className="font-mono text-faint">
                  {t('dashboard.analytics.topAgent', {
                    agent: analytics.topAgent.agentName,
                    count: analytics.topAgent.total,
                  })}
                </span>
              ) : null}
            </div>
            <StackedBarList rows={analytics.activityRows} keys={ARTIFACT_BUCKETS} />
          </div>
        )}
      </Panel>

      <Panel
        title={t('dashboard.analytics.direction.title')}
        icon={<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
        right={<Badge tone="outline">{t('dashboard.analytics.eventsCount', { count: analytics.totalSyncEvents })}</Badge>}
        bodyClassName="min-h-[22rem]"
      >
        {!hasDirectionRows ? (
          <EmptyState title={t('dashboard.analytics.empty')} />
        ) : (
          <div className="flex h-full min-h-[19rem] flex-col gap-4">
            <ChartLegend keys={DIRECTION_BUCKETS} />
            <StackedBarList rows={analytics.directionRows} keys={DIRECTION_BUCKETS} />
          </div>
        )}
      </Panel>
    </div>
  );
}

type ArtifactBucket = (typeof ARTIFACT_BUCKETS)[number];
type DirectionBucket = (typeof DIRECTION_BUCKETS)[number];

interface SyncChartEvent {
  key: string;
  seq: number;
  timestampMs: number;
  type: string;
  agentId: string;
  targetAgentIds: string[];
  artifactKind: ArtifactBucket;
  origin: string;
}

interface ActivityChartRow extends Record<ArtifactBucket, number> {
  agentId: string;
  agentName: string;
  total: number;
}

interface DirectionChartRow extends Record<DirectionBucket, number> {
  agentId: string;
  agentName: string;
  total: number;
}

interface SyncAnalytics {
  activityRows: ActivityChartRow[];
  directionRows: DirectionChartRow[];
  topAgent?: ActivityChartRow;
  totalSyncEvents: number;
  windowSize: number;
}

function ChartLegend<T extends ArtifactBucket | DirectionBucket>({ keys }: { keys: readonly T[] }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {keys.map((key) => (
        <span key={key} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[key] }} aria-hidden="true" />
          {chartLabel(key)}
        </span>
      ))}
    </div>
  );
}

function StackedBarList<T extends ArtifactBucket | DirectionBucket>({
  rows,
  keys,
}: {
  rows: readonly (Record<T, number> & { agentId: string; agentName: string; total: number })[];
  keys: readonly T[];
}) {
  const maxTotal = Math.max(1, ...rows.map((row) => row.total));
  return (
    <div className="flex min-h-[18rem] flex-col justify-center gap-4">
      {rows.map((row) => (
        <div
          key={row.agentId}
          className="grid min-h-10 grid-cols-[6.75rem_minmax(0,1fr)_3.5rem] items-center gap-3"
        >
          <div className="truncate text-right text-xs text-muted-foreground" title={row.agentName}>
            {row.agentName}
          </div>
          <div className="relative h-5 overflow-hidden rounded-md bg-muted">
            <div
              className="flex h-full overflow-hidden rounded-md"
              style={{ width: `${Math.max(2, (row.total / maxTotal) * 100)}%` }}
              aria-label={`${row.agentName}: ${row.total}`}
            >
              {keys.map((key) => {
                const value = row[key];
                if (value <= 0) return null;
                return (
                  <span
                    key={key}
                    className="h-full"
                    title={`${chartLabel(key)}: ${value}`}
                    style={{
                      width: `${(value / row.total) * 100}%`,
                      minWidth: 3,
                      backgroundColor: CHART_COLORS[key],
                    }}
                  />
                );
              })}
            </div>
          </div>
          <div className="text-right font-mono text-xs text-faint">{row.total}</div>
        </div>
      ))}
    </div>
  );
}

function buildSyncAnalytics(
  liveEvents: SSEEvent[],
  backfillEvents: EventRecord[],
  installedAgents: AgentSummary[],
): SyncAnalytics {
  const eventsByKey = new Map<string, SyncChartEvent>();
  for (const event of liveEvents) {
    const syncEvent = syncEventFromSSE(event);
    if (syncEvent) eventsByKey.set(syncEvent.key, syncEvent);
  }
  for (const event of backfillEvents) {
    const syncEvent = syncEventFromRecord(event);
    if (syncEvent && !eventsByKey.has(syncEvent.key)) eventsByKey.set(syncEvent.key, syncEvent);
  }

  const syncEvents = [...eventsByKey.values()]
    .sort((a, b) => b.timestampMs - a.timestampMs || b.seq - a.seq)
    .slice(0, SYNC_EVENT_LIMIT);
  const installedIds = installedAgents.map((agent) => normalizeAgentId(agent.name)).filter(Boolean);
  const activityRows = new Map<string, ActivityChartRow>();
  const directionRows = new Map<string, DirectionChartRow>();

  for (const agentId of installedIds) {
    ensureActivityRow(activityRows, agentId);
    ensureDirectionRow(directionRows, agentId);
  }

  for (const event of syncEvents) {
    const sourceId = normalizeAgentId(event.agentId);
    const targets = event.targetAgentIds.map(normalizeAgentId).filter(Boolean);
    const activityIds = unique(sourceId ? [sourceId] : targets);
    for (const agentId of activityIds) {
      const row = ensureActivityRow(activityRows, agentId);
      row[event.artifactKind] += 1;
      row.total += 1;
    }

    if (event.origin === 'remote') {
      const inboundTargets = targets.length > 0 ? targets : sourceId ? [sourceId] : [];
      for (const agentId of unique(inboundTargets)) {
        const row = ensureDirectionRow(directionRows, agentId);
        row.inbound += 1;
        row.total += 1;
      }
    } else {
      if (sourceId) {
        const row = ensureDirectionRow(directionRows, sourceId);
        row.outbound += 1;
        row.total += 1;
      }
      for (const agentId of unique(targets.filter((target) => target !== sourceId))) {
        const row = ensureDirectionRow(directionRows, agentId);
        row.inbound += 1;
        row.total += 1;
      }
    }
  }

  const sortedActivityRows = [...activityRows.values()]
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total || a.agentName.localeCompare(b.agentName))
    .slice(0, 6);
  const sortedDirectionRows = [...directionRows.values()]
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total || a.agentName.localeCompare(b.agentName))
    .slice(0, 6);

  return {
    activityRows: sortedActivityRows,
    directionRows: sortedDirectionRows,
    topAgent: sortedActivityRows[0],
    totalSyncEvents: syncEvents.length,
    windowSize: SYNC_EVENT_LIMIT,
  };
}

function ensureActivityRow(rows: Map<string, ActivityChartRow>, agentId: string): ActivityChartRow {
  const id = normalizeAgentId(agentId);
  const existing = rows.get(id);
  if (existing) return existing;
  const row: ActivityChartRow = {
    agentId: id,
    agentName: agentMeta(id).name,
    total: 0,
    conversation: 0,
    memory: 0,
    tool: 0,
    skill: 0,
    other: 0,
  };
  rows.set(id, row);
  return row;
}

function ensureDirectionRow(rows: Map<string, DirectionChartRow>, agentId: string): DirectionChartRow {
  const id = normalizeAgentId(agentId);
  const existing = rows.get(id);
  if (existing) return existing;
  const row: DirectionChartRow = {
    agentId: id,
    agentName: agentMeta(id).name,
    total: 0,
    inbound: 0,
    outbound: 0,
  };
  rows.set(id, row);
  return row;
}

function syncEventFromRecord(event: EventRecord): SyncChartEvent | null {
  if (!isSyncEvent(event.type)) return null;
  const sourcePath = event.sourcePath ?? '';
  const agentId = event.agent ?? agentFromPath(sourcePath);
  return {
    key: syncEventKey(event.seq, event.type, event.timestamp),
    seq: event.seq,
    timestampMs: timestampMs(event.timestamp),
    type: event.type,
    agentId,
    targetAgentIds: event.targetAgents ?? [],
    artifactKind: normalizeArtifactKind(event.kind, sourcePath),
    origin: event.origin ?? '',
  };
}

function syncEventFromSSE(event: SSEEvent): SyncChartEvent | null {
  if (!isSyncEvent(event.kind)) return null;
  const body = bodyRecord(event.body);
  const sourcePath = stringField(body, 'sourcePath');
  const agentId = stringField(body, 'agent') || stringField(body, 'source') || stringField(body, 'adapter') || agentFromPath(sourcePath);
  return {
    key: syncEventKey(event.seq, event.kind, event.ts),
    seq: event.seq,
    timestampMs: timestampMs(event.ts),
    type: event.kind,
    agentId,
    targetAgentIds: unique([stringField(body, 'target'), ...stringArrayField(body.targetAgents)]),
    artifactKind: normalizeArtifactKind(stringField(body, 'kind'), sourcePath),
    origin: stringField(body, 'origin'),
  };
}

function isSyncEvent(kind: string): boolean {
  return kind === 'artifact.synced' || kind === 'artifact.imported';
}

function syncEventKey(seq: number, kind: string, timestamp: string): string {
  return seq > 0 ? `${seq}:${kind}` : `${kind}:${timestamp}`;
}

function bodyRecord(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

function stringField(record: Record<string, unknown>, key: string): string {
  return typeof record[key] === 'string' ? (record[key] as string) : '';
}

function stringArrayField(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function normalizeAgentId(agentId: string): string {
  return agentId.trim().toLowerCase();
}

function normalizeArtifactKind(kind: string | undefined, sourcePath: string): ArtifactBucket {
  const normalized = (kind ?? '').trim().toLowerCase();
  if (normalized === 'conversation' || sourcePath.toLowerCase().endsWith('.jsonl')) return 'conversation';
  if (normalized === 'memory' || normalized === 'memories') return 'memory';
  if (normalized === 'tool' || normalized === 'tools') return 'tool';
  if (normalized === 'skill' || normalized === 'skills') return 'skill';
  return 'other';
}

function timestampMs(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function chartLabel(key: string): string {
  switch (key) {
    case 'conversation':
      return t('dashboard.analytics.kinds.conversation');
    case 'memory':
      return t('dashboard.analytics.kinds.memory');
    case 'tool':
      return t('dashboard.analytics.kinds.tool');
    case 'skill':
      return t('dashboard.analytics.kinds.skill');
    case 'other':
      return t('dashboard.analytics.kinds.other');
    case 'inbound':
      return t('dashboard.analytics.direction.inbound');
    case 'outbound':
      return t('dashboard.analytics.direction.outbound');
    default:
      return key;
  }
}
