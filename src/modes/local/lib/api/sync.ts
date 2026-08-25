// SPDX-License-Identifier: AGPL-3.0-or-later
import { api } from './client';
import { SyncStateSchema, type SyncState } from '@shared/schemas';

// The await-config fan-out gate. Discovery and import happen
// regardless; these control whether artifacts fan OUT to a target agent.

export async function getSyncState(): Promise<SyncState> {
  return SyncStateSchema.parse(await api.get<unknown>('/api/sync'));
}

export async function setSyncAll(enabled: boolean): Promise<SyncState> {
  return SyncStateSchema.parse(await api.post<unknown>('/api/sync/all', { enabled }));
}

export async function setAgentSync(name: string, enabled: boolean): Promise<SyncState> {
  return SyncStateSchema.parse(
    await api.post<unknown>(`/api/sync/agents/${encodeURIComponent(name)}`, { enabled }),
  );
}
