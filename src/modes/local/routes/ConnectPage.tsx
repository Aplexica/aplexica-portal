// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react';
import { Cloud, CloudOff, ExternalLink, ShieldCheck } from 'lucide-react';
import { t } from '@shared/i18n';
import { Badge, Card, PageHeader, Panel } from '@shared/components/ui';
import { Loading } from '@shared/components/Loading';
import { EmptyState } from '@shared/components/EmptyState';
import { ApiError } from '../lib/api/client';
import { usePairRemote, useRemoteStatus, useUnpairRemote, useVerifyRemote } from '../hooks/useRemote';
import type { RemoteStatus, RemoteVerifyResult } from '@shared/schemas';

const HOSTED_PORTAL_URL = 'https://app.aplexica.com/account/devices/new';

const PRIMARY_BTN =
  'rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60';
const SECONDARY_BTN =
  'rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-60';

export default function ConnectPage() {
  const { data: status, isLoading, error } = useRemoteStatus();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4">
      <PageHeader
        title={t('connect.title')}
        subtitle={t('connect.subtitle')}
        icon={<Cloud className="h-5 w-5" aria-hidden="true" />}
      />

      {isLoading ? (
        <Loading />
      ) : error ? (
        <p role="alert" className="text-sm text-destructive">
          {t('connect.loadError')}
        </p>
      ) : !status ? (
        <p role="alert" className="text-sm text-destructive">
          {t('connect.loadError')}
        </p>
      ) : !status.configured ? (
        <NotConfigured />
      ) : status.paired ? (
        <ConnectedCard status={status} />
      ) : (
        <PairWizard />
      )}
    </div>
  );
}

/** Daemon has no hosted-service plugin configured, so there is nothing to pair. */
function NotConfigured() {
  return (
    <EmptyState
      title={t('connect.notConfigured.title')}
      body={
        <div className="flex flex-col items-center gap-3">
          <CloudOff className="h-8 w-8 text-faint" aria-hidden="true" />
          <p>{t('connect.notConfigured.body')}</p>
          <p className="text-xs text-muted-foreground">{t('connect.notConfigured.hint')}</p>
        </div>
      }
    />
  );
}

