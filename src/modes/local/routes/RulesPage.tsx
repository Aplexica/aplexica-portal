// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { t } from '@shared/i18n';
import { Loading } from '@shared/components/Loading';
import { EmptyState } from '@shared/components/EmptyState';
import { useCreateRule, usePresets, useRules } from '../hooks/useRules';
import { useAgents } from '../hooks/useAgents';
import { RuleFormControls } from './RuleFormControls';
import {
  DEFAULT_SCHEDULED_SYNC_INTERVAL_SECONDS,
  RuleFormSchema,
  type RuleFormValues,
  type RulePreset,
  ruleFromForm,
  summarizeRule,
} from '@shared/schemas';

export default function RulesPage() {
  const { data, isLoading, error } = useRules();
  const { data: agents } = useAgents();
  const create = useCreateRule();
  const [open, setOpen] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);

  const form = useForm<RuleFormValues>({
    resolver: zodResolver(RuleFormSchema),
    defaultValues: {
      name: '',
      types: [],
      matchTags: [],
      agents: [],
      assignTags: [],
      // Multi-device scope is not edited locally and defaults to all devices.
      devices: [],
      mode: '',
      scheduledIntervalSeconds: DEFAULT_SCHEDULED_SYNC_INTERVAL_SECONDS,
      syncOffDevice: true,
      includeSecrets: true,
    },
  });
  const mode = form.watch('mode');

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await create.mutateAsync(ruleFromForm(values));
      toast.success(t('rules.toast.created'));
      form.reset();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('rules.toast.error'));
    }
  });

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('rules.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('rules.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setPresetsOpen((o) => !o);
              setOpen(false);
            }}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            {t('rules.presets.add')}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen((o) => !o);
              setPresetsOpen(false);
            }}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90"
          >
            {t('rules.add')}
          </button>
        </div>
      </header>

      {presetsOpen ? <PresetPanel onClose={() => setPresetsOpen(false)} /> : null}

      {open ? (
        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-3 rounded-md border border-border bg-background p-4"
        >
          <label className="flex flex-col gap-1 text-sm">
            <span>{t('rules.form.nameLabel')}</span>
            <input
              {...form.register('name')}
              placeholder={t('rules.form.namePlaceholder')}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              aria-invalid={Boolean(form.formState.errors.name) || undefined}
            />
            {form.formState.errors.name ? (
              <span role="alert" className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </span>
            ) : null}
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
                aria-invalid={
                  Boolean(form.formState.errors.scheduledIntervalSeconds) || undefined
                }
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
              <span className="text-xs text-muted-foreground">
                {t('rules.form.syncOffDeviceHint')}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" {...form.register('includeSecrets')} className="mt-0.5" />
            <span className="flex flex-col">
              <span>{t('rules.form.includeSecretsLabel')}</span>
              <span className="text-xs text-muted-foreground">
                {t('rules.form.includeSecretsHint')}
              </span>
            </span>
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={create.isPending}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60"
            >
              {t('rules.form.submit')}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted"
            >
              {t('rules.form.cancel')}
            </button>
          </div>
        </form>
      ) : null}

      {isLoading ? (
        <Loading />
      ) : error ? (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : t('app.error')}
        </p>
      ) : !data || data.length === 0 ? (
        <EmptyState title={t('rules.empty')} />
      ) : (
        <>
          <ul className="flex flex-col gap-3 sm:hidden" aria-label={t('rules.title')}>
            {data.map((r) => {
              const s = summarizeRule(r);
              return (
                <li key={r.Name} className="min-w-0 rounded-md border border-border bg-background p-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Link
                      to={`/rules/${encodeURIComponent(r.Name)}`}
                      className="min-w-0 break-words font-medium text-accent hover:underline"
                    >
                      {r.Name}
                    </Link>
                    {r.Source === 'cloud' ? (
                      <span
                        title={t('rules.cloudBadgeHint')}
                        className="rounded border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent"
                      >
                        {t('rules.cloudBadge')}
                      </span>
                    ) : null}
                  </div>
                  <dl className="mt-3 grid min-w-0 gap-2 text-sm">
                    {[
                      [t('rules.columns.match'), s.match],
                      [t('rules.columns.targets'), s.targets],
                      [t('rules.columns.effect'), s.effect],
                    ].map(([label, value]) => (
                      <div key={label} className="grid min-w-0 grid-cols-[5rem_minmax(0,1fr)] gap-2">
                        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
                        <dd className="min-w-0 break-words text-muted-foreground">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              );
            })}
          </ul>
          <table className="hidden w-full border-collapse text-sm sm:table">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4 font-medium">{t('rules.columns.name')}</th>
                <th className="py-2 pr-4 font-medium">{t('rules.columns.match')}</th>
                <th className="py-2 pr-4 font-medium">{t('rules.columns.targets')}</th>
                <th className="py-2 pr-4 font-medium">{t('rules.columns.effect')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => {
                const s = summarizeRule(r);
                return (
                  <tr key={r.Name} className="border-b border-border last:border-b-0 hover:bg-muted/40">
                    <td className="py-2 pr-4 align-top">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/rules/${encodeURIComponent(r.Name)}`}
                          className="font-medium text-accent hover:underline"
                        >
                          {r.Name}
                        </Link>
                        {r.Source === 'cloud' ? (
                          <span
                            title={t('rules.cloudBadgeHint')}
                            className="rounded border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent"
                          >
                            {t('rules.cloudBadge')}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-2 pr-4 align-top text-muted-foreground">{s.match}</td>
                    <td className="py-2 pr-4 align-top text-muted-foreground">{s.targets}</td>
                    <td className="py-2 pr-4 align-top text-muted-foreground">{s.effect}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

/**
 * Lists the opt-in rule presets. Adding a preset POSTs each rule to
 * the existing POST /api/rules write path — there is no separate preset
 * write API.
 */
function PresetPanel({ onClose }: { onClose: () => void }) {
  const { data, isLoading, error } = usePresets();
  const create = useCreateRule();
  const [busy, setBusy] = useState<string | null>(null);

  const onAdd = async (preset: RulePreset) => {
    setBusy(preset.id);
    try {
      for (const rule of preset.rules) {
        await create.mutateAsync(rule);
      }
      toast.success(t('rules.presets.added'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('rules.presets.addError'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-md border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{t('rules.presets.title')}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('rules.presets.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted"
        >
          {t('rules.presets.close')}
        </button>
      </div>

      {isLoading ? (
        <Loading />
      ) : error ? (
        <p className="text-sm text-destructive">{t('rules.presets.loadError')}</p>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('rules.presets.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((preset) => (
            <li
              key={preset.id}
              className="flex items-start justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2.5"
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{preset.title}</span>
                  {preset.group ? (
                    <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {t('rules.presets.ruleCount', { count: preset.rules.length })}
                    </span>
                  ) : null}
                </div>
                {preset.description ? (
                  <span className="text-xs text-muted-foreground">{preset.description}</span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => onAdd(preset)}
                disabled={busy !== null}
                className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60"
              >
                {t('rules.presets.addOne')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
