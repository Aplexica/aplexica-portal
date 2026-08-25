// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { t } from '@shared/i18n';
import { Loading } from '@shared/components/Loading';
import { EmptyState } from '@shared/components/EmptyState';
import { useConflict, useResolveConflict } from '../hooks/useConflicts';
import {
  ResolveRequestSchema,
  type ConflictAnalysis,
  type ConflictDifference,
  type ConflictHeadAnalysis,
  type Head,
  type ResolveRequest,
} from '@shared/schemas';
import { formatTimestamp } from '../lib/format';

type Mode = 'choose' | 'manual';

export default function ConflictDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useConflict(id);
  const resolve = useResolveConflict(id ?? '');
  const [mode, setMode] = useState<Mode>('choose');

  const form = useForm<ResolveRequest>({
    resolver: zodResolver(ResolveRequestSchema),
    defaultValues: { action: 'manual', manualBody: '' },
  });

  const headA: Head | undefined = data?.heads[0];
  const headB: Head | undefined = data?.heads[1];

  if (isLoading) return <Loading />;
  if (error)
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : t('app.error')}
      </p>
    );
  if (!data) return <EmptyState title={t('app.empty')} />;

  const isAutoResolvable = Boolean(data.analysis?.autoResolvable);
  const canManualMerge = data.kind !== 'conversation';

  const runResolve = async (req: ResolveRequest) => {
    try {
      await resolve.mutateAsync(req);
      toast.success(t('conflicts.toast.resolved'));
      navigate('/conflicts');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('conflicts.toast.error'));
    }
  };

  const onManual = form.handleSubmit((values) => runResolve(values));

  return (
    <div className="flex flex-col gap-4">
      <Link to="/conflicts" className="text-xs text-muted-foreground hover:underline">
        ← {t('conflicts.detail.back')}
      </Link>
      <header>
        <h1 className="text-2xl font-semibold">{data.artifactId}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{data.kind}</p>
      </header>

      <AnalysisPanel analysis={data.analysis} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <HeadPane
          label={t('conflicts.detail.headA')}
          head={headA}
          analysis={findHeadAnalysis(data.analysis, 'A')}
          showPayload={!isAutoResolvable}
        />
        <HeadPane
          label={t('conflicts.detail.headB')}
          head={headB}
          analysis={findHeadAnalysis(data.analysis, 'B')}
          showPayload={!isAutoResolvable}
        />
      </div>

      {isAutoResolvable ? (
        <div className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
          {t('conflicts.detail.noActionRequired')}
        </div>
      ) : mode === 'choose' ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => runResolve({ action: 'accept-a' })}
            disabled={!headA || resolve.isPending}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60"
          >
            {t('conflicts.detail.acceptA')}
          </button>
          <button
            type="button"
            onClick={() => runResolve({ action: 'accept-b' })}
            disabled={!headB || resolve.isPending}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60"
          >
            {t('conflicts.detail.acceptB')}
          </button>
          {canManualMerge ? (
            <button
              type="button"
              onClick={() => setMode('manual')}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted"
            >
              {t('conflicts.detail.manual')}
            </button>
          ) : null}
        </div>
      ) : (
        <form onSubmit={onManual} className="flex flex-col gap-3 rounded-md border border-border bg-background p-4">
          <p className="text-sm text-muted-foreground">{t('conflicts.detail.manualBody')}</p>
          <input type="hidden" {...form.register('action')} value="manual" />
          <textarea
            {...form.register('manualBody')}
            rows={10}
            className="rounded-md border border-border bg-background p-2 font-mono text-xs"
            aria-invalid={Boolean(form.formState.errors.manualBody) || undefined}
          />
          {form.formState.errors.manualBody ? (
            <span role="alert" className="text-xs text-destructive">
              {form.formState.errors.manualBody.message}
            </span>
          ) : null}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={resolve.isPending}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60"
            >
              {t('conflicts.detail.submitManual')}
            </button>
            <button
              type="button"
              onClick={() => setMode('choose')}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted"
            >
              {t('conflicts.detail.cancel')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function AnalysisPanel({ analysis }: { analysis: ConflictAnalysis | undefined }) {
  if (!analysis) {
    return (
      <section className="rounded-md border border-border bg-background p-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('conflicts.detail.whatChanged')}
        </h2>
        <p className="text-sm">{t('conflicts.detail.analysisMissing')}</p>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-border bg-background p-4">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t('conflicts.detail.whatChanged')}
      </h2>
      <p className="text-sm font-medium">{analysis.summary}</p>
      {analysis.recommendation ? (
        <p className="mt-1 text-sm text-muted-foreground">{analysis.recommendation}</p>
      ) : null}
      {analysis.autoResolvable && analysis.preferredHead ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {t('conflicts.detail.autoResolvable', { head: analysis.preferredHead })}
        </p>
      ) : null}
      <Differences differences={analysis.differences ?? []} />
    </section>
  );
}

function Differences({ differences }: { differences: ConflictDifference[] }) {
  if (differences.length === 0) {
    return (
      <div className="mt-4 rounded-md bg-muted p-3 text-sm">
        {t('conflicts.detail.noVisibleDifference')}
      </div>
    );
  }

  return (
    <div className="mt-4">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t('conflicts.detail.highlightedDifferences')}
      </h3>
      <div className="mt-2 divide-y divide-border overflow-hidden rounded-md border border-border">
        {differences.map((diff, index) => (
          <div key={`${diff.label}-${index}`} className="bg-background p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{diff.label}</span>
              <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                {statusLabel(diff.status)}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <DiffSide label={t('conflicts.detail.headA')} value={diff.headA} />
              <DiffSide label={t('conflicts.detail.headB')} value={diff.headB} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DiffSide({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="min-w-0 rounded-md bg-muted p-3">
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="whitespace-pre-wrap break-words text-sm">{value || t('conflicts.detail.notPresent')}</div>
    </div>
  );
}

function HeadPane({
  label,
  head,
  analysis,
  showPayload,
}: {
  label: string;
  head: Head | undefined;
  analysis: ConflictHeadAnalysis | undefined;
  showPayload: boolean;
}) {
  return (
    <section className="rounded-md border border-border bg-background p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{label}</h2>
      {!head ? (
        <p className="text-sm text-muted-foreground">{t('app.empty')}</p>
      ) : (
        <dl className="grid grid-cols-1 gap-y-2 text-sm">
          {analysis?.summary ? <Field label={t('conflicts.detail.readableSummary')} value={analysis.summary} /> : null}
          {analysis?.primaryText ? (
            <Field label={t('conflicts.detail.firstVisibleContent')} value={analysis.primaryText} />
          ) : null}
          <Field label={t('conflicts.detail.sourceAgent')} value={head.sourceAgent || t('conflicts.detail.unknownSource')} />
          <Field label={t('conflicts.detail.eventId')} value={head.eventId} mono />
          <Field
            label={t('conflicts.detail.contentSha256')}
            value={head.contentSha256.slice(0, 16) + '…'}
            mono
          />
          <Field
            label={t('conflicts.detail.absTimestamp')}
            value={formatTimestamp(new Date(head.absTimestamp * 1000).toISOString())}
          />
          {showPayload ? (() => {
            const payload = payloadJSON(head, analysis);
            return payload ? <PayloadField value={payload} /> : null;
          })() : null}
        </dl>
      )}
    </section>
  );
}

function PayloadField({ value }: { value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t('conflicts.detail.payloadPreview')}
      </dt>
      <dd className="mt-1">
        <details>
          <summary className="cursor-pointer text-xs text-muted-foreground">
            {t('conflicts.detail.payloadPreview')}
          </summary>
          <pre className="mt-1 max-h-[32rem] overflow-auto rounded bg-muted p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
            {value}
          </pre>
        </details>
      </dd>
    </div>
  );
}

function findHeadAnalysis(analysis: ConflictAnalysis | undefined, label: string): ConflictHeadAnalysis | undefined {
  return analysis?.heads?.find((head) => head.label === label);
}

function payloadJSON(head: Head, analysis: ConflictHeadAnalysis | undefined): string | undefined {
  if (analysis?.payloadJson) return analysis.payloadJson;
  if (!head.payloadPreview) return undefined;
  try {
    return JSON.stringify(JSON.parse(head.payloadPreview), null, 2);
  } catch {
    return head.payloadPreview;
  }
}

function statusLabel(status: string): string {
  if (status === 'only-a') return t('conflicts.detail.onlyInA');
  if (status === 'only-b') return t('conflicts.detail.onlyInB');
  return t('conflicts.detail.changed');
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={['break-words text-sm', mono ? 'font-mono text-xs' : ''].join(' ')}>{value}</dd>
    </div>
  );
}
