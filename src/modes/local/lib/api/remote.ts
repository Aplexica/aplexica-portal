// SPDX-License-Identifier: AGPL-3.0-or-later
import { api } from './client';
import {
  RemotePairResultSchema,
  RemoteStatusSchema,
  RemoteVerifyResultSchema,
  type RemotePairRequest,
  type RemotePairResult,
  type RemoteStatus,
  type RemoteVerifyResult,
} from '@shared/schemas';

export async function pair(body: RemotePairRequest): Promise<RemotePairResult> {
  return RemotePairResultSchema.parse(await api.post<unknown>('/api/remote/pair', body));
}

export async function remoteStatus(): Promise<RemoteStatus> {
  return RemoteStatusSchema.parse(await api.get<unknown>('/api/remote/status'));
}

export async function verifyRemote(): Promise<RemoteVerifyResult> {
  return RemoteVerifyResultSchema.parse(await api.post<unknown>('/api/remote/verify'));
}

/** Disconnect this device and clear local pairing credentials and cached rules. */
export async function unpairRemote(): Promise<void> {
  await api.post<unknown>('/api/remote/unpair');
}