/** Paired hosted-service status card. */
function ConnectedCard({ status }: { status: RemoteStatus }) {
  const verify = useVerifyRemote();
  const unpair = useUnpairRemote();
  const [rePairing, setRePairing] = useState(false);
  const [confirmUnpair, setConfirmUnpair] = useState(false);
  const [unpairError, setUnpairError] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<RemoteVerifyResult | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const onUnpair = async () => {
    setUnpairError(null);
    try {
      // On success the status query is invalidated -> paired flips false ->
      // the parent (ConnectPage) swaps back to the pairing wizard.
      await unpair.mutateAsync();
    } catch {
      setUnpairError(t('connect.success.unpairError'));
    }
  };

  if (rePairing) {
    // onPaired resets the re-pair state on a SUCCESSFUL pair so this card
    // re-renders (the invalidated status refetch shows the new device).
    // Without it, status.paired was already true so nothing would flip the
    // wizard back — it would stick on the last step and a second click would
    // register a duplicate device.
    return <PairWizard onCancel={() => setRePairing(false)} onPaired={() => setRePairing(false)} />;
  }

  const onVerify = async () => {
    setVerifyError(null);
    setVerifyResult(null);
    try {
      setVerifyResult(await verify.mutateAsync());
    } catch {
      setVerifyError(t('connect.success.verifyError'));
    }
  };

  const connState = normalizeConnState(status.conn_state);
  const relayConnected = connState === 'connected';

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className={
                  relayConnected
                    ? 'flex h-10 w-10 items-center justify-center rounded-md bg-success/12 text-success'
                    : 'flex h-10 w-10 items-center justify-center rounded-md bg-warning/12 text-warning'
                }
              >
                {relayConnected ? (
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <CloudOff className="h-5 w-5" aria-hidden="true" />
                )}
              </span>
              <div>
                <h2 className="text-lg font-semibold">{t('connect.success.title')}</h2>
                <p className="text-sm text-muted-foreground">
                  {relayConnected
                    ? t('connect.success.subtitleConnected')
                    : t('connect.success.subtitleDisconnected')}
                </p>
              </div>
            </div>
            <Badge tone={relayConnected ? 'success' : 'warning'}>
              {relayConnected ? t('connect.success.badgeConnected') : t('connect.success.badgeDisconnected')}
            </Badge>
          </div>

          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <DetailField label={t('connect.success.deviceId')} value={status.device_id} mono />
            <DetailField label={t('connect.success.accountId')} value={status.account_id} mono />
            <DetailField label={t('connect.success.connState')} value={connStateLabel(status.conn_state)} />
          </dl>

          <p
            className={
              relayConnected
                ? 'rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground'
                : 'rounded-md border border-warning/30 bg-warning/12 px-3 py-2 text-sm text-warning'
            }
          >
            {relayConnected ? t('connect.success.rulesNote') : t('connect.success.relayDisconnectedNote')}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={onVerify} disabled={verify.isPending} className={SECONDARY_BTN}>
              {verify.isPending ? t('connect.success.verifying') : t('connect.success.verify')}
            </button>
            {verifyResult ? (
              <span
                role="status"
                className={
                  verifyResult.connected
                    ? 'text-sm font-medium text-success'
                    : 'text-sm font-medium text-warning'
                }
              >
                {verifyResult.message ||
                  (verifyResult.connected
                    ? t('connect.success.verifyConnected')
                    : t('connect.success.verifyDisconnected'))}
              </span>
            ) : null}
            {verifyError ? (
              <span role="alert" className="text-sm font-medium text-destructive">
                {verifyError}
              </span>
            ) : null}
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-3 rounded-md border border-border bg-background px-4 py-3">
        <div>
          <p className="text-sm font-medium">{t('connect.success.unpairTitle')}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('connect.success.unpairNote')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setRePairing(true)}
            className={SECONDARY_BTN}
          >
            {t('connect.success.rePair')}
          </button>
          {confirmUnpair ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onUnpair}
                disabled={unpair.isPending}
                className="rounded-md border border-destructive/50 bg-danger/12 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-danger/20 disabled:opacity-60"
              >
                {unpair.isPending ? t('connect.success.unpairing') : t('connect.success.unpairConfirm')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmUnpair(false)}
                disabled={unpair.isPending}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                {t('connect.back')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setUnpairError(null);
                setConfirmUnpair(true);
              }}
              className="rounded-md border border-destructive/40 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-danger/12"
            >
              {t('connect.success.unpair')}
            </button>
          )}
        </div>
        {unpairError ? (
          <span role="alert" className="text-xs text-destructive">
            {unpairError}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function normalizeConnState(value: string): string {
  return value.trim().toLowerCase();
}

function connStateLabel(value: string): string {
  switch (normalizeConnState(value)) {
    case 'connected':
      return t('connect.success.connStateValues.connected');
    case 'connecting':
      return t('connect.success.connStateValues.connecting');
    case 'starting':
      return t('connect.success.connStateValues.starting');
    case 'disconnected':
      return t('connect.success.connStateValues.disconnected');
    case 'unknown':
    case '':
      return t('connect.success.connStateValues.unknown');
    default:
      return value;
  }
}

function DetailField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <dt className="text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-faint">{label}</dt>
      <dd className={mono ? 'mt-0.5 break-all font-mono text-xs text-foreground' : 'mt-0.5 text-sm text-foreground'}>
        {value || '—'}
      </dd>
    </div>
  );
}

const STEP_IDS = ['getCode', 'pasteCode', 'pair'] as const;

/** Translate an API error code into a friendly message + whether to offer "get a new code". */
function pairErrorView(err: unknown): { message: string; offerNewCode: boolean } {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'remote_not_configured':
        return { message: t('connect.errors.remoteNotConfigured'), offerNewCode: false };
      case 'validation':
        return { message: t('connect.errors.validation'), offerNewCode: true };
      case 'pair_failed':
        return { message: t('connect.errors.pairFailed'), offerNewCode: true };
    }
  }
  return {
    message: t('connect.errors.generic'),
    offerNewCode: true,
  };
}

/**
 * 3-step pairing wizard. `onCancel` is supplied when re-pairing from the
 * connected card; `onPaired` fires on a successful pair so the re-pair flow
 * can return to the connected card (status.paired is already true there, so
 * there's no false→true transition to rely on).
 */
