// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getConfig, patchConfig, rawConfigPath } from '../lib/api/config';
import type { ConfigPatch } from '@shared/schemas';
import { qk } from './query-keys';

export function useConfig() {
  return useQuery({
    queryKey: qk.config.current(),
    queryFn: () => getConfig(),
  });
}

export function useRawConfigPath() {
  return useQuery({
    queryKey: qk.config.rawPath(),
    queryFn: () => rawConfigPath(),
    staleTime: Infinity, // path is daemon-lifetime stable
  });
}

export function usePatchConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ConfigPatch) => patchConfig(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.config.current() });
    },
  });
}
