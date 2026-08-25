// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Cloud,
  DatabaseBackup,
  Filter,
  HardDrive,
  History,
  RotateCcw,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { t } from '@shared/i18n';
import { Loading } from '@shared/components/Loading';
import { EmptyState } from '@shared/components/EmptyState';
import { ModalDialog } from '@shared/components/ui/ModalDialog';
import { formatRelative } from '@shared/lib/time';
import type { BackupInfo, BackupJob, SafetyStatus } from '@shared/schemas';
import {
  useCancelNativeBackupJob,
  useCreateNativeBackup,
  useDeleteNativeBackup,
  useNativeBackups,
  useNativeBackupStatus,
  useOverrideNativeBackupBlocker,
  useRestoreNativeBackup,
  useSaveNativeBackupRetention,
  useSaveNativeBackupSchedule,
} from '../hooks/useNativeBackups';

type BackupDestination = 'local' | 'cloud';
type BackupKindFilter = 'all' | 'manual' | 'scheduled' | 'pre-sync' | 'pre-restore';
type BackupLocationFilter = 'all' | BackupDestination;

interface RestoreTarget {
  backup: BackupInfo;
  agent: string;
}

interface DeleteTarget {
  backup: BackupInfo;
}

const schedulePresets = [
  { label: 'backups.schedule.preset.hourly', minutes: 60 },
  { label: 'backups.schedule.preset.sixHours', minutes: 360 },
  { label: 'backups.schedule.preset.twelveHours', minutes: 720 },
  { label: 'backups.schedule.preset.daily', minutes: 1440 },
  { label: 'backups.schedule.preset.weekly', minutes: 10080 },
] as const;

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const v = n / Math.pow(1024, i);
  return `${i === 0 ? v : v.toFixed(1)} ${units[i]}`;
}

