// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from 'zod';

// One candidate head in a daemon-reported conflict.
export const HeadSchema = z.object({
  sourceAgent: z.string(),
  eventId: z.string(),
  contentSha256: z.string(),
  absTimestamp: z.number(),
  payloadPreview: z.string().optional(),
});
export type Head = z.infer<typeof HeadSchema>;

export const ConflictHeadAnalysisSchema = z.object({
  label: z.string(),
  sourceAgent: z.string(),
  summary: z.string(),
  primaryText: z.string().optional(),
  payloadJson: z.string().optional(),
});
export type ConflictHeadAnalysis = z.infer<typeof ConflictHeadAnalysisSchema>;

export const ConflictDifferenceSchema = z.object({
  label: z.string(),
  status: z.string(),
  headA: z.string().optional(),
  headB: z.string().optional(),
});
export type ConflictDifference = z.infer<typeof ConflictDifferenceSchema>;

export const ConflictAnalysisSchema = z.object({
  summary: z.string(),
  recommendation: z.string(),
  autoResolvable: z.boolean().optional(),
  preferredHead: z.string().optional(),
  heads: z.array(ConflictHeadAnalysisSchema).optional(),
  differences: z.array(ConflictDifferenceSchema).optional(),
});
export type ConflictAnalysis = z.infer<typeof ConflictAnalysisSchema>;

// Mirrors Conflict. `kind` is acf.Kind on the daemon (memory/skill/...).
export const ConflictSchema = z.object({
  artifactId: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  kind: z.string(),
  heads: z.array(HeadSchema),
  analysis: ConflictAnalysisSchema.optional(),
});
export type Conflict = z.infer<typeof ConflictSchema>;

export const ConflictsListSchema = z.array(ConflictSchema);

// Resolution action set (mirrors api.ResolveAccept{A,B}/Manual).
export const ResolveActionSchema = z.enum(['accept-a', 'accept-b', 'manual']);
export type ResolveAction = z.infer<typeof ResolveActionSchema>;

export const ResolveRequestSchema = z
  .object({
    action: ResolveActionSchema,
    manualBody: z.string().optional(),
  })
  .refine((v) => v.action !== 'manual' || (v.manualBody && v.manualBody.length > 0), {
    message: 'manualBody is required when action=manual',
    path: ['manualBody'],
  });
export type ResolveRequest = z.infer<typeof ResolveRequestSchema>;
