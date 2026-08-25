// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@tanstack/react-query';
import { listConversations } from '../lib/api/conversations';
import { qk } from './query-keys';

export function useConversations(query: string, limit = 25) {
  const normalized = query.trim();
  return useQuery({
    queryKey: qk.conversations.search(normalized, limit),
    queryFn: () => listConversations(normalized, limit),
  });
}