export default function BackupsPage() {
  const { data, isLoading, error, refetch: refetchBackups } = useNativeBackups();
  const { data: status, isLoading: statusLoading, error: statusError, refetch: refetchBackupStatus } = useNativeBackupStatus();
  const createBackup = useCreateNativeBackup();
  const cancelBackupJob = useCancelNativeBackupJob();
  const overrideBlocker = useOverrideNativeBackupBlocker();
  const saveSchedule = useSaveNativeBackupSchedule();
  const saveRetention = useSaveNativeBackupRetention();
  const [target, setTarget] = useState<RestoreTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [backupDestination, setBackupDestination] = useState<BackupDestination>('local');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleInterval, setScheduleInterval] = useState(1440);
  const [scheduleDestination, setScheduleDestination] = useState<BackupDestination>('local');
  const [scheduleAgents, setScheduleAgents] = useState<string[]>([]);
  const [retentionByAgent, setRetentionByAgent] = useState<Record<string, number>>({});
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [agentFilter, setAgentFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState<BackupKindFilter>('all');
  const [locationFilter, setLocationFilter] = useState<BackupLocationFilter>('all');
  const [restoreScopes, setRestoreScopes] = useState<Record<string, string>>({});

  const backups = useMemo(() => data ?? [], [data]);
  const safety = useMemo(() => status?.safety ?? [], [status?.safety]);
  const agents = useMemo(() => safety.map((s) => s.agent).sort(), [safety]);
  const jobs = useMemo(() => status?.jobs ?? [], [status?.jobs]);
  const activeJob = useMemo(() => jobs.find(isActiveBackupJob), [jobs]);
  const activeJobId = activeJob?.id;
  const backupBusy = createBackup.isPending || Boolean(activeJob);
  const backupCanceling = activeJob?.state === 'canceling' || cancelBackupJob.isPending;
  const cloud = status?.cloud;
  const cloudAvailable = Boolean(cloud?.available);

  useEffect(() => {
    if (!status?.schedule) return;
    setScheduleEnabled(status.schedule.enabled);
    setScheduleInterval(status.schedule.intervalMinutes || 1440);
    setScheduleDestination(status.schedule.destination ?? 'local');
    setScheduleAgents(status.schedule.agents ?? []);
  }, [status?.schedule]);

  useEffect(() => {
    const perAgent = status?.retention?.perAgent ?? {};
    setRetentionByAgent(Object.fromEntries(agents.map((agent) => [agent, perAgent[agent] ?? 5])));
  }, [agents, status?.retention?.perAgent]);

  useEffect(() => {
    if (!cloudAvailable && backupDestination === 'cloud') setBackupDestination('local');
    if (!cloudAvailable && scheduleDestination === 'cloud') setScheduleDestination('local');
  }, [backupDestination, cloudAvailable, scheduleDestination]);

  useEffect(() => {
    if (!activeJobId) return;
    const timer = window.setInterval(() => {
      void refetchBackupStatus();
      void refetchBackups();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [activeJobId, refetchBackupStatus, refetchBackups]);

  useEffect(() => {
    if (jobs.some((job) => job.state === 'succeeded' || job.state === 'failed' || job.state === 'canceled')) {
      void refetchBackups();
    }
  }, [jobs, refetchBackups]);

  const filteredBackups = useMemo(() => {
    const from = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : 0;
    const to = toDate ? new Date(`${toDate}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
    return backups.filter((backup) => {
      const ts = new Date(backup.createdAt).getTime();
      if (ts < from || ts > to) return false;
      if (agentFilter !== 'all' && !(backup.agents ?? []).includes(agentFilter)) return false;
      if (kindFilter !== 'all' && backup.kind !== kindFilter) return false;
      if (locationFilter !== 'all' && backup.location !== locationFilter) return false;
      return true;
    });
  }, [agentFilter, backups, fromDate, kindFilter, locationFilter, toDate]);

  const protectedCount = safety.filter((s) => s.state === 'protected').length;
  const localCount = backups.filter((b) => b.location !== 'cloud').length;
  const cloudCount = backups.filter((b) => b.location === 'cloud').length;
  const totalBytes = backups.reduce((sum, b) => sum + backupDisplayBytes(b), 0);

  const toggleSelected = (agent: string, setter: (next: string[]) => void, current: string[]) => {
    setter(current.includes(agent) ? current.filter((a) => a !== agent) : [...current, agent].sort());
  };

  const runBackup = async (agentList: string[], destination: BackupDestination) => {
    if (backupBusy) return;
    try {
      const job = await createBackup.mutateAsync({
        agents: agentList.length > 0 ? agentList : undefined,
        destination,
      });
      toast.success(job.destination === 'cloud' ? t('backups.create.startedCloud') : t('backups.create.started'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('backups.create.error'));
    }
  };

  const cancelBackup = async () => {
    if (!activeJob || backupCanceling) return;
    try {
      await cancelBackupJob.mutateAsync(activeJob.id);
      toast.info(t('backups.create.cancelled'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('backups.create.cancelError'));
    }
  };

  const runOverride = async (agent: string) => {
    try {
      await overrideBlocker.mutateAsync(agent);
      toast.success(t('backups.safety.overrideDone', { agent }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('backups.safety.overrideError'));
    }
  };

  const onSaveSchedule = async () => {
    try {
      await saveSchedule.mutateAsync({
        enabled: scheduleEnabled,
        intervalMinutes: scheduleInterval,
        agents: scheduleAgents,
        destination: scheduleDestination,
        lastRunAt: status?.schedule?.lastRunAt ?? '',
        nextRunAt: status?.schedule?.nextRunAt ?? '',
      });
      toast.success(t('backups.schedule.done'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('backups.schedule.error'));
    }
  };

  const setRetentionLimit = (agent: string, value: number) => {
    setRetentionByAgent((current) => ({
      ...current,
      [agent]: Math.max(1, Math.min(100, Number.isFinite(value) ? Math.trunc(value) : 1)),
    }));
  };

  const onSaveRetention = async () => {
    try {
      await saveRetention.mutateAsync({ perAgent: retentionByAgent });
      toast.success(t('backups.retention.done'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('backups.retention.error'));
    }
  };

  const resetFilters = () => {
    setFromDate('');
    setToDate('');
    setAgentFilter('all');
    setKindFilter('all');
    setLocationFilter('all');
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('backups.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('backups.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => runBackup([], backupDestination)}
            disabled={backupBusy || agents.length === 0 || (backupDestination === 'cloud' && !cloudAvailable)}
            aria-busy={backupBusy}
            className={`relative inline-flex min-w-[8.5rem] items-center justify-center gap-2 overflow-hidden rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-70 ${backupBusy ? 'apx-backup-button-active' : ''}`}
          >
            <BackupButtonContent
              running={backupBusy}
              idleLabel={t('backups.create.all')}
              runningLabel={backupCanceling ? t('backups.create.canceling') : t('backups.create.running')}
            />
          </button>
          {activeJob ? (
            <button
              type="button"
              onClick={cancelBackup}
              disabled={backupCanceling}
              className="inline-flex items-center gap-1.5 rounded-md border border-destructive/50 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              {backupCanceling ? t('backups.create.canceling') : t('backups.create.cancel')}
            </button>
          ) : null}
        </div>
      </header>

      {isLoading || statusLoading ? (
        <Loading />
      ) : error || statusError ? (
        <p className="text-sm text-destructive">
          {error instanceof Error
            ? error.message
            : statusError instanceof Error
              ? statusError.message
              : t('app.error')}
        </p>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <MetricCard label={t('backups.metrics.protected')} value={`${protectedCount} / ${agents.length}`} detail={t('backups.metrics.protectedDetail')} icon={CheckCircle2} />
            <MetricCard label={t('backups.metrics.cloud')} value={cloudAvailable ? t('backups.cloud.available') : t('backups.cloud.unavailable')} detail={cloud?.message || t('backups.cloud.localOnly')} icon={Cloud} />
            <MetricCard label={t('backups.metrics.history')} value={`${localCount} / ${cloudCount}`} detail={t('backups.metrics.historyDetail')} icon={History} />
            <MetricCard label={t('backups.metrics.storage')} value={formatBytes(totalBytes)} detail={t('backups.metrics.storageDetail')} icon={HardDrive} />
          </div>

          {activeJob ? (
            <ActiveBackupJobBanner
              job={activeJob}
              canceling={backupCanceling}
              onCancel={cancelBackup}
            />
          ) : null}

          <SafetySection
            safety={safety}
            onBackup={(agent) => runBackup([agent], backupDestination)}
            onOverride={runOverride}
            busy={backupBusy || overrideBlocker.isPending}
          />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <section className="rounded-md border border-border bg-background p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <DatabaseBackup className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <h2 className="text-sm font-semibold">{t('backups.create.title')}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => runBackup(selectedAgents, backupDestination)}
                    disabled={backupBusy || agents.length === 0 || (backupDestination === 'cloud' && !cloudAvailable)}
                    aria-busy={backupBusy}
                    className={`relative inline-flex min-w-[8.25rem] items-center justify-center overflow-hidden rounded-md border border-accent/50 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-70 ${backupBusy ? 'apx-backup-button-active apx-backup-button-active-subtle' : ''}`}
                  >
                    <BackupButtonContent
                      running={backupBusy}
                      idleLabel={t('backups.create.selected')}
                      runningLabel={backupCanceling ? t('backups.create.canceling') : t('backups.create.running')}
                    />
                  </button>
                  {activeJob ? (
                    <button
                      type="button"
                      onClick={cancelBackup}
                      disabled={backupCanceling}
                      className="inline-flex items-center gap-1 rounded-md border border-destructive/50 px-2.5 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                      {backupCanceling ? t('backups.create.canceling') : t('backups.create.cancel')}
                    </button>
                  ) : null}
                </div>
              </div>
              <DestinationControl
                value={backupDestination}
                onChange={setBackupDestination}
                cloudAvailable={cloudAvailable}
              />
              <AgentCheckboxes
                agents={agents}
                selected={selectedAgents}
                onToggle={(agent) => toggleSelected(agent, setSelectedAgents, selectedAgents)}
              />
            </section>

            <section className="rounded-md border border-border bg-background p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <h2 className="text-sm font-semibold">{t('backups.schedule.title')}</h2>
                </div>
                <button
                  type="button"
                  onClick={onSaveSchedule}
                  disabled={saveSchedule.isPending || agents.length === 0 || (scheduleDestination === 'cloud' && !cloudAvailable)}
                  className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saveSchedule.isPending ? t('backups.schedule.saving') : t('backups.schedule.save')}
                </button>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-[8rem_minmax(0,1fr)]">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={scheduleEnabled}
                    onChange={(e) => setScheduleEnabled(e.target.checked)}
                    className="h-4 w-4 accent-accent"
                  />
                  {t('backups.schedule.enabled')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {schedulePresets.map((preset) => (
                    <button
                      key={preset.minutes}
                      type="button"
                      onClick={() => setScheduleInterval(preset.minutes)}
                      className={`rounded-md border px-2.5 py-1.5 text-xs ${
                        scheduleInterval === preset.minutes
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {t(preset.label)}
                    </button>
                  ))}
                  <label className="inline-flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs">
                    {t('backups.schedule.custom')}
                    <input
                      type="number"
                      min={15}
                      step={15}
                      value={scheduleInterval}
                      onChange={(e) => setScheduleInterval(Math.max(15, Number(e.target.value) || 15))}
                      className="w-20 bg-transparent text-sm outline-none"
                    />
                  </label>
                </div>
              </div>
              <DestinationControl
                value={scheduleDestination}
                onChange={setScheduleDestination}
                cloudAvailable={cloudAvailable}
              />
              <AgentCheckboxes
                agents={agents}
                selected={scheduleAgents}
                onToggle={(agent) => toggleSelected(agent, setScheduleAgents, scheduleAgents)}
              />
              {status?.schedule?.nextRunAt ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  {t('backups.schedule.next', { time: new Date(status.schedule.nextRunAt).toLocaleString() })}
                </p>
              ) : null}
            </section>
          </div>

          <section className="rounded-md border border-border bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-sm font-semibold">{t('backups.history.title')}</h2>
              </div>
              <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
                {t('backups.history.count', { count: filteredBackups.length })}
              </span>
            </div>
            <BackupFilters
              agents={agents}
              fromDate={fromDate}
              toDate={toDate}
              agentFilter={agentFilter}
              kindFilter={kindFilter}
              locationFilter={locationFilter}
              onFromDate={setFromDate}
              onToDate={setToDate}
              onAgentFilter={setAgentFilter}
              onKindFilter={setKindFilter}
              onLocationFilter={setLocationFilter}
              onReset={resetFilters}
            />
            {filteredBackups.length === 0 ? (
              <EmptyState title={t('backups.empty')} body={t('backups.emptyBody')} />
            ) : (
              <BackupHistoryTable
                backups={filteredBackups}
                restoreScopes={restoreScopes}
                onScopeChange={(backupId, value) => setRestoreScopes((current) => ({ ...current, [backupId]: value }))}
                onRestore={(backup) => setTarget({ backup, agent: restoreScopes[backup.id] ?? '' })}
                onDelete={(backup) => setDeleteTarget({ backup })}
              />
            )}
          </section>

          <section className="rounded-md border border-border bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">{t('backups.retention.title')}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{t('backups.retention.body')}</p>
              </div>
              <button
                type="button"
                onClick={onSaveRetention}
                disabled={saveRetention.isPending || agents.length === 0}
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saveRetention.isPending ? t('backups.retention.saving') : t('backups.retention.save')}
              </button>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {agents.map((agent) => (
                <label
                  key={agent}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate">{agent}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{t('backups.retention.keep')}</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      step={1}
                      value={retentionByAgent[agent] ?? 5}
                      onChange={(e) => setRetentionLimit(agent, Number(e.target.value))}
                      aria-label={t('backups.retention.agentLabel', { agent })}
                      className="w-16 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    />
                  </span>
                </label>
              ))}
            </div>
          </section>
        </>
      )}

      {target ? <RestoreConfirmModal target={target} onClose={() => setTarget(null)} /> : null}
      {deleteTarget ? <DeleteConfirmModal target={deleteTarget} onClose={() => setDeleteTarget(null)} /> : null}
    </div>
  );
}

