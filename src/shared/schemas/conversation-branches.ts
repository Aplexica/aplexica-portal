// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from 'zod';

export const ConversationBranchSchema = z.object({
  name: z.string(),
  createdAt: z.string().optional(),
  lastEventAt: z.string().optional(),
  head: z.string().optional(),
  forkedFrom: z.string().optional(),
  forkedFromHash: z.string().optional(),
  originAgent: z.string().optional(),
  rationale: z.string().optional(),
  archived: z.boolean().optional(),
  mergedInto: z.string().optional(),
  eventCount: z.number().int().nonnegative(),
  materializedAgents: z.preprocess((value) => value ?? [], z.array(z.string())),
});
export type ConversationBranch = z.infer<typeof ConversationBranchSchema>;

export const ConversationBranchesResponseSchema = z.object({
  artifactId: z.string(),
  branches: z.array(ConversationBranchSchema),
});
export type ConversationBranchesResponse = z.infer<typeof ConversationBranchesResponseSchema>;

export const ConversationForkRequestSchema = z.object({
  fromEventId: z.string().min(1),
  targetAgent: z.string().min(1),
  branch: z.string().optional(),
  rationale: z.string().optional(),
});
export type ConversationForkRequest = z.infer<typeof ConversationForkRequestSchema>;

export const ConversationCheckoutRequestSchema = z.object({
  agent: z.string().min(1),
  branch: z.string().min(1),
});
export type ConversationCheckoutRequest = z.infer<typeof ConversationCheckoutRequestSchema>;

export const ConversationBranchMutationResponseSchema = z.object({
  artifactId: z.string(),
  branch: z.string(),
  agent: z.string(),
  path: z.string().optional(),
  materialized: z.boolean(),
  warning: z.string().optional(),
  operation: z.string(),
  createdBranch: z.boolean().optional(),
});
export type ConversationBranchMutationResponse = z.infer<typeof ConversationBranchMutationResponseSchema>;
