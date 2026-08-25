// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { FolderClock } from 'lucide-react';
import { t } from '@shared/i18n';
import { Loading } from '@shared/components/Loading';
import { EmptyState } from '@shared/components/EmptyState';
import { PageHeader, Badge } from '@shared/components/ui';
import { CheckboxGroup } from '@shared/components/ui/CheckboxGroup';
import { formatRelativeUnix } from '@shared/lib/time';
import {
  useApprovePending,
  useDenyPending,
  useDismissSuggestion,
  useLinkPending,
  usePending,
  useRestorePending,
} from '../hooks/usePending';
import { useAgents } from '../hooks/useAgents';
import { useAddProject, useProjects } from '../hooks/useProjects';
import { editSelection, normalizeAgentSelection } from '../lib/agent-selection';
import {
  LinkRequestSchema,
  type LinkRequest,
  type PendingProject,
  type ProjectScope,
} from '@shared/schemas';

/**
 * Default scope for an approve: Global when the sample path looks like the
 * user's home directory itself, otherwise Folder-local. Git repos are a single
 * project, so they default Local too.
 */
function defaultScope(p: PendingProject): ProjectScope {
  const path = p.samplePath ?? '';
  const norm = path.replace(/\/+$/, '');
  // A home-directory root is global; a nested path or git repo is local.
  const isHomeRoot =
    /^\/(?:Users|home)\/[^/]+$/.test(norm) ||
    /^[A-Za-z]:\\Users\\[^\\]+$/.test(norm);
  if (isHomeRoot) return 'global';
  return 'local';
}

function isPathlessArtifact(p: PendingProject): boolean {
  return p.source === 'artifact' && !p.samplePath;
}