function BackupButtonContent({
  running,
  idleLabel,
  runningLabel,
}: {
  running: boolean;
  idleLabel: string;
  runningLabel: string;
}) {
  return (
    <span className="relative z-10 inline-flex items-center justify-center gap-2">
      {running ? (
        <span className="apx-backup-activity-ring" aria-hidden="true" />
      ) : (
        <DatabaseBackup className="h-4 w-4" aria-hidden="true" />
      )}
      <span>{running ? runningLabel : idleLabel}</span>
    </span>
  );
}

function ActiveBackupJobBanner({
  job,
  canceling,
  onCancel,
}: {
  job: BackupJob;
  canceling: boolean;
  onCancel: () => void;
}) {
  const started = job.startedAt || job.createdAt;
  const agents = job.agents.length > 0 ? job.agents.join(', ') : t('backups.create.allAgents');
  return (
    <section className="rounded-md border border-accent/35 bg-accent/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-accent/35 bg-background text-accent">
            <span className="apx-backup-activity-ring" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">
              {canceling ? t('backups.jobs.cancelingTitle') : t('backups.jobs.runningTitle')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('backups.jobs.runningBody', {
                destination: job.destination === 'cloud' ? t('backups.destination.cloud') : t('backups.destination.local'),
                agents,
                started: started ? formatRelative(started) : t('common.now'),
              })}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={canceling}
          className="inline-flex items-center gap-1.5 rounded-md border border-destructive/50 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          {canceling ? t('backups.create.canceling') : t('backups.create.cancel')}
        </button>
      </div>
    </section>
  );
}

