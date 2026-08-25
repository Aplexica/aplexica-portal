// SPDX-License-Identifier: AGPL-3.0-or-later
import { api } from './client';
import {
  ConversationSearchResponseSchema,
  type ConversationSearchResponse,
} from '@shared/schemas';

export async function listConversations(query: string, limit = 25): Promise<ConversationSearchResponse> {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  const trimmed = query.trim();
  if (trimmed) params.set('q', trimmed);
  const parsed = ConversationSearchResponseSchema.parse(
    await api.get<unknown>(`/api/conversations?${params.toString()}`),
  );
  return {
    ...parsed,
    conversations: dedupeConversations(parsed.conversations),
  };
}

function dedupeConversations(
  conversations: ConversationSearchResponse['conversations'],
): ConversationSearchResponse['conversations'] {
  const seen = new Set<string>();
  return conversations.filter((conversation) => {
    const key = (conversation.sourcePath?.trim() || conversation.artifactId).trim();
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