export default function PendingProjectsPage() {
  const { data, isLoading, error } = usePending();
  const approve = useApprovePending();
  const link = useLinkPending();
  const deny = useDenyPending();
  const restore = useRestorePending();
  const dismissSuggestion = useDismissSuggestion();
  const addProject = useAddProject();
  const { data: agents } = useAgents();
  const { data: projects } = useProjects();

  const installed = (agents ?? []).filter((a) => a.installed).map((a) => a.name);

  // Split rows: agent-join suggestions, active pending folders, and the denied list.
  const suggestionRows = (data ?? []).filter((p) => p.source === 'agent-suggestion');
  const pendingRows = (data ?? []).filter((p) => !p.denied && p.source !== 'agent-suggestion');
  const deniedRows = (data ?? []).filter((p) => p.denied);

  // Accept a suggestion: add its agents to the registered project's agent set.
  const onAcceptSuggestion = async (row: PendingProject) => {
    const project = (projects ?? []).find((p) => p.id === row.id);
    const toAdd = row.suggestAgents ?? [];
    if (!project || toAdd.length === 0) return;
    const merged = Array.from(new Set([...project.agents, ...toAdd])).sort();
    try {
      await addProject.mutateAsync({ path: project.path, scope: project.scope, agents: merged });
      toast.success(t('pending.toast.agentAdded'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('pending.toast.error'));
    }
  };

  const onDismissSuggestion = async (row: PendingProject) => {
    try {
      await Promise.all(
        (row.suggestAgents ?? []).map((agent) =>
          dismissSuggestion.mutateAsync({ projectId: row.id, agent }),
        ),
      );
      toast.success(t('pending.toast.suggestionDismissed'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('pending.toast.error'));
    }
  };

  const onDeny = async (p: PendingProject) => {
    try {
      await deny.mutateAsync({ id: p.id, path: p.samplePath });
      toast.success(t('pending.toast.denied'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('pending.toast.error'));
    }
  };

  const onRestore = async (p: PendingProject) => {
    try {
      await restore.mutateAsync(p.id);
      toast.success(t('pending.toast.restored'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('pending.toast.error'));
    }
  };

  // Approve dialog state (discovered folders): row + chosen scope + the agents
  // that will sync to the folder (pre-filled from discovery, editable).
  const [approveFor, setApproveFor] = useState<PendingProject | null>(null);
  const [scope, setScope] = useState<ProjectScope>('local');
  const [approveAgents, setApproveAgents] = useState<string[]>([]);

  // Legacy link dialog (artifact-sourced rows without a sample path).
  const [linkFor, setLinkFor] = useState<string | null>(null);
  const linkForm = useForm<LinkRequest>({
    resolver: zodResolver(LinkRequestSchema),
    defaultValues: { localPath: '' },
  });

  const openApprove = (p: PendingProject) => {
    setLinkFor(null);
    setScope(defaultScope(p));
    setApproveAgents(editSelection(p.agents ?? [], installed));
    setApproveFor(p);
  };

  const onApprove = async () => {
    if (!approveFor || !approveFor.samplePath) return;
    const normalized = normalizeAgentSelection(approveAgents, installed);
    if (normalized === null) return; // guarded by disabled Approve
    try {
      await approve.mutateAsync({
        id: approveFor.id,
        body: {
          scope,
          path: approveFor.samplePath,
          // [] means "all agents" — send undefined to keep the body clean.
          agents: normalized.length ? normalized : undefined,
        },
      });
      toast.success(t('pending.toast.approved'));
      setApproveFor(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('pending.toast.error'));
    }
  };

  const onLink = linkForm.handleSubmit(async (values) => {
    if (!linkFor) return;
    try {
      await link.mutateAsync({ id: linkFor, body: values });
      toast.success(t('pending.toast.linked'));
      linkForm.reset();
      setLinkFor(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('pending.toast.error'));
    }
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={<FolderClock className="h-5 w-5" aria-hidden="true" />}
        title={t('pending.title')}
        subtitle={t('pending.subtitle')}
      />

      {suggestionRows.length > 0 ? (
        <section className="flex flex-col gap-2 rounded-md border border-accent/30 bg-accent/5 p-4">
          <h2 className="text-sm font-semibold">{t('pending.suggestions.title')}</h2>
          <p className="text-xs text-muted-foreground">{t('pending.suggestions.subtitle')}</p>
          <ul className="flex flex-col gap-2">
            {suggestionRows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2"
              >
                <span className="text-sm">
                  {t('pending.suggestions.row', {
                    agents: (row.suggestAgents ?? []).join(', '),
                    path: row.samplePath ?? row.id,
                  })}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void onAcceptSuggestion(row)}
                    disabled={addProject.isPending}
                    className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60"
                  >
                    {t('pending.suggestions.add', { agents: (row.suggestAgents ?? []).join(', ') })}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDismissSuggestion(row)}
                    disabled={dismissSuggestion.isPending}
                    className="rounded-md border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-60"
                  >
                    {t('pending.suggestions.dismiss')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {isLoading ? (
        <Loading />
      ) : error ? (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : t('app.error')}
        </p>
      ) : pendingRows.length === 0 ? (
        suggestionRows.length === 0 && deniedRows.length === 0 ? (
          <EmptyState title={t('pending.empty')} />
        ) : null
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-4 font-medium">{t('pending.columns.path')}</th>
              <th className="py-2 pr-4 font-medium">{t('pending.columns.agents')}</th>
              <th className="py-2 pr-4 font-medium">{t('pending.columns.lastActive')}</th>
              <th className="py-2 pr-4 font-medium">{t('pending.columns.type')}</th>
              <th className="py-2 pr-4 font-medium">{t('pending.columns.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {pendingRows.map((p) => {
              const discovered = p.source === 'discovered';
              const pathlessArtifact = isPathlessArtifact(p);
              const canApprove = Boolean(p.samplePath);
              const sourceLabel = pathlessArtifact
                ? t('pending.source.pathlessArtifact')
                : discovered
                  ? t('pending.source.discovered')
                  : t('pending.source.artifact');
              const sourceTip = pathlessArtifact
                ? t('pending.source.pathlessArtifactTip')
                : discovered
                  ? t('pending.source.discoveredTip')
                  : t('pending.source.artifactTip');
              const sourceTone = pathlessArtifact ? 'warning' : discovered ? 'accent' : 'neutral';
              return (
                <tr key={p.id} className="border-b border-border last:border-b-0 align-top hover:bg-muted/40">
                  <td className="py-2.5 pr-4">
                    <PendingProjectIdentity project={p} />
                  </td>
                  <td className="py-2.5 pr-4">
                    {p.agents?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {p.agents.map((a) => (
                          <Badge key={a} tone="outline" className="font-mono">
                            {a}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">{t('pending.noAgents')}</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">
                    {formatRelativeUnix(p.lastActive)}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span title={sourceTip}>
                      <Badge tone={sourceTone}>{sourceLabel}</Badge>
                    </span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <div className="flex gap-2">
                      {canApprove ? (
                        <button
                          type="button"
                          onClick={() => openApprove(p)}
                          className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground hover:opacity-90"
                        >
                          {t('pending.approve')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setApproveFor(null);
                            setLinkFor(p.id);
                          }}
                          className="rounded-md border border-border bg-background px-2.5 py-1 text-xs hover:bg-muted"
                        >
                          {t(pathlessArtifact ? 'pending.linkFolder' : 'pending.link')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void onDeny(p)}
                        disabled={deny.isPending}
                        className="rounded-md border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-60"
                      >
                        {t('pending.deny')}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {deniedRows.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t('pending.denied.title')}
          </h2>
          <p className="text-xs text-muted-foreground">{t('pending.denied.subtitle')}</p>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4 font-medium">{t('pending.columns.path')}</th>
                <th className="py-2 pr-4 font-medium">{t('pending.columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {deniedRows.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-b-0 align-top hover:bg-muted/40">
                  <td className="py-2.5 pr-4">
                    <PendingProjectIdentity project={p} />
                  </td>
                  <td className="py-2.5 pr-4">
                    <div className="flex gap-2">
                      {p.samplePath ? (
                        <button
                          type="button"
                          onClick={() => openApprove(p)}
                          className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground hover:opacity-90"
                        >
                          {t('pending.approve')}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void onRestore(p)}
                        disabled={restore.isPending}
                        className="rounded-md border border-border bg-background px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-60"
                      >
                        {t('pending.denied.restore')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {approveFor ? (
        <Modal labelledBy="pending-approve-title" onClose={() => setApproveFor(null)}>
          <h2 id="pending-approve-title" className="text-sm font-semibold">
            {t('pending.approveDialog.title')}
          </h2>
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t('pending.approveDialog.pathLabel')}</span>
            <span className="font-mono text-xs text-foreground">{approveFor.samplePath}</span>
          </div>
          <fieldset className="flex flex-col gap-1.5 text-sm">
            <legend className="mb-1">{t('pending.approveDialog.scopeLabel')}</legend>
            <div className="flex gap-2">
              <ScopeButton
                active={scope === 'local'}
                label={t('pending.approveDialog.scopeLocal')}
                onClick={() => setScope('local')}
              />
              <ScopeButton
                active={scope === 'global'}
                label={t('pending.approveDialog.scopeGlobal')}
                onClick={() => setScope('global')}
              />
            </div>
            <span className="text-xs text-muted-foreground">{t('pending.approveDialog.scopeHint')}</span>
          </fieldset>
          <fieldset className="flex flex-col gap-1.5 text-sm">
            <legend className="mb-1">{t('pending.approveDialog.agentsLabel')}</legend>
            <CheckboxGroup
              ariaLabel={t('pending.approveDialog.agentsLabel')}
              options={installed.map((name) => ({ value: name, label: name }))}
              value={approveAgents}
              onChange={setApproveAgents}
            />
            <span className="text-xs text-muted-foreground">{t('pending.approveDialog.agentsHint')}</span>
          </fieldset>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onApprove}
              disabled={approve.isPending || normalizeAgentSelection(approveAgents, installed) === null}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60"
            >
              {t('pending.approveDialog.submit')}
            </button>
            <button
              type="button"
              onClick={() => setApproveFor(null)}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted"
            >
              {t('pending.approveDialog.cancel')}
            </button>
          </div>
        </Modal>
      ) : null}

      {linkFor ? (
        <Modal labelledBy="pending-link-title" onClose={() => setLinkFor(null)}>
          <form onSubmit={onLink} className="flex flex-col gap-3">
            <h2 id="pending-link-title" className="text-sm font-semibold">
              {t('pending.linkDialog.title', { id: linkFor })}
            </h2>
            <p className="text-xs text-muted-foreground">{t('pending.linkDialog.help')}</p>
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('pending.linkDialog.pathLabel')}</span>
              <input
                {...linkForm.register('localPath')}
                placeholder={t('pending.linkDialog.pathPlaceholder')}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                aria-invalid={Boolean(linkForm.formState.errors.localPath) || undefined}
              />
              {linkForm.formState.errors.localPath ? (
                <span role="alert" className="text-xs text-destructive">
                  {linkForm.formState.errors.localPath.message}
                </span>
              ) : null}
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={link.isPending}
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60"
              >
                {t('pending.linkDialog.submit')}
              </button>
              <button
                type="button"
                onClick={() => setLinkFor(null)}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted"
              >
                {t('pending.linkDialog.cancel')}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function PendingProjectIdentity({ project }: { project: PendingProject }) {
  if (!project.samplePath) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
          {t('pending.projectId')}
        </span>
        <span className="font-mono text-xs text-foreground">{project.id}</span>
        <span className="text-xs text-muted-foreground">{t('pending.noLocalPath')}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-xs text-foreground">{project.samplePath}</span>
      {project.isGitRepo !== undefined ? (
        <span className="w-fit">
          <Badge tone={project.isGitRepo ? 'success' : 'neutral'}>
            {project.isGitRepo ? t('pending.git.repo') : t('pending.git.notRepo')}
          </Badge>
        </span>
      ) : null}
    </div>
  );
}

/**
 * Modal renders its children in a fixed, viewport-anchored overlay near the top
 * of the screen with a dimmed backdrop — so the dialog is always visible
 * regardless of how far the pending list has scrolled. Previously these dialogs
 * rendered inline at the bottom of the page flow, which on a long pending list
 * scrolled them out of view and made "Approve…" look like it did nothing.
 * Closes on backdrop click or Escape.
 */
function Modal({
  labelledBy,
  onClose,
  children,
}: {
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-[10vh]"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-md flex-col gap-3 rounded-lg border border-border bg-background p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function ScopeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        active
          ? 'rounded-md border border-accent bg-accent/12 px-3 py-1.5 text-sm font-medium text-accent'
          : 'rounded-md border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground'
      }
    >
      {label}
    </button>
  );
}
