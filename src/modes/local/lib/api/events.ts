// SPDX-License-Identifier: AGPL-3.0-or-later
import { api } from './client';
import { EventPageSchema, type EventPage } from '@shared/schemas';

export interface BackfillParams {
  // before is the exclusive upper-bound cursor (newest-first feed): omit it
  // for the most recent page, then pass the response's nextBefore to page
  // backward into older history.
  before?: number;
  limit?: number;
}

export async function backfillEvents(params: BackfillParams = {}): Promise<EventPage> {
  const qs = new URLSearchParams();
  if (params.before !== undefined) qs.set('before', String(params.before));
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return EventPageSchema.parse(await api.get<unknown>(`/api/events${suffix}`));
}
