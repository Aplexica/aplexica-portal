// SPDX-License-Identifier: AGPL-3.0-or-later
import { Fragment, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { FolderGit2 } from 'lucide-react';
import { t } from '@shared/i18n';
import { Loading } from '@shared/components/Loading';
import { EmptyState } from '@shared/components/EmptyState';
import { PageHeader, Badge } from '@shared/components/ui';
import { CheckboxGroup } from '@shared/components/ui/CheckboxGroup';
import { useAddProject, useProjectMemory, useProjects, useRemoveProject } from '../hooks/useProjects';
import { useAgents } from '../hooks/useAgents';
import { editSelection, normalizeAgentSelection } from '../lib/agent-selection';
import {
  AddProjectRequestSchema,
  type AddProjectRequest,
  type ProjectEntry,
  type ProjectScope,
} from '@shared/schemas';

export default function ProjectsPage() {
  const { data, isLoading, error } = useProjects();
  const { data: agents } = useAgents();
  const add = useAddProject();
  const remove = useRemoveProject();
  const [open, setOpen] = useState(false);

  // Inline agent/scope editor: which project row is being edited + its drafts.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [draftScope, setDraftScope] = useState<ProjectScope>('local');
  // Inline remove confirmation: the project id awaiting a confirm click.
  const [removingId, setRemovingId] = useState<string | null>(null);
  // Inline "effective memory" viewer: the project id whose memory is expanded.
  const [memoryId, setMemoryId] = useState<string | null>(null);
  const memory = useProjectMemory(memoryId);

  const installed = useMemo(
    () => (agents ?? []).filter((a) => a.installed).map((a) => a.name),
    [agents],
  );

  const form = useForm<AddProjectRequest>({
    resolver: zodResolver(AddProjectRequestSchema),
    defaultValues: { path: '', scope: 'local' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await add.mutateAsync(values);
      toast.success(t('projects.toast.added'));
      form.reset({ path: '', scope: 'local' });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('projects.toast.error'));
    }
  });

  const startEdit = (p: ProjectEntry) => {
    setRemovingId(null);
    setEditingId(p.id);
    setDraft(editSelection(p.agents, installed));
    setDraftScope(p.scope);
  };

  const saveEdit = async (p: ProjectEntry) => {
    const agentsValue = normalizeAgentSelection(draft, installed);
    if (agentsValue === null) return; // guarded by disabled Save
    try {
      await add.mutateAsync({ path: p.path, scope: draftScope, agents: agentsValue });
      toast.success(t('projects.toast.saved'));
      setEditingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('projects.toast.error'));
    }
  };

  const confirmRemove = async (p: ProjectEntry) => {
    try {
      await remove.mutateAsync(p.id);
      toast.success(t('projects.toast.removed'));
      setRemovingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('projects.toast.removeError'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={<FolderGit2 className="h-5 w-5" aria-hidden="true" />}
        title={t('projects.title')}
        subtitle={t('projects.subtitle')}
        actions={
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90"
          >
            {t('projects.addFolder')}
          </button>
        }
      />

      {open ? (
        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-3 rounded-md border border-border bg-background p-4"
        >
          <h2 className="text-sm font-semibold">{t('projects.addDialog.title')}</h2>
          <label className="flex flex-col gap-1 text-sm">
            <span>{t('projects.addDialog.pathLabel')}</span>
            <input
              {...form.register('path')}
              placeholder={t('projects.addDialog.pathPlaceholder')}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              aria-invalid={Boolean(form.formState.errors.path) || undefined}
            />
            {form.formState.errors.path ? (
              <span role="alert" className="text-xs text-destructive">
                {form.formState.errors.path.message}
              </span>
            ) : null}
          </label>
          <label className="flex flex-col gap-1 text-sm md:max-w-xs">
            <span>{t('projects.addDialog.scopeLabel')}</span>
            <select
              {...form.register('scope')}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="local">{t('projects.addDialog.scopeLocal')}</option>
              <option value="global">{t('projects.addDialog.scopeGlobal')}</option>
            </select>
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={add.isPending}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60"
            >
              {t('projects.addDialog.submit')}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted"
            >
              {t('projects.addDialog.cancel')}
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
        <EmptyState title={t('projects.empty')} />
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-4 font-medium">{t('projects.columns.path')}</th>
              <th className="py-2 pr-4 font-medium">{t('projects.columns.scope')}</th>
              <th className="py-2 pr-4 font-medium">{t('projects.columns.agents')}</th>
              <th className="py-2 pr-4 font-medium text-right">{t('projects.columns.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => {
              const editing = editingId === p.id;
              const normalized = normalizeAgentSelection(draft, installed);
              if (editing) {
                return (
                  <tr key={p.id} className="border-b border-border last:border-b-0 align-top">
                    <td className="py-2.5 pr-4">
                      <div className="flex flex-col gap-0.5">
                        {p.displayName ? (
                          <span className="font-medium text-foreground">{p.displayName}</span>
                        ) : null}
                        <span className="font-mono text-xs text-muted-foreground">{p.path}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4" colSpan={3}>
                      <div className="flex flex-col gap-3">
                        <fieldset className="flex flex-col gap-1.5">
                          <legend className="mb-1 text-xs text-muted-foreground">
                            {t('projects.editDialog.scopeLabel')}
                          </legend>
                          <div className="flex gap-2">
                            {(['local', 'global'] as const).map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setDraftScope(s)}
                                className={
                                  draftScope === s
                                    ? 'rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground'
                                    : 'rounded-md border border-border bg-background px-2.5 py-1 text-xs hover:bg-muted'
                                }
                              >
                                {t(`projects.scope.${s}`)}
                              </button>
                            ))}
                          </div>
                        </fieldset>
                        <fieldset className="flex flex-col gap-1.5">
                          <legend className="mb-1 text-xs text-muted-foreground">
                            {t('projects.agentsEdit.label')}
                          </legend>
                          <CheckboxGroup
                            ariaLabel={t('projects.agentsEdit.label')}
                            options={installed.map((name) => ({ value: name, label: name }))}
                            value={draft}
                            onChange={setDraft}
                          />
                          <span className="text-xs text-muted-foreground">
                            {t('projects.agentsEdit.hint')}
                          </span>
                        </fieldset>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void saveEdit(p)}
                            disabled={add.isPending || normalized === null}
                            className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60"
                          >
                            {t('projects.agentsEdit.save')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-md border border-border bg-background px-2.5 py-1 text-xs hover:bg-muted"
                          >
                            {t('projects.agentsEdit.cancel')}
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              }
              return (
                <Fragment key={p.id}>
                <tr
                  className="border-b border-border last:border-b-0 align-top hover:bg-muted/40"
                >
                  <td className="py-2.5 pr-4">
                    <div className="flex flex-col gap-0.5">
                      {p.displayName ? (
                        <span className="font-medium text-foreground">{p.displayName}</span>
                      ) : null}
                      <span className="font-mono text-xs text-muted-foreground">{p.path}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4">
                    <Badge tone={p.scope === 'global' ? 'accent' : 'neutral'}>
                      {t(`projects.scope.${p.scope}`)}
                    </Badge>
                  </td>
                  <td className="py-2.5 pr-4">
                    {p.agents.length ? (
                      <div className="flex flex-wrap gap-1">
                        {p.agents.map((a) => (
                          <Badge key={a} tone="outline" className="font-mono">
                            {a}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">{t('projects.allAgents')}</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4">
                    {removingId === p.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-muted-foreground">
                          {t('projects.remove.confirm')}
                        </span>
                        <button
                          type="button"
                          onClick={() => void confirmRemove(p)}
                          disabled={remove.isPending}
                          className="rounded-md bg-destructive px-2 py-0.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
                        >
                          {t('projects.remove.yes')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemovingId(null)}
                          className="rounded-md border border-border bg-background px-2 py-0.5 text-xs hover:bg-muted"
                        >
                          {t('projects.remove.no')}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setMemoryId(memoryId === p.id ? null : p.id)}
                          className="rounded-md border border-border bg-background px-2 py-0.5 text-xs hover:bg-muted"
                        >
                          {memoryId === p.id ? t('projects.memory.hide') : t('projects.memory.view')}
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(p)}
                          disabled={installed.length === 0}
                          className="rounded-md border border-border bg-background px-2 py-0.5 text-xs hover:bg-muted disabled:opacity-60"
                        >
                          {t('projects.agentsEdit.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setRemovingId(p.id);
                          }}
                          className="rounded-md border border-border bg-background px-2 py-0.5 text-xs text-destructive hover:bg-muted"
                        >
                          {t('projects.remove.button')}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
                {memoryId === p.id ? (
                  <tr key={`${p.id}-memory`} className="border-b border-border bg-muted/20">
                    <td colSpan={4} className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold">{t('projects.memory.title')}</span>
                        <span className="text-xs text-muted-foreground">
                          {t('projects.memory.subtitle')}
                        </span>
                        {memory.isLoading ? (
                          <Loading />
                        ) : memory.error ? (
                          <p className="text-xs text-destructive">
                            {memory.error instanceof Error ? memory.error.message : t('app.error')}
                          </p>
                        ) : (memory.data ?? []).length === 0 ? (
                          <span className="mt-1 text-xs text-muted-foreground">
                            {t('projects.memory.empty')}
                          </span>
                        ) : (
                          <div className="mt-1 flex flex-col gap-3">
                            {(memory.data ?? []).map((file) => (
                              <div
                                key={file.sourcePath}
                                className="rounded-md border border-border bg-background p-3"
                              >
                                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                                  <span className="font-mono text-xs font-medium text-foreground">
                                    {file.name}
                                  </span>
                                  {file.syncedAgents.map((a) => (
                                    <Badge key={a} tone="outline" className="font-mono">
                                      {a}
                                    </Badge>
                                  ))}
                                </div>
                                <pre className="whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">
                                  {file.content.trim() || t('projects.memory.emptyFile')}
                                </pre>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
