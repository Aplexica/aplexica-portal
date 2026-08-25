// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMemo, useState } from 'react';
import { t } from '@shared/i18n';
import { Loading } from '@shared/components/Loading';
import { EmptyState } from '@shared/components/EmptyState';
import { useEventStream } from '../lib/events/sse';
import {
  agentsForBody,
  agentsForRecord,
  describeEventRecord,
  describeSSEEvent,
} from '../lib/events/labels';
import { useEventsBackfill } from '../hooks/useEvents';
import { formatTimestamp } from '../lib/format';
import { EVENT_KINDS, type EventRecord } from '@shared/schemas';

const ALL = '__all__';

export default function EventsPage() {
  const [kindFilter, setKindFilter] = useState<string>(ALL);
  const [agentFilter, setAgentFilter] = useState<string>(ALL);
  const [collapse, setCollapse] = useState(true);

  const live = useEventStream({ limit: 500 });
  const backfill = useEventsBackfill();

  // Agent dropdown options = the agents that actually appear in the loaded
  // events (so the list reflects real activity, not every installed agent).
  const agentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of backfill.data?.pages ?? []) {
      for (const e of p.events) {
        for (const agent of agentsForRecord(e)) set.add(agent);
      }
    }
    for (const e of live.events) {
      for (const agent of agentsForBody(e.body)) set.add(agent);
    }
    return [...set].sort();
  }, [backfill.data, live.events]);

  const liveFiltered = useMemo(() => {
    let evs = live.events;
    if (kindFilter !== ALL) evs = evs.filter((e) => e.kind === kindFilter);
    if (agentFilter !== ALL) evs = evs.filter((e) => agentsForBody(e.body).includes(agentFilter));
    return evs;
  }, [kindFilter, agentFilter, live.events]);

  // When "Collapse repeats" is on, fold a run of consecutive identical live
  // frames (same kind + same rendered label) into ONE row carrying a repeat
  // count. An active agent emits an `agent.activity` ping on every import, so
  // without this the stream grows by a row a second; collapsed, it's a single
  // row whose count ticks up. live.events is newest-first, so the kept
  // representative is the most-recent frame of each run.
  const liveRows = useMemo(() => {
    if (!collapse) {
      return liveFiltered.map((e) => ({ e, count: 1, display: describeSSEEvent(e) }));
    }
    const out: { e: (typeof liveFiltered)[number]; count: number; display: ReturnType<typeof describeSSEEvent> }[] = [];
    let prevKey: string | null = null;
    for (const e of liveFiltered) {
      const display = describeSSEEvent(e);
      const key = `${e.kind}|${display.title}|${display.meta.join('|')}`;
      if (key === prevKey && out.length > 0) {
        out[out.length - 1].count += 1;
      } else {
        out.push({ e, count: 1, display });
        prevKey = key;
      }
    }
    return out;
  }, [collapse, liveFiltered]);

  const backfillFlat = useMemo(() => {
    const all = (backfill.data?.pages ?? []).flatMap((p) => p.events);
    let evs = kindFilter === ALL ? all : all.filter((e) => e.type === kindFilter);
    if (agentFilter !== ALL) evs = evs.filter((e) => agentsForRecord(e).includes(agentFilter));
    if (collapse) {
      // Collapse to one row per artifact: keep the most-recent event,
      // newest first. Cuts the noise of an artifact re-synced many times.
      const byArtifact = new Map<string, EventRecord>();
      for (const e of evs) {
        const key = e.artifactId ?? `seq-${e.seq}`;
        const prev = byArtifact.get(key);
        if (!prev || e.seq > prev.seq) byArtifact.set(key, e);
      }
      evs = [...byArtifact.values()].sort((a, b) => b.seq - a.seq);
    }
    return evs;
  }, [kindFilter, agentFilter, collapse, backfill.data]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('events.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('events.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="sr-only">{t('events.filterAll')}</span>
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
              aria-label={t('events.filterAll')}
            >
              <option value={ALL}>{t('events.filterAll')}</option>
              {EVENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`events.kinds.${k}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="sr-only">{t('events.filterAgent')}</span>
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
              aria-label={t('events.filterAgent')}
            >
              <option value={ALL}>{t('events.allAgents')}</option>
              {agentOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
            title={t('events.collapseTip')}
          >
            <input
              type="checkbox"
              checked={collapse}
              onChange={(e) => setCollapse(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            {t('events.collapse')}
          </label>
          <span
            className={[
              'rounded px-2 py-0.5 text-xs',
              live.state === 'open'
                ? 'bg-accent/20 text-accent'
                : live.state === 'reconnecting' || live.state === 'connecting'
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-destructive/20 text-destructive',
            ].join(' ')}
            aria-live="polite"
          >
            {live.state === 'open'
              ? t('events.live')
              : live.state === 'reconnecting' || live.state === 'connecting'
                ? t('events.reconnecting')
                : t('events.disconnected')}
          </span>
        </div>
      </header>

      <section className="rounded-md border border-border bg-background p-4">
        {liveRows.length === 0 && backfillFlat.length === 0 && !backfill.isLoading ? (
          <EmptyState title={t('events.empty')} />
        ) : (
          <ul className="flex flex-col divide-y divide-border text-sm">
            {liveRows.map(({ e, count, display }) => (
              <li key={`live-${e.kind}-${e.seq}-${e.ts}`} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-start">
                <div className="flex min-w-0 flex-1 items-start gap-2">
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[11px] text-accent">
                      {t('events.live')}
                    </span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      {display.typeLabel}
                    </span>
                    {display.artifactKindLabel ? (
                      <span className="rounded bg-muted/70 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {display.artifactKindLabel}
                      </span>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="break-words text-sm text-foreground">{display.title}</span>
                      {count > 1 ? (
                        <span
                          className="rounded bg-muted px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground"
                          title={t('events.repeatCount', { count })}
                        >
                          x{count}
                        </span>
                      ) : null}
                    </div>
                    {display.meta.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {display.meta.map((m) => (
                          <span key={m} className="break-all">
                            {m}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground sm:ml-auto">{formatTimestamp(e.ts)}</span>
              </li>
            ))}
            {backfillFlat.map((e) => {
              const display = describeEventRecord(e);
              return (
                <li key={`hist-${e.seq}`} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-start">
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {display.typeLabel}
                      </span>
                      {display.artifactKindLabel ? (
                        <span className="rounded bg-muted/70 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          {display.artifactKindLabel}
                        </span>
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="break-words text-sm text-foreground">{display.title}</span>
                      {display.meta.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {display.meta.map((m) => (
                            <span key={m} className="break-all">
                              {m}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground sm:ml-auto">
                    {formatTimestamp(e.timestamp)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {backfill.isLoading ? <Loading /> : null}
        {backfill.hasNextPage ? (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => void backfill.fetchNextPage()}
              disabled={backfill.isFetchingNextPage}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-60"
            >
              {t('events.loadMore')}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
