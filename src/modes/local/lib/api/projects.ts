// SPDX-License-Identifier: AGPL-3.0-or-later
import { api } from './client';
import {
  ProjectListSchema,
  ProjectEntrySchema,
  ProjectMemoryListSchema,
  type ProjectEntry,
  type ProjectMemoryFile,
  type AddProjectRequest,
} from '@shared/schemas';

export async function listProjects(): Promise<ProjectEntry[]> {
  return ProjectListSchema.parse(await api.get<unknown>('/api/projects'));
}

export async function addProject(body: AddProjectRequest): Promise<ProjectEntry> {
  return ProjectEntrySchema.parse(await api.post<unknown>('/api/projects', body));
}

/**
 * Unregister a project. The daemon stops watching the folder, which lets the
 * next discovery pass re-surface it in the pending list.
 */
export async function removeProject(id: string): Promise<void> {
  await api.delete<unknown>(`/api/projects/${encodeURIComponent(id)}`);
}

/** Effective composed memory each agent holds for a project (parity view). */
export async function getProjectMemory(id: string): Promise<ProjectMemoryFile[]> {
  return ProjectMemoryListSchema.parse(
    await api.get<unknown>(`/api/projects/${encodeURIComponent(id)}/memory`),
  );
}