function isActiveBackupJob(job: BackupJob): boolean {
  return job.state === 'running' || job.state === 'canceling';
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof CheckCircle2;
}) {
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-3 text-2xl font-semibold">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <span className="rounded-md border border-border bg-background p-2 text-muted-foreground">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}

function DestinationControl({
  value,
  onChange,
  cloudAvailable,
}: {
  value: BackupDestination;
  onChange: (value: BackupDestination) => void;
  cloudAvailable: boolean;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onChange('local')}
        className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
          value === 'local' ? 'border-accent bg-accent/10 text-accent' : 'border-border hover:bg-muted'
        }`}
      >
        <HardDrive className="h-4 w-4" aria-hidden="true" />
        {t('backups.destination.local')}
      </button>
      <button
        type="button"
        onClick={() => cloudAvailable && onChange('cloud')}
        disabled={!cloudAvailable}
        className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
          value === 'cloud' ? 'border-accent bg-accent/10 text-accent' : 'border-border hover:bg-muted'
        }`}
      >
        <Cloud className="h-4 w-4" aria-hidden="true" />
        {t('backups.destination.cloud')}
      </button>
      <span className="text-xs text-muted-foreground">
        {cloudAvailable ? t('backups.destination.cloudReady') : t('backups.destination.cloudUnavailable')}
      </span>
    </div>
  );
}

