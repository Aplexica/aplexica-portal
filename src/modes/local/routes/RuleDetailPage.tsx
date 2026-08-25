// SPDX-License-Identifier: AGPL-3.0-or-later
import { Link, useNavigate, useParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { t } from '@shared/i18n';
import { Loading } from '@shared/components/Loading';
import { EmptyState } from '@shared/components/EmptyState';
import { useDeleteRule, useRule, useUpdateRule } from '../hooks/useRules';
import { useAgents } from '../hooks/useAgents';
import { RuleFormControls } from './RuleFormControls';
import {
  AGENT_ORIGINATING,
  DEFAULT_SCHEDULED_SYNC_INTERVAL_SECONDS,
  RuleFormSchema,
  type RuleFormValues,
  type Rule,
  ruleEditFields,
  ruleToForm,
  summarizeRule,
} from '@shared/schemas';

// configRows renders a hosted rule's practical configuration as
// read-only label/value pairs. Reuses ruleToForm so the values match
// exactly what the editable form would show for a local rule.
function configRows(r: Rule): { label: string; value: string }[] {
  const f = ruleToForm(r);
  const join = (a?: string[]) => (a && a.length ? a.join(', ') : '—');
  const agents =
    !f.agents || f.agents.length === 0
      ? t('rules.detail.configAllAgents')
      : f.agents
          .map((a) => (a === AGENT_ORIGINATING ? t('rules.form.agentsOriginating') : a))
          .join(', ');
  const onOff = (v: boolean) => (v ? t('rules.detail.configOn') : t('rules.detail.configOff'));
  const rows = [
    {
      label: t('rules.form.typesLabel'),
      value: f.types.length ? f.types.join(', ') : t('rules.detail.configAllTypes'),
    },
    { label: t('rules.form.matchTagsLabel'), value: join(f.matchTags) },
    { label: t('rules.form.agentsLabel'), value: agents },
    { label: t('rules.form.tagsLabel'), value: join(f.assignTags) },
    { label: t('rules.form.modeLabel'), value: f.mode || t('rules.form.modeUnset') },
  ];
  if (f.mode === 'scheduled') {
    rows.push({
      label: t('rules.form.scheduledIntervalSecondsLabel'),
      value: String(f.scheduledIntervalSeconds),
    });
  }
  rows.push(
    { label: t('rules.form.syncOffDeviceLabel'), value: onOff(f.syncOffDevice ?? true) },
    { label: t('rules.form.includeSecretsLabel'), value: onOff(f.includeSecrets ?? true) },
  );
  return rows;
}

// Matchers the practical form does NOT own. When a rule carries any of
// these we show them read-only; they are preserved on save because
// ruleEditFields only sends the practical keys (PATCH-merges the rest).
function advancedMatchers(r: Rule): { label: string; value: string }[] {
  const m = r.Match ?? {};
  const route = r.Route ?? {};
  const out: { label: string; value: string }[] = [];
  if (m.toolKind?.length) out.push({ label: 'match.toolKind', value: m.toolKind.join(', ') });
  if (m.toolCapability?.length)
    out.push({ label: 'match.toolCapability', value: m.toolCapability.join(', ') });
  if (m.agentSource?.length) out.push({ label: 'match.agentSource', value: m.agentSource.join(', ') });
  if (m.deviceSource?.length)
    out.push({ label: 'match.deviceSource', value: m.deviceSource.join(', ') });
  if (m.size) out.push({ label: 'match.size', value: m.size });
  if (m.path) out.push({ label: 'match.path', value: m.path });
  if (m.branchName) out.push({ label: 'match.branchName', value: m.branchName });
  if (m.kind) out.push({ label: 'match.kind', value: m.kind });
  if (m.scope?.kind?.length) out.push({ label: 'match.scope.kind', value: m.scope.kind.join(', ') });
  if (m.scope?.namespace?.length)
    out.push({ label: 'match.scope.namespace', value: m.scope.namespace.join(', ') });
  if (m.scope?.project?.id?.length)
    out.push({ label: 'match.scope.project.id', value: m.scope.project.id.join(', ') });
  if (m.scope?.project?.ephemeral !== undefined)
    out.push({ label: 'match.scope.project.ephemeral', value: String(m.scope.project.ephemeral) });
  if (route.skillMode) out.push({ label: 'route.skillMode', value: route.skillMode });
  return out;
}

export default function RuleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useRule(id);
  const update = useUpdateRule(id ?? '');
  const del = useDeleteRule();
  const { data: agents } = useAgents();

  const form = useForm<RuleFormValues>({
    resolver: zodResolver(RuleFormSchema),
    defaultValues: {
      scheduledIntervalSeconds: DEFAULT_SCHEDULED_SYNC_INTERVAL_SECONDS,
    },
    // Reset from server data once it arrives (values prop keeps the form
    // in sync without a manual reset effect).
    values: data ? ruleToForm(data) : undefined,
  });

  if (isLoading) return <Loading />;
  if (error)
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : t('app.error')}
      </p>
    );
  if (!data) return <EmptyState title={t('app.empty')} />;

  const summary = summarizeRule(data);
  const advanced = advancedMatchers(data);
  // Hosted rules are read-only on this device, so show their details without
  // the edit/delete form. `cloud` is the daemon's public wire value.
  const isHosted = data.Source === 'cloud';
  const mode = form.watch('mode');

  const onSave = form.handleSubmit(async (values) => {
    if (!id) return;
    try {
      await update.mutateAsync(ruleEditFields(data, values));
      toast.success(t('rules.toast.updated'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('rules.toast.error'));
    }
  });

  const onDelete = async () => {
    if (!id) return;
    if (!window.confirm(t('rules.detail.deleteConfirm'))) return;
    try {
      await del.mutateAsync(id);
      toast.success(t('rules.toast.deleted'));
      navigate('/rules');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('rules.toast.error'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Link to="/rules" className="text-xs text-muted-foreground hover:underline">
        ← {t('rules.detail.back')}
      </Link>
      <header>
        <h1 className="text-2xl font-semibold">{data.Name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('rules.detail.summary')}:{' '}
          <span className="text-foreground">
            {summary.match} → {summary.targets} ({summary.effect}).
          </span>
        </p>
      </header>

      {isHosted ? (
        <div className="rounded-md border border-accent/40 bg-accent/10 p-4 text-sm">
          <p className="font-medium text-accent">{t('rules.detail.cloudTitle')}</p>
          <p className="mt-1 text-muted-foreground">{t('rules.detail.cloudNote')}</p>
        </div>
      ) : null}

      {isHosted ? (
        <section className="flex flex-col gap-2 rounded-md border border-border bg-background p-4">
          <h2 className="text-sm font-semibold">{t('rules.detail.configTitle')}</h2>
          <dl className="overflow-hidden rounded-md border border-border">
            {configRows(data).map((row, i) => (
              <div
                key={row.label}
                className={`grid grid-cols-1 gap-1 px-4 py-2.5 sm:grid-cols-[14rem_1fr] sm:gap-4 ${
                  i > 0 ? 'border-t border-border' : ''
                }`}
              >
                <dt className="text-xs text-muted-foreground">{row.label}</dt>
                <dd className="text-sm text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {!isHosted ? (
      <form
        onSubmit={onSave}
        className="flex flex-col gap-3 rounded-md border border-border bg-background p-4"
      >
        <h2 className="text-sm font-semibold">{t('rules.detail.editTitle')}</h2>

        <label className="flex flex-col gap-1 text-sm">
          <span>{t('rules.form.nameLabel')}</span>
          <input
            {...form.register('name')}
            disabled
            className="rounded-md border border-border bg-muted/40 px-2 py-1.5 text-sm text-muted-foreground"
          />
          <span className="text-xs text-muted-foreground">{t('rules.detail.nameDisabledNote')}</span>
        </label>

        <label className="flex flex-col gap-1 text-sm md:max-w-xs">
          <span>{t('rules.form.modeLabel')}</span>
          <select
            {...form.register('mode')}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="">{t('rules.form.modeUnset')}</option>
            <option value="live">{t('rules.form.modeLive')}</option>
            <option value="scheduled">{t('rules.form.modeScheduled')}</option>
            <option value="manual">{t('rules.form.modeManual')}</option>
          </select>
        </label>

        {mode === 'scheduled' ? (
          <label className="flex flex-col gap-1 text-sm md:max-w-xs">
            <span>{t('rules.form.scheduledIntervalSecondsLabel')}</span>
            <input
              type="number"
              min={1}
              step={1}
              {...form.register('scheduledIntervalSeconds', { valueAsNumber: true })}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              aria-invalid={Boolean(form.formState.errors.scheduledIntervalSeconds) || undefined}
            />
            <span className="text-xs text-muted-foreground">
              {t('rules.form.scheduledIntervalSecondsHint')}
            </span>
            {form.formState.errors.scheduledIntervalSeconds ? (
              <span role="alert" className="text-xs text-destructive">
                {form.formState.errors.scheduledIntervalSeconds.message}
              </span>
            ) : null}
          </label>
        ) : null}

        <RuleFormControls control={form.control} agents={agents} />

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" {...form.register('syncOffDevice')} className="mt-0.5" />
          <span className="flex flex-col">
            <span>{t('rules.form.syncOffDeviceLabel')}</span>
            <span className="text-xs text-muted-foreground">{t('rules.form.syncOffDeviceHint')}</span>
          </span>
        </label>

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" {...form.register('includeSecrets')} className="mt-0.5" />
          <span className="flex flex-col">
            <span>{t('rules.form.includeSecretsLabel')}</span>
            <span className="text-xs text-muted-foreground">{t('rules.form.includeSecretsHint')}</span>
          </span>
        </label>

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={update.isPending}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60"
          >
            {t('rules.detail.save')}
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={del.isPending}
            className="rounded-md border border-destructive bg-background px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
          >
            {t('rules.detail.delete')}
          </button>
        </div>
      </form>
      ) : null}

      {advanced.length > 0 ? (
        <section className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-4">
          <h2 className="text-sm font-semibold">{t('rules.detail.advancedTitle')}</h2>
          <p className="text-xs text-muted-foreground">{t('rules.detail.advancedNote')}</p>
          <dl className="overflow-hidden rounded-md border border-border bg-background">
            {advanced.map((row, i) => (
              <div
                key={row.label}
                className={`grid grid-cols-1 gap-1 px-4 py-2.5 sm:grid-cols-[14rem_1fr] sm:gap-4 ${
                  i > 0 ? 'border-t border-border' : ''
                }`}
              >
                <dt className="font-mono text-xs text-muted-foreground">{row.label}</dt>
                <dd className="text-sm text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  );
}
