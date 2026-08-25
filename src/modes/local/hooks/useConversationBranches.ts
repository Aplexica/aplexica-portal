// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ConversationCheckoutRequest, ConversationForkRequest } from '@shared/schemas';
import {
  checkoutConversation,
  forkConversation,
  listConversationBranches,
} from '../lib/api/conversation-branches';
import { qk } from './query-keys';

export function useConversationBranches(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.conversationBranches.detail(id ?? ''),
    queryFn: () => listConversationBranches(id as string),
    enabled: enabled && Boolean(id),
  });
}

export function useForkConversation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ConversationForkRequest) => forkConversation(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.conversationBranches.detail(id) });
      void qc.invalidateQueries({ queryKey: qk.conflicts.detail(id) });
      void qc.invalidateQueries({ queryKey: qk.conflicts.list() });
    },
  });
}

export function useCheckoutConversation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ConversationCheckoutRequest) => checkoutConversation(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.conversationBranches.detail(id) });
    },
  });
}