function SafetySection({
  safety,
  onBackup,
  onOverride,
  busy,
}: {
  safety: SafetyStatus[];
  onBackup: (agent: string) => void;
  onOverride: (agent: string) => void;
  busy: boolean;
}) {
  if (safety.length === 0) {
    return <EmptyState title={t('backups.safety.empty')} body={t('backups.safety.emptyBody')} />;
  }
  return (
    <section className="rounded-md border border-border bg-background">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{t('backups.safety.title')}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">{t('backups.table.agent')}</th>
              <th className="px-4 py-2 text-left font-medium">{t('backups.table.status')}</th>
              <th className="px-4 py-2 text-left font-medium">{t('backups.table.roots')}</th>
              <th className="px-4 py-2 text-left font-medium">{t('backups.table.lastBackup')}</th>
              <th className="px-4 py-2 text-right font-medium">{t('backups.table.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {safety.map((item) => (
              <tr key={item.agent}>
                <td className="px-4 py-3 font-medium">{item.agent}</td>
                <td className="px-4 py-3"><SafetyBadge item={item} /></td>
                <td className="px-4 py-3 text-muted-foreground">{item.lastError || t('backups.safety.roots', { count: item.roots.length })}</td>
                <td className="px-4 py-3 text-muted-foreground">{item.lastBackupAt ? formatRelative(item.lastBackupAt) : t('common.never')}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onBackup(item.agent)}
                      disabled={busy}
                      className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t('backups.safety.backup')}
                    </button>
                    {item.blocked || item.state === 'backup_required' ? (
                      <button
                        type="button"
                        onClick={() => onOverride(item.agent)}
                        disabled={busy}
                        className="rounded-md border border-warning/50 px-3 py-1.5 text-sm text-warning hover:bg-warning/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {t('backups.safety.override')}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SafetyBadge({ item }: { item: SafetyStatus }) {
  const blocked = item.blocked || item.state === 'blocked';
  const overridden = item.override || item.state === 'overridden';
  const protectedState = item.state === 'protected';
  const Icon = blocked ? ShieldAlert : protectedState ? CheckCircle2 : AlertTriangle;
  const cls = blocked
    ? 'border-destructive/40 text-destructive'
    : overridden
      ? 'border-warning/50 text-warning'
      : protectedState
        ? 'border-success/40 text-success'
        : 'border-border text-muted-foreground';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${cls}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {t(`backups.safety.state.${item.state}`)}
    </span>
  );
}

function AgentCheckboxes({
  agents,
  selected,
  onToggle,
}: {
  agents: string[];
  selected: string[];
  onToggle: (agent: string) => void;
}) {
  if (agents.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {agents.map((agent) => (
        <label
          key={agent}
          className="inline-flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm"
        >
          <input
            type="checkbox"
            checked={selected.includes(agent)}
            onChange={() => onToggle(agent)}
            className="h-4 w-4 accent-accent"
          />
          {agent}
        </label>
      ))}
      <span className="self-center text-xs text-muted-foreground">
        {selected.length === 0 ? t('backups.create.allSelected') : t('backups.create.countSelected', { count: selected.length })}
      </span>
    </div>
  );
}

function BackupFilters({
  agents,
  fromDate,
  toDate,
  agentFilter,
  kindFilter,
  locationFilter,
  onFromDate,
  onToDate,
  onAgentFilter,
  onKindFilter,
  onLocationFilter,
  onReset,
}: {
  agents: string[];
  fromDate: string;
  toDate: string;
  agentFilter: string;
  kindFilter: BackupKindFilter;
  locationFilter: BackupLocationFilter;
  onFromDate: (value: string) => void;
  onToDate: (value: string) => void;
  onAgentFilter: (value: string) => void;
  onKindFilter: (value: BackupKindFilter) => void;
  onLocationFilter: (value: BackupLocationFilter) => void;
  onReset: () => void;
}) {
  return (
    <div className="mt-3 grid gap-2 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {t('backups.filters.from')}
        <input type="date" value={fromDate} onChange={(e) => onFromDate(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {t('backups.filters.to')}
        <input type="date" value={toDate} onChange={(e) => onToDate(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {t('backups.filters.agent')}
        <select value={agentFilter} onChange={(e) => onAgentFilter(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground">
          <option value="all">{t('backups.filters.allAgents')}</option>
          {agents.map((agent) => <option key={agent} value={agent}>{agent}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {t('backups.filters.type')}
        <select value={kindFilter} onChange={(e) => onKindFilter(e.target.value as BackupKindFilter)} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground">
          <option value="all">{t('backups.filters.allTypes')}</option>
          <option value="manual">{t('backups.snapshot.manual')}</option>
          <option value="scheduled">{t('backups.snapshot.scheduled')}</option>
          <option value="pre-sync">{t('backups.snapshot.safety')}</option>
          <option value="pre-restore">{t('backups.snapshot.undo')}</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {t('backups.filters.location')}
        <select value={locationFilter} onChange={(e) => onLocationFilter(e.target.value as BackupLocationFilter)} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground">
          <option value="all">{t('backups.filters.allLocations')}</option>
          <option value="local">{t('backups.destination.local')}</option>
          <option value="cloud">{t('backups.destination.cloud')}</option>
        </select>
      </label>
      <button type="button" onClick={onReset} className="mt-auto inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
        <Filter className="h-4 w-4" aria-hidden="true" />
        {t('backups.filters.reset')}
      </button>
    </div>
  );
}

function BackupHistoryTable({
  backups,
  restoreScopes,
  onScopeChange,
  onRestore,
  onDelete,
}: {
  backups: BackupInfo[];
  restoreScopes: Record<string, string>;
  onScopeChange: (backupId: string, value: string) => void;
  onRestore: (backup: BackupInfo) => void;
  onDelete: (backup: BackupInfo) => void;
}) {
  return (
    <div className="mt-4 overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[980px] text-sm">
        <thead className="bg-surface text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">{t('backups.table.created')}</th>
            <th className="px-3 py-2 text-left font-medium">{t('backups.table.location')}</th>
            <th className="px-3 py-2 text-left font-medium">{t('backups.table.type')}</th>
            <th className="px-3 py-2 text-left font-medium">{t('backups.table.agents')}</th>
            <th className="px-3 py-2 text-right font-medium">{t('backups.table.size')}</th>
            <th className="px-3 py-2 text-right font-medium">{t('backups.table.files')}</th>
            <th className="px-3 py-2 text-left font-medium">{t('backups.table.device')}</th>
            <th className="px-3 py-2 text-right font-medium">{t('backups.table.actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {backups.map((backup) => (
            <tr key={`${backup.location}-${backup.id}`} className="align-middle">
              <td className="px-3 py-2">
                <div className="flex flex-col">
                  <span>{new Date(backup.createdAt).toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground">{formatRelative(backup.createdAt)}</span>
                </div>
              </td>
              <td className="px-3 py-2"><LocationBadge backup={backup} /></td>
              <td className="px-3 py-2">{snapshotTitle(backup.kind)}</td>
              <td className="px-3 py-2">
                <span className="line-clamp-2 text-muted-foreground">{(backup.agents ?? []).join(', ') || t('common.none')}</span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{formatBytes(backupDisplayBytes(backup))}</td>
              <td className="px-3 py-2 text-right tabular-nums">{backup.fileCount}</td>
              <td className="px-3 py-2 text-muted-foreground">{backup.originDeviceName || t('backups.table.thisDevice')}</td>
              <td className="px-3 py-2">
                <div className="flex justify-end gap-2">
                  {(backup.agents ?? []).length > 1 ? (
                    <select
                      value={restoreScopes[backup.id] ?? ''}
                      onChange={(e) => onScopeChange(backup.id, e.target.value)}
                      className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                    >
                      <option value="">{t('backups.restoreAll')}</option>
                      {(backup.agents ?? []).map((agent) => <option key={agent} value={agent}>{agent}</option>)}
                    </select>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onRestore(backup)}
                    className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('backups.restore')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(backup)}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('backups.delete')}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeleteConfirmModal({ target, onClose }: { target: DeleteTarget; onClose: () => void }) {
  const remove = useDeleteNativeBackup();
  const [typed, setTyped] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const phrase = t('backups.deleteConfirm.phrase');
  const armed = typed.trim() === phrase && !remove.isPending;
  const cloudBackup = target.backup.location === 'cloud';

  const onConfirm = async () => {
    if (!armed) return;
    try {
      await remove.mutateAsync({
        backupId: target.backup.id,
        location: target.backup.location,
      });
      toast.success(cloudBackup ? t('backups.deleteConfirm.doneCloud') : t('backups.deleteConfirm.doneLocal'));
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('backups.deleteConfirm.error'));
    }
  };

  return (
    <ModalDialog
      labelledBy="delete-backup-title"
      onClose={onClose}
      initialFocusRef={inputRef}
    >
        <div className="flex flex-col gap-1">
          <h2 id="delete-backup-title" className="text-lg font-semibold text-destructive">
            {t('backups.deleteConfirm.title')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('backups.deleteConfirm.body', {
              type: snapshotTitle(target.backup.kind),
              location: cloudBackup ? t('backups.destination.cloudEncrypted') : t('backups.destination.local'),
            })}
          </p>
        </div>

        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-muted-foreground">
          {cloudBackup ? t('backups.deleteConfirm.cloudWarning') : t('backups.deleteConfirm.localWarning')}
        </div>

        <label className="flex flex-col gap-1.5 text-sm">
          <span>{t('backups.deleteConfirm.prompt', { phrase })}</span>
          <input
            ref={inputRef}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={phrase}
            aria-label={t('backups.deleteConfirm.inputLabel')}
            className="rounded-md border border-border bg-background px-2.5 py-2 font-mono text-sm"
          />
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!armed}
            className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {remove.isPending ? t('backups.deleteConfirm.deleting') : t('backups.deleteConfirm.confirm')}
          </button>
        </div>
    </ModalDialog>
  );
}

function LocationBadge({ backup }: { backup: BackupInfo }) {
  const cloud = backup.location === 'cloud';
  const Icon = cloud ? Cloud : HardDrive;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${cloud ? 'border-sky-500/40 text-sky-300' : 'border-border text-muted-foreground'}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {cloud ? t('backups.destination.cloudEncrypted') : t('backups.destination.local')}
    </span>
  );
}

function snapshotTitle(kind: string): string {
  switch (kind) {
    case 'manual':
      return t('backups.snapshot.manual');
    case 'scheduled':
      return t('backups.snapshot.scheduled');
    case 'pre-sync':
      return t('backups.snapshot.safety');
    case 'pre-restore':
      return t('backups.snapshot.undo');
    default:
      return t('backups.snapshot.generic');
  }
}

function backupDisplayBytes(backup: BackupInfo): number {
  return backup.location === 'cloud' && backup.encryptedBytes > 0 ? backup.encryptedBytes : backup.totalBytes;
}

function RestoreConfirmModal({ target, onClose }: { target: RestoreTarget; onClose: () => void }) {
  const restore = useRestoreNativeBackup();
  const [typed, setTyped] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const phrase = t('backups.confirm.phrase');
  const armed = typed.trim() === phrase && !restore.isPending;
  const scope = target.agent || t('backups.confirm.allAgents');
  const safetySnapshot = target.backup.kind === 'pre-sync';
  const cloudBackup = target.backup.location === 'cloud';

  const onConfirm = async () => {
    if (!armed) return;
    try {
      const res = await restore.mutateAsync({
        backupId: target.backup.id,
        agent: target.agent || undefined,
        location: target.backup.location,
      });
      const failed = res.files.filter((f) => !f.ok).length;
      if (failed > 0) {
        toast.error(t('backups.confirm.partial', { failed, total: res.files.length }));
      } else {
        toast.success(
          safetySnapshot
            ? t('backups.confirm.doneSafety', { count: res.files.length })
            : t('backups.confirm.done', { count: res.files.length }),
        );
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('backups.confirm.error'));
    }
  };

  return (
    <ModalDialog
      labelledBy="restore-confirm-title"
      onClose={onClose}
      initialFocusRef={inputRef}
    >
        <div className="flex flex-col gap-1">
          <h2 id="restore-confirm-title" className="text-lg font-semibold text-destructive">
            {safetySnapshot ? t('backups.confirm.safetyTitle') : t('backups.confirm.title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('backups.confirm.body', { scope })}</p>
        </div>

        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-muted-foreground">
          {cloudBackup ? t('backups.confirm.cloudWarning') : t('backups.confirm.warning')}
        </div>

        <label className="flex flex-col gap-1.5 text-sm">
          <span>{t('backups.confirm.prompt', { phrase })}</span>
          <input
            ref={inputRef}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={phrase}
            aria-label={t('backups.confirm.inputLabel')}
            className="rounded-md border border-border bg-background px-2.5 py-2 font-mono text-sm"
          />
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!armed}
            className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {restore.isPending ? t('backups.confirm.restoring') : t('backups.confirm.confirm')}
          </button>
        </div>
    </ModalDialog>
  );
}
