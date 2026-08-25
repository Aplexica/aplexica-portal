// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bootstrap, logout, session } from '../lib/api/auth';
import { qk } from './query-keys';

export function useSession() {
  return useQuery({
    queryKey: qk.auth.session(),
    queryFn: () => session(),
    retry: false,
  });
}

export function useBootstrapMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => bootstrap(token),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.auth.session() });
    },
  });
}

export function useLogoutMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => logout(),
    onSuccess: () => {
      qc.clear();
    },
  });
}
