// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from 'zod';

export const ConversationSummarySchema = z.object({
  artifactId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  sourceAgent: z.string().optional(),
  sourcePath: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  turnCount: z.number().int().nonnegative(),
  branchCount: z.number().int().nonnegative(),
  materializedIn: z.array(z.string()).default([]),
});
export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;

export const ConversationSearchResponseSchema = z.object({
  query: z.string().optional(),
  conversations: z.array(ConversationSummarySchema),
});
export type ConversationSearchResponse = z.infer<typeof ConversationSearchResponseSchema>;
