// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addProject, getProjectMemory, listProjects, removeProject } from '../lib/api/projects';
import type { AddProjectRequest } from '@shared/schemas';
import { qk } from './query-keys';

export function useProjects() {
  return useQuery({
    queryKey: qk.projects.list(),
    queryFn: () => listProjects(),
  });
}

/** Effective per-agent memory for a project; only fetches when id is set. */
export function useProjectMemory(id: string | null) {
  return useQuery({
    queryKey: qk.projects.memory(id ?? ''),
    queryFn: () => getProjectMemory(id as string),
    enabled: Boolean(id),
  });
}

export function useAddProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AddProjectRequest) => addProject(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.projects.list() });
      // A manual add can also clear a matching pending row.
      void qc.invalidateQueries({ queryKey: qk.pending.list() });
    },
  });
}

/**
 * Unregister a project. It leaves the projects list and the daemon stops
 * watching it, so it re-surfaces in Pending; agent watched-locations change too.
 */
export function useRemoveProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removeProject(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.projects.list() });
      void qc.invalidateQueries({ queryKey: qk.pending.list() });
      // Prefix-invalidate so both the agents list and any open agent-detail
      // (whose Watched Locations include this folder) refetch.
      void qc.invalidateQueries({ queryKey: ['agents'] });
    },
  });
}
