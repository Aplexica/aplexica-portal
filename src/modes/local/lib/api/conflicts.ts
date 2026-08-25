// SPDX-License-Identifier: AGPL-3.0-or-later
import { api } from './client';
import {
  ConflictSchema,
  ConflictsListSchema,
  type Conflict,
  type ResolveRequest,
} from '@shared/schemas';

export async function listConflicts(): Promise<Conflict[]> {
  return ConflictsListSchema.parse(await api.get<unknown>('/api/conflicts'));
}

export async function getConflict(id: string): Promise<Conflict> {
  return ConflictSchema.parse(await api.get<unknown>(`/api/conflicts/${encodeURIComponent(id)}`));
}

export interface ResolveResponse {
  resolved: string;
  action: string;
}

export async function resolveConflict(id: string, body: ResolveRequest): Promise<ResolveResponse> {
  return api.post<ResolveResponse>(`/api/conflicts/${encodeURIComponent(id)}/resolve`, body);
}
