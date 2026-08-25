// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSyncState, setAgentSync, setSyncAll } from '../lib/api/sync';
import { qk } from './query-keys';

export function useSyncState() {
  return useQuery({
    queryKey: qk.sync.state(),
    queryFn: () => getSyncState(),
  });
}

// Invalidate both the gate state AND the agents list (each agent carries a
// derived syncEnabled flag that changes when the gate changes).
function useGateMutation<TArgs>(fn: (a: TArgs) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.sync.state() });
      void qc.invalidateQueries({ queryKey: qk.agents.list() });
    },
  });
}

export function useSetSyncAll() {
  return useGateMutation((enabled: boolean) => setSyncAll(enabled));
}

export function useSetAgentSync() {
  return useGateMutation((args: { name: string; enabled: boolean }) =>
    setAgentSync(args.name, args.enabled),
  );
}
