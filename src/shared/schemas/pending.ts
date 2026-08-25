// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from 'zod';

// Project scope: folder-local (rules apply only to that folder) vs global.
export const ProjectScopeSchema = z.enum(['local', 'global']);
export type ProjectScope = z.infer<typeof ProjectScopeSchema>;

// Discovery adds the `source`, `agents`, `lastActive`, and `isGitRepo`
// fields; older daemons
// omit them, so everything past `samplePath` is optional for back-compat.
export const PendingProjectSchema = z.object({
  id: z.string(),
  artifactCount: z.number().int(),
  samplePath: z.string().optional(),
  // "artifact" = surfaced from imported artifacts whose project isn't linked;
  // "discovered" = a folder the daemon found agents working in;
  // "agent-suggestion" = a registered project an agent newly started using.
  source: z.enum(['artifact', 'discovered', 'agent-suggestion']).optional(),
  // Agents that have used this folder (for discovered folders).
  agents: z.array(z.string()).optional(),
  // Unix seconds of the most recent activity in this folder.
  lastActive: z.number().optional(),
  // Whether the sample path is a git repository.
  isGitRepo: z.boolean().optional(),
  // Whether the user dismissed this discovered folder. Denied rows are kept out
  // of the active pending list/count and rendered in a separate denied section.
  denied: z.boolean().optional(),
  // For source="agent-suggestion": agents discovery found active in this
  // already-registered project that aren't in its set yet (offer to add).
  suggestAgents: z.array(z.string()).optional(),
});
export type PendingProject = z.infer<typeof PendingProjectSchema>;

export const PendingListSchema = z.array(PendingProjectSchema);

// Legacy link flow: bind a pending (artifact-sourced) project to a path.
export const LinkRequestSchema = z.object({
  localPath: z.string().min(1, 'Local path is required'),
});
export type LinkRequest = z.infer<typeof LinkRequestSchema>;

// POST /api/pending/{id}/approve — approve/register a discovered folder.
export const ApproveRequestSchema = z.object({
  scope: ProjectScopeSchema,
  path: z.string().min(1, 'Path is required'),
  agents: z.array(z.string()).optional(),
});
export type ApproveRequest = z.infer<typeof ApproveRequestSchema>;
