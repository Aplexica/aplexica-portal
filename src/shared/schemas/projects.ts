// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from 'zod';
import { ProjectScopeSchema } from './pending';

// Project entry returned by GET /api/projects and POST /api/projects.
export const ProjectEntrySchema = z.object({
  id: z.string(),
  path: z.string(),
  scope: ProjectScopeSchema,
  // Agents this project is scoped to; empty/absent means all installed agents.
  agents: z.array(z.string()).default([]),
  // Friendly name for display (usually the folder basename).
  displayName: z.string().optional(),
  // Version-control system detected at the path, e.g. "git" or "" when none.
  vcs: z.string().optional(),
});
export type ProjectEntry = z.infer<typeof ProjectEntrySchema>;

export const ProjectListSchema = z.array(ProjectEntrySchema);

// One agent's effective (fully composed) memory for a project.
export const ProjectMemoryFileSchema = z.object({
  name: z.string(),
  sourcePath: z.string(),
  content: z.string(),
  syncedAgents: z.array(z.string()).default([]),
});
export type ProjectMemoryFile = z.infer<typeof ProjectMemoryFileSchema>;

export const ProjectMemoryListSchema = z.array(ProjectMemoryFileSchema);

// POST /api/projects body — register a folder manually.
export const AddProjectRequestSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  scope: ProjectScopeSchema,
  agents: z.array(z.string()).optional(),
});
export type AddProjectRequest = z.infer<typeof AddProjectRequestSchema>;
