// SPDX-License-Identifier: AGPL-3.0-or-later
import { api } from './client';
import { DaemonStatusSchema, PauseResponseSchema, type DaemonStatus, type PauseResponse } from '@shared/schemas';

export async function getDaemon(): Promise<DaemonStatus> {
  return DaemonStatusSchema.parse(await api.get<unknown>('/api/daemon'));
}

export async function pauseDaemon(): Promise<PauseResponse> {
  return PauseResponseSchema.parse(await api.post<unknown>('/api/daemon/pause'));
}

export async function resumeDaemon(): Promise<PauseResponse> {
  return PauseResponseSchema.parse(await api.post<unknown>('/api/daemon/resume'));
}
