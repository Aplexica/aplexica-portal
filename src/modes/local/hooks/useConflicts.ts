// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getConflict, listConflicts, resolveConflict } from '../lib/api/conflicts';
import type { ResolveRequest } from '@shared/schemas';
import { qk } from './query-keys';

export const CONFLICTS_POLL_MS = 15_000;

export function useConflicts() {
  return useQuery({
    queryKey: qk.conflicts.list(),
    queryFn: () => listConflicts(),
    refetchInterval: CONFLICTS_POLL_MS,
  });
}

// usePendingCount's sibling: the unresolved-conflict count for the sidebar
// nav badge. Shares the conflicts list queryKey, so it reuses the same cache
// and poll as useConflicts — no extra requests. Every listed conflict is
// actionable (divergent heads awaiting resolution), so the count is the full
// list length.
export function useConflictsCount(): number {
  const { data } = useQuery({
    queryKey: qk.conflicts.list(),
    queryFn: () => listConflicts(),
    refetchInterval: CONFLICTS_POLL_MS,
    select: (list) => list.length,
  });
  return data ?? 0;
}

export function useConflict(id: string | undefined) {
  return useQuery({
    queryKey: qk.conflicts.detail(id ?? ''),
    queryFn: () => getConflict(id as string),
    enabled: Boolean(id),
  });
}

export function useResolveConflict(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ResolveRequest) => resolveConflict(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.conflicts.list() });
      void qc.invalidateQueries({ queryKey: qk.conflicts.detail(id) });
    },
  });
}
