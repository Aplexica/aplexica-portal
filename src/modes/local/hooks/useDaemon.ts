// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getDaemon, pauseDaemon, resumeDaemon } from '../lib/api/daemon';
import { qk } from './query-keys';

export function useDaemon() {
  return useQuery({
    queryKey: qk.daemon.status(),
    queryFn: () => getDaemon(),
    // Daemon status changes via Pause/Resume mutations + SSE; a slow
    // background poll keeps uptime current even when the user idles
    // on the dashboard.
    refetchInterval: 15_000,
  });
}

export function usePauseDaemon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => pauseDaemon(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.daemon.status() });
    },
  });
}

export function useResumeDaemon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => resumeDaemon(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.daemon.status() });
    },
  });
}
