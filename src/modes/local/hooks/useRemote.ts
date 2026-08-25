// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pair, remoteStatus, unpairRemote, verifyRemote } from '../lib/api/remote';
import type { RemotePairRequest } from '@shared/schemas';
import { qk } from './query-keys';

export function useRemoteStatus() {
  return useQuery({
    queryKey: qk.remote.status(),
    queryFn: () => remoteStatus(),
    // Connection state (conn_state / restart_count) drifts as the plugin
    // dials the broker; a short poll keeps the success card live without
    // a manual refresh.
    refetchInterval: 3000,
  });
}

export function usePairRemote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RemotePairRequest) => pair(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.remote.status() });
    },
  });
}

export function useVerifyRemote() {
  return useMutation({
    mutationFn: () => verifyRemote(),
  });
}

export function useUnpairRemote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unpairRemote(),
    onSuccess: () => {
      // Status flips to paired:false -> the page swaps back to the wizard.
      void qc.invalidateQueries({ queryKey: qk.remote.status() });
    },
  });
}
