// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowRight, GitBranch, GitBranchPlus } from 'lucide-react';
import { toast } from 'sonner';
import { t } from '@shared/i18n';
import { Badge } from '@shared/components/ui/Badge';
import { Loading } from '@shared/components/Loading';
import { useAgents } from '../hooks/useAgents';
import {
  useCheckoutConversation,
  useConversationBranches,
  useForkConversation,
} from '../hooks/useConversationBranches';
import { formatTimestamp } from '../lib/format';

export interface ForkSourceOption {
  label: string;
  eventId: string;
  sourceAgent?: string;
}

export function ConversationBranchesPanel({
  artifactId,
  forkSources = [],
}: {
  artifactId: string;
  forkSources?: ForkSourceOption[];
}) {
  const branches = useConversationBranches(artifactId);
  const agents = useAgents();
  const fork = useForkConversation(artifactId);
  const checkout = useCheckoutConversation(artifactId);

  const agentChoices = useMemo(() => {
    const all = agents.data ?? [];
    const installed = all.filter((agent) => agent.installed !== false);
    return installed.length > 0 ? installed : all;
  }, [agents.data]);

  const branchChoices = useMemo(() => branches.data?.branches ?? [], [branches.data?.branches]);
  const activeBranchChoices = useMemo(
    () => branchChoices.filter((branch) => !branch.archived),
    [branchChoices],
  );
  const sourceOptions = useMemo<ForkSourceOption[]>(() => {
    if (forkSources.length > 0) return forkSources;
    return activeBranchChoices
      .filter((branch) => Boolean(branch.head))
      .map((branch) => ({
        label: t('conversationBranches.branchHead', { branch: branch.name }),
        eventId: branch.head as string,
        sourceAgent: t('conversationBranches.branchSource'),
      }));
  }, [activeBranchChoices, forkSources]);

  const [forkSourceId, setForkSourceId] = useState('');
  const [forkAgent, setForkAgent] = useState('');
  const [forkBranch, setForkBranch] = useState('');
  const [forkRationale, setForkRationale] = useState('');
  const [checkoutBranch, setCheckoutBranch] = useState('');
  const [checkoutAgent, setCheckoutAgent] = useState('');

  useEffect(() => {
    if (sourceOptions.length === 0) {
      if (forkSourceId) setForkSourceId('');
      return;
    }
    if (!sourceOptions.some((source) => source.eventId === forkSourceId)) {
      setForkSourceId(sourceOptions[0].eventId);
    }
  }, [forkSourceId, sourceOptions]);

  useEffect(() => {
    if (!forkAgent && agentChoices[0]) setForkAgent(agentChoices[0].name);
    if (!checkoutAgent && agentChoices[0]) setCheckoutAgent(agentChoices[0].name);
  }, [agentChoices, checkoutAgent, forkAgent]);

  useEffect(() => {
    if (!checkoutBranch && activeBranchChoices[0]) setCheckoutBranch(activeBranchChoices[0].name);
  }, [activeBranchChoices, checkoutBranch]);

  const runFork = async (event: FormEvent) => {
    event.preventDefault();
    if (!forkSourceId || !forkAgent) return;
    try {
      const result = await fork.mutateAsync({
        fromEventId: forkSourceId,
        targetAgent: forkAgent,
        branch: forkBranch.trim() || undefined,
        rationale: forkRationale.trim() || undefined,
      });
      toast.success(t('conversationBranches.toast.forked', { branch: result.branch, agent: result.agent }));
      if (result.warning) toast.warning(t('conversationBranches.toast.warning', { message: result.warning }));
      setForkBranch('');
      setForkRationale('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('conversationBranches.toast.error'));
    }
  };

  const runCheckout = async (event: FormEvent) => {
    event.preventDefault();
    if (!checkoutBranch || !checkoutAgent) return;
    try {
      const result = await checkout.mutateAsync({ branch: checkoutBranch, agent: checkoutAgent });
      toast.success(t('conversationBranches.toast.checkedOut', { branch: result.branch, agent: result.agent }));
      if (result.warning) toast.warning(t('conversationBranches.toast.warning', { message: result.warning }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('conversationBranches.toast.error'));
    }
  };

  const actionDisabled = fork.isPending || checkout.isPending || agentChoices.length === 0;

  return (
    <section className="rounded-md border border-border bg-background p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <GitBranch className="h-4 w-4" aria-hidden="true" />
            {t('conversationBranches.title')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('conversationBranches.subtitle')}</p>
        </div>
      </div>

      {branches.error ? (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {branches.error instanceof Error ? branches.error.message : t('conversationBranches.loadError')}
        </div>
      ) : branches.isLoading ? (
        <Loading />
      ) : branchChoices.length === 0 ? (
        <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          {t('conversationBranches.empty')}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
            <form onSubmit={runFork} className="rounded-md border border-border bg-muted/20 p-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <GitBranchPlus className="h-4 w-4" aria-hidden="true" />
                {t('conversationBranches.fork.title')}
              </h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {t('conversationBranches.fork.description')}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                  {t('conversationBranches.fork.from')}
                  <select
                    value={forkSourceId}
                    onChange={(event) => setForkSourceId(event.target.value)}
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  >
                    {sourceOptions.map((source) => (
                      <option key={source.eventId} value={source.eventId}>
                        {t('conversationBranches.sourceLabel', {
                          label: source.label,
                          agent: source.sourceAgent || t('conflicts.detail.unknownSource'),
                        })}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                  {t('conversationBranches.fork.agent')}
                  <AgentSelect value={forkAgent} onChange={setForkAgent} agents={agentChoices.map((agent) => agent.name)} />
                </label>
                <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                  {t('conversationBranches.fork.branch')}
                  <input
                    value={forkBranch}
                    onChange={(event) => setForkBranch(event.target.value)}
                    placeholder={t('conversationBranches.fork.branchPlaceholder')}
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                  {t('conversationBranches.fork.rationale')}
                  <input
                    value={forkRationale}
                    onChange={(event) => setForkRationale(event.target.value)}
                    placeholder={t('conversationBranches.fork.rationalePlaceholder')}
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={actionDisabled || !forkSourceId || sourceOptions.length === 0}
                className="mt-3 inline-flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60"
              >
                <GitBranchPlus className="h-4 w-4" aria-hidden="true" />
                {t('conversationBranches.fork.submit')}
              </button>
            </form>

            <form onSubmit={runCheckout} className="rounded-md border border-border bg-muted/20 p-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                {t('conversationBranches.checkout.title')}
              </h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {t('conversationBranches.checkout.description')}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                  {t('conversationBranches.checkout.branch')}
                  <select
                    value={checkoutBranch}
                    onChange={(event) => setCheckoutBranch(event.target.value)}
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  >
                    {activeBranchChoices.map((branch) => (
                      <option key={branch.name} value={branch.name}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                  {t('conversationBranches.checkout.agent')}
                  <AgentSelect value={checkoutAgent} onChange={setCheckoutAgent} agents={agentChoices.map((agent) => agent.name)} />
                </label>
              </div>
              <button
                type="submit"
                disabled={actionDisabled || !checkoutBranch || activeBranchChoices.length === 0}
                className="mt-3 inline-flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60"
              >
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                {t('conversationBranches.checkout.submit')}
              </button>
            </form>
          </div>

          <div className="overflow-x-auto rounded-md border border-border">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{t('conversationBranches.columns.branch')}</th>
                  <th className="px-3 py-2 font-medium">{t('conversationBranches.columns.events')}</th>
                  <th className="px-3 py-2 font-medium">{t('conversationBranches.columns.lastEvent')}</th>
                  <th className="px-3 py-2 font-medium">{t('conversationBranches.columns.state')}</th>
                  <th className="px-3 py-2 font-medium">{t('conversationBranches.columns.materialized')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {branchChoices.map((branch) => (
                  <tr key={branch.name}>
                    <td className="px-3 py-2">
                      <div className="flex min-w-[10rem] flex-col gap-1">
                        <span className="font-mono text-xs font-medium">{branch.name}</span>
                        {branch.forkedFromHash ? (
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {branch.forkedFromHash.slice(0, 12)}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{branch.eventCount}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {branch.lastEventAt ? formatTimestamp(branch.lastEventAt) : ''}
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={branch.archived ? 'warning' : branch.mergedInto ? 'info' : 'success'}>
                        {branchState(branch)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {branch.materializedAgents.length > 0 ? (
                          branch.materializedAgents.map((agent) => (
                            <Badge key={agent} tone="accent">
                              {agent}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {t('conversationBranches.materializedEmpty')}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function AgentSelect({
  value,
  onChange,
  agents,
}: {
  value: string;
  onChange: (value: string) => void;
  agents: string[];
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
    >
      {agents.length === 0 ? (
        <option value="">{t('conversationBranches.noAgents')}</option>
      ) : (
        agents.map((agent) => (
          <option key={agent} value={agent}>
            {agent}
          </option>
        ))
      )}
    </select>
  );
}

function branchState(branch: { archived?: boolean; mergedInto?: string }): string {
  if (branch.archived) return t('conversationBranches.state.archived');
  if (branch.mergedInto) return t('conversationBranches.state.merged', { branch: branch.mergedInto });
  return t('conversationBranches.state.active');
}
