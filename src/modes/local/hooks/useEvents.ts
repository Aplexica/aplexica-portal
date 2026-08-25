// SPDX-License-Identifier: AGPL-3.0-or-later
import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import { backfillEvents } from '../lib/api/events';
import type { EventPage } from '@shared/schemas';

const PAGE_SIZE = 100;

export function useEventsBackfill() {
  return useInfiniteQuery<
    EventPage,
    Error,
    InfiniteData<EventPage, number | undefined>,
    readonly unknown[],
    number | undefined
  >({
    queryKey: ['events', 'backfill'],
    // The feed is newest-first: the first page omits the cursor (most recent
    // events), then we page BACKWARD into history via nextBefore.
    initialPageParam: undefined,
    queryFn: ({ pageParam }) => backfillEvents({ before: pageParam, limit: PAGE_SIZE }),
    // The daemon returns nextBefore as the backward cursor; when the page is
    // shorter than PAGE_SIZE we've reached the tail (oldest history).
    getNextPageParam: (last) => {
      if (!last.events || last.events.length < PAGE_SIZE) return undefined;
      return last.nextBefore;
    },
  });
}
