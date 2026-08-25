// SPDX-License-Identifier: AGPL-3.0-or-later
import { api } from './client';
import {
  TransportInfoSchema,
  type TransportInfo,
  type BYORelayOpts,
  type TransportSetRequest,
} from '@shared/schemas';

export async function getTransport(): Promise<TransportInfo> {
  return TransportInfoSchema.parse(await api.get<unknown>('/api/transport'));
}

export async function setTransport(body: TransportSetRequest): Promise<TransportInfo> {
  return TransportInfoSchema.parse(await api.put<unknown>('/api/transport', body));
}

export async function setBYORelay(body: BYORelayOpts): Promise<void> {
  await api.post('/api/transport/byo', body);
}
