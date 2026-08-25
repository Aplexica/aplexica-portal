// SPDX-License-Identifier: AGPL-3.0-or-later
import { api } from './client';
import {
  ConversationBranchMutationResponseSchema,
  ConversationBranchesResponseSchema,
  type ConversationBranchMutationResponse,
  type ConversationBranchesResponse,
  type ConversationCheckoutRequest,
  type ConversationForkRequest,
} from '@shared/schemas';

export async function listConversationBranches(id: string): Promise<ConversationBranchesResponse> {
  return ConversationBranchesResponseSchema.parse(
    await api.get<unknown>(`/api/conversations/${encodeURIComponent(id)}/branches`),
  );
}

export async function forkConversation(
  id: string,
  body: ConversationForkRequest,
): Promise<ConversationBranchMutationResponse> {
  return ConversationBranchMutationResponseSchema.parse(
    await api.post<unknown>(`/api/conversations/${encodeURIComponent(id)}/fork`, body),
  );
}

export async function checkoutConversation(
  id: string,
  body: ConversationCheckoutRequest,
): Promise<ConversationBranchMutationResponse> {
  return ConversationBranchMutationResponseSchema.parse(
    await api.post<unknown>(`/api/conversations/${encodeURIComponent(id)}/checkout`, body),
  );
}
