// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@tanstack/react-query';
import { getAgent, listAgents } from '../lib/api/agents';
import { qk } from './query-keys';

export function useAgents() {
  return useQuery({
    queryKey: qk.agents.list(),
    queryFn: () => listAgents(),
  });
}

export function useAgent(name: string | undefined) {
  return useQuery({
    queryKey: qk.agents.detail(name ?? ''),
    queryFn: () => getAgent(name as string),
    enabled: Boolean(name),
  });
}
