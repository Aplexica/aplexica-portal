// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { t } from '@shared/i18n';
import { Loading } from '@shared/components/Loading';
import { useConfig, usePatchConfig, useRawConfigPath } from '../hooks/useConfig';
import {
  SettingsFormSchema,
  type SettingsFormValues,
  type ConfigPatch,
} from '@shared/schemas';

const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error'] as const;

export default function SettingsPage() {
  const cfg = useConfig();
  const path = useRawConfigPath();
  const patch = usePatchConfig();

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(SettingsFormSchema),
    defaultValues: {
      logLevel: '',
      hermesWatchInterval: '',
    },
  });

  useEffect(() => {
    if (!cfg.data) return;
    form.reset({
      logLevel: cfg.data.logLevel ?? 'info',
      hermesWatchInterval: cfg.data.hermesWatchInterval
        ? String(cfg.data.hermesWatchInterval)
        : '',
    });
  }, [cfg.data, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    const body: ConfigPatch = {};
    if (values.logLevel) body.logLevel = values.logLevel;
    if (values.hermesWatchInterval && values.hermesWatchInterval.trim()) {
      body.hermesWatchInterval = values.hermesWatchInterval.trim();
    }
    try {
      await patch.mutateAsync(body);
      toast.success(t('settings.toast.saved'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settings.toast.error'));
    }
  });

  const onOpenRaw = async () => {
    if (!path.data) return;
    try {
      await navigator.clipboard.writeText(path.data);
      toast.success(t('settings.rawPathClipboard'));
    } catch {
      // Some browsers gate clipboard; fall back to a prompt.
      window.prompt(t('settings.openRawConfig'), path.data);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('settings.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('settings.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={onOpenRaw}
          disabled={!path.data}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-60"
        >
          {t('settings.openRawConfig')}
        </button>
      </header>

      {cfg.isLoading ? (
        <Loading />
      ) : (
        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-3 rounded-md border border-border bg-background p-4"
        >
          <label className="flex flex-col gap-1 text-sm">
            <span>{t('settings.form.logLevelLabel')}</span>
            <select
              {...form.register('logLevel')}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              {LOG_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {t(`settings.form.logLevels.${l}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>{t('settings.form.hermesWatchIntervalLabel')}</span>
            <input
              {...form.register('hermesWatchInterval')}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
            <span className="text-xs text-muted-foreground">
              {t('settings.form.hermesWatchIntervalHelp')}
            </span>
          </label>
          <div>
            <button
              type="submit"
              disabled={patch.isPending}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60"
            >
              {patch.isPending ? t('settings.form.saving') : t('settings.form.submit')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
