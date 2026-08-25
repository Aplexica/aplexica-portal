// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approvePending,
  denyPending,
  dismissSuggestion,
  linkPending,
  listPending,
  restorePending,
} from '../lib/api/pending';
import type { ApproveRequest, LinkRequest } from '@shared/schemas';
import { qk } from './query-keys';

/**
 * How often the pending list is re-polled. Drives both the page (auto-updates
 * while open) and the sidebar nav badge (lights up when a new folder is
 * discovered) without a manual refresh.
 */
export const PENDING_POLL_MS = 15_000;

export function usePending() {
  return useQuery({
    queryKey: qk.pending.list(),
    queryFn: () => listPending(),
    refetchInterval: PENDING_POLL_MS,
  });
}

/**
 * The pending-projects count, polled on the same interval and sharing the same
 * query cache entry as {@link usePending} (so it adds no extra requests). The
 * `select` narrows the cached list to its length, so consumers (the sidebar
 * badge) only re-render when the count actually changes.
 */
export function usePendingCount(): number {
  const { data } = useQuery({
    queryKey: qk.pending.list(),
    queryFn: () => listPending(),
    refetchInterval: PENDING_POLL_MS,
    // Denied folders are not actionable pending work — exclude them from the
    // badge count so dismissing a folder clears the nav indicator.
    select: (list) => list.filter((p) => !p.denied).length,
  });
  return data ?? 0;
}

export function useLinkPending() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: LinkRequest }) => linkPending(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.pending.list() });
    },
  });
}

/**
 * Approve (register) a discovered pending folder. Refreshes both the pending
 * list (the row leaves it) and the projects list (it appears there).
 */
export function useApprovePending() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ApproveRequest }) => approvePending(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.pending.list() });
      void qc.invalidateQueries({ queryKey: qk.projects.list() });
    },
  });
}

/** Dismiss a discovered folder to the denied list. */
export function useDenyPending() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, path }: { id: string; path?: string }) => denyPending(id, path),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.pending.list() });
    },
  });
}

/** Restore a denied folder back to the active pending list. */
export function useRestorePending() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restorePending(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.pending.list() });
    },
  });
}

/** Dismiss an "add agent to project" suggestion so it stops appearing. */
export function useDismissSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, agent }: { projectId: string; agent: string }) =>
      dismissSuggestion(projectId, agent),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.pending.list() });
    },
  });
}