function PairWizard({ onCancel, onPaired }: { onCancel?: () => void; onPaired?: () => void }) {
  const pair = usePairRemote();
  const [index, setIndex] = useState(0);
  const [token, setToken] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [errorView, setErrorView] = useState<{ message: string; offerNewCode: boolean } | null>(null);

  const total = STEP_IDS.length;
  const stepId = STEP_IDS[index];
  const tokenValid = token.trim().length > 0;

  const goToStart = () => {
    setErrorView(null);
    setIndex(0);
  };

  const onPair = async () => {
    setErrorView(null);
    try {
      await pair.mutateAsync({
        token: token.trim(),
        device_name: deviceName.trim() || undefined,
      });
      // On success the status query is invalidated; for a first-time pair the
      // parent swaps in the connected card once the refetch reports
      // paired: true. For a re-pair (already paired), onPaired resets the
      // re-pair state so we leave the wizard instead of sticking on this step.
      onPaired?.();
    } catch (err) {
      setErrorView(pairErrorView(err));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex items-center gap-2" aria-label={t('connect.title')}>
        {STEP_IDS.map((id, i) => (
          <li
            key={id}
            className={[
              'flex h-6 w-6 items-center justify-center rounded-full border text-xs',
              i === index
                ? 'border-accent bg-accent text-accent-foreground'
                : i < index
                  ? 'border-accent bg-accent/20 text-accent'
                  : 'border-border bg-background text-muted-foreground',
            ].join(' ')}
            aria-current={i === index || undefined}
          >
            {i + 1}
          </li>
        ))}
      </ol>

      <Panel title={t('connect.step', { current: index + 1, total })}>
        <h2 className="text-lg font-semibold">{t(`connect.steps.${stepId}.title`)}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t(`connect.steps.${stepId}.body`)}</p>

        {stepId === 'getCode' ? (
          <div className="mt-4 flex flex-col gap-3">
            <a
              href={HOSTED_PORTAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              {t('connect.steps.getCode.openPortal')}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            <p className="text-xs text-muted-foreground">{t('connect.steps.getCode.note')}</p>
          </div>
        ) : null}

        {stepId === 'pasteCode' ? (
          <div className="mt-4 flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t('connect.steps.pasteCode.tokenLabel')}</span>
              <textarea
                value={token}
                onChange={(e) => setToken(e.target.value)}
                rows={4}
                spellCheck={false}
                placeholder={t('connect.steps.pasteCode.tokenPlaceholder')}
                className="rounded-md border border-border bg-background px-2.5 py-2 font-mono text-xs leading-relaxed focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                aria-invalid={!tokenValid || undefined}
              />
              {!tokenValid ? (
                <span className="text-xs text-muted-foreground">
                  {t('connect.steps.pasteCode.tokenRequired')}
                </span>
              ) : null}
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t('connect.steps.pasteCode.deviceNameLabel')}</span>
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder={t('connect.steps.pasteCode.deviceNamePlaceholder')}
                className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </label>
          </div>
        ) : null}

        {stepId === 'pair' ? (
          <div className="mt-4 flex flex-col gap-3">
            {pair.isPending ? (
              <Loading label={t('connect.steps.pair.pending')} />
            ) : (
              <button type="button" onClick={onPair} className={`${PRIMARY_BTN} w-fit`}>
                {t('connect.steps.pair.submit')}
              </button>
            )}

            {errorView ? (
              <div
                role="alert"
                className="flex flex-col gap-2 rounded-md border border-destructive/40 bg-danger/12 px-3 py-2 text-sm text-destructive"
              >
                <span className="font-medium">{t('connect.errors.title')}</span>
                <span>{errorView.message}</span>
                {errorView.offerNewCode ? (
                  <button
                    type="button"
                    onClick={goToStart}
                    className="w-fit text-xs font-medium underline hover:no-underline"
                  >
                    {t('connect.errors.getNewCode')}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </Panel>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            if (index === 0) {
              onCancel?.();
              return;
            }
            setErrorView(null);
            setIndex((i) => Math.max(0, i - 1));
          }}
          disabled={index === 0 && !onCancel}
          className={SECONDARY_BTN}
        >
          {t('connect.back')}
        </button>
        {index < total - 1 ? (
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
            disabled={stepId === 'pasteCode' && !tokenValid}
            className={PRIMARY_BTN}
          >
            {t('connect.next')}
          </button>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
