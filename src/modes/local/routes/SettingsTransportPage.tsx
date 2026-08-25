// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect } from 'react';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { t } from '@shared/i18n';
import { Loading } from '@shared/components/Loading';
import { useSetBYORelay, useSetTransport, useTransport } from '../hooks/useTransport';
import { ApiError } from '../lib/api/client';
import {
  BYOFormSchema,
  type BYOFormValues,
  type BYORelayOpts,
} from '@shared/schemas';

export default function SettingsTransportPage() {
  const transport = useTransport();
  const setMode = useSetTransport();
  const setBYO = useSetBYORelay();

  const form = useForm<BYOFormValues>({
    resolver: zodResolver(BYOFormSchema),
    defaultValues: {
      url: '',
      mtlsCertPath: '',
      mtlsKeyPath: '',
      caCertPath: '',
      namespaces: '',
    },
  });
  const { reset } = form;

  const transportInfo = transport.data;
  const availableModes = transportInfo?.available ?? [];
  const byoAvailable = availableModes.includes('byo-relay');
  const remoteTransportAvailable = byoAvailable || availableModes.includes('hosted');
  const labelForMode = (mode: string) => {
    if (mode === 'local' || mode === 'local-only') {
      return t('transport.modes.local');
    }
    if (mode === 'byo-relay') {
      return t('transport.modes.byo-relay');
    }
    if (mode === 'hosted') {
      return t('transport.modes.hosted');
    }
    return mode;
  };

  useEffect(() => {
    const byo = transportInfo?.byo;
    if (!byo) {
      return;
    }
    reset({
      url: byo.url,
      mtlsCertPath: byo.mtlsCertPath ?? '',
      mtlsKeyPath: byo.mtlsKeyPath ?? '',
      caCertPath: byo.caCertPath ?? '',
      namespaces: byo.namespaces?.join(', ') ?? '',
    });
  }, [reset, transportInfo?.byo]);

  const onSwitchLocal = async () => {
    try {
      await setMode.mutateAsync({ mode: 'local-only' });
      toast.success(t('transport.toast.switched'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('transport.toast.error'));
    }
  };

  const onBYO = form.handleSubmit(async (values) => {
    if (!byoAvailable) {
      toast.message(t('transport.toast.byoUnavailable'));
      return;
    }
    const body: BYORelayOpts = {
      url: values.url.trim(),
      mtlsCertPath: values.mtlsCertPath?.trim() || undefined,
      mtlsKeyPath: values.mtlsKeyPath?.trim() || undefined,
      caCertPath: values.caCertPath?.trim() || undefined,
      namespaces: values.namespaces
        ? values.namespaces.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
    };
    try {
      await setBYO.mutateAsync(body);
      toast.success(t('transport.toast.switched'));
    } catch (err) {
      // The daemon returns 501 / not_yet_implemented in V1 OSS — surface
      // it as an availability notice instead of a red error.
      if (err instanceof ApiError && err.status === 501) {
        toast.message(t('transport.toast.byoDeferred'));
      } else {
        toast.error(err instanceof Error ? err.message : t('transport.toast.error'));
      }
    }
  });

  return (
    <div className="flex flex-col gap-4">
      <Link to="/settings" className="text-xs text-muted-foreground hover:underline">
        ← {t('nav.settings')}
      </Link>
      <header>
        <h1 className="text-2xl font-semibold">{t('transport.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('transport.subtitle')}</p>
      </header>

      {transport.isLoading ? (
        <Loading />
      ) : transportInfo ? (
        <section className="rounded-md border border-border bg-background p-4 text-sm">
          <p>
            <span className="text-muted-foreground">{t('transport.mode')}:</span>{' '}
            <strong>{labelForMode(transportInfo.mode)}</strong>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {t('transport.available')}: {availableModes.map(labelForMode).join(', ') || '—'}
          </p>
          {!remoteTransportAvailable ? (
            <p className="mt-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {t('transport.localOnlyNotice')}
            </p>
          ) : null}
          {transportInfo.mode !== 'local' && transportInfo.mode !== 'local-only' ? (
            <button
              type="button"
              onClick={onSwitchLocal}
              disabled={setMode.isPending}
              className="mt-3 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-60"
            >
              {t('transport.switchLocal')}
            </button>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-md border border-border bg-background p-4">
        <h2 className="mb-2 text-sm font-semibold">{t('transport.byo.title')}</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          {byoAvailable ? t('transport.byo.available') : t('transport.byo.unavailable')}
        </p>
        <form onSubmit={onBYO}>
          <fieldset
            disabled={!byoAvailable || setBYO.isPending}
            className="m-0 flex flex-col gap-3 border-0 p-0 disabled:opacity-60"
          >
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('transport.byo.urlLabel')}</span>
              <input
                {...form.register('url')}
                placeholder={t('transport.byo.urlPlaceholder')}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm disabled:cursor-not-allowed"
                aria-invalid={Boolean(form.formState.errors.url) || undefined}
              />
              {form.formState.errors.url ? (
                <span role="alert" className="text-xs text-destructive">
                  {form.formState.errors.url.message}
                </span>
              ) : null}
            </label>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm">
                <span>{t('transport.byo.certLabel')}</span>
                <input
                  {...form.register('mtlsCertPath')}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-sm disabled:cursor-not-allowed"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>{t('transport.byo.keyLabel')}</span>
                <input
                  {...form.register('mtlsKeyPath')}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-sm disabled:cursor-not-allowed"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>{t('transport.byo.caLabel')}</span>
                <input
                  {...form.register('caCertPath')}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-sm disabled:cursor-not-allowed"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('transport.byo.namespacesLabel')}</span>
              <input
                {...form.register('namespaces')}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm disabled:cursor-not-allowed"
              />
            </label>
            <div>
              <button
                type="submit"
                disabled={!byoAvailable || setBYO.isPending}
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {byoAvailable ? t('transport.byo.submit') : t('transport.byo.unavailableSubmit')}
              </button>
            </div>
          </fieldset>
        </form>
      </section>
    </div>
  );
}
