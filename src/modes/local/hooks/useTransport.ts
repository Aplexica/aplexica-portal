// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getTransport, setBYORelay, setTransport } from '../lib/api/transport';
import type { BYORelayOpts, TransportSetRequest } from '@shared/schemas';
import { qk } from './query-keys';

export function useTransport() {
  return useQuery({
    queryKey: qk.transport.current(),
    queryFn: () => getTransport(),
  });
}

export function useSetTransport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TransportSetRequest) => setTransport(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.transport.current() });
    },
  });
}

export function useSetBYORelay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BYORelayOpts) => setBYORelay(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.transport.current() });
    },
  });
}
