// SPDX-License-Identifier: AGPL-3.0-or-later
import { api } from './client';
import { AgentsListSchema, AgentDetailSchema, type AgentSummary, type AgentDetail } from '@shared/schemas';

export async function listAgents(): Promise<AgentSummary[]> {
  return AgentsListSchema.parse(await api.get<unknown>('/api/agents'));
}

export async function getAgent(name: string): Promise<AgentDetail> {
  return AgentDetailSchema.parse(await api.get<unknown>(`/api/agents/${encodeURIComponent(name)}`));
}
