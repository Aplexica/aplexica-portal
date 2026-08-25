// SPDX-License-Identifier: AGPL-3.0-or-later
import { api } from './client';
import {
  PendingListSchema,
  ProjectEntrySchema,
  type PendingProject,
  type LinkRequest,
  type ApproveRequest,
  type ProjectEntry,
} from '@shared/schemas';

export async function listPending(): Promise<PendingProject[]> {
  return PendingListSchema.parse(await api.get<unknown>('/api/pending'));
}

export interface LinkResponse {
  linked: string;
  localPath: string;
}

export async function linkPending(id: string, body: LinkRequest): Promise<LinkResponse> {
  return api.post<LinkResponse>(`/api/pending/${encodeURIComponent(id)}/link`, body);
}

/**
 * Approve (register) a discovered pending folder with a chosen scope.
 * Returns the registered project entry.
 */
export async function approvePending(id: string, body: ApproveRequest): Promise<ProjectEntry> {
  return ProjectEntrySchema.parse(
    await api.post<unknown>(`/api/pending/${encodeURIComponent(id)}/approve`, body),
  );
}

/** Dismiss a discovered folder to the denied list (until re-approved/restored). */
export async function denyPending(id: string, path?: string): Promise<void> {
  await api.post<unknown>(`/api/pending/${encodeURIComponent(id)}/deny`, { path: path ?? '' });
}

/** Un-deny a folder so it returns to the active pending list (no registration). */
export async function restorePending(id: string): Promise<void> {
  await api.post<unknown>(`/api/pending/${encodeURIComponent(id)}/restore`, {});
}

/** Dismiss the "add <agent> to this project" suggestion so it stops appearing. */
export async function dismissSuggestion(projectId: string, agent: string): Promise<void> {
  await api.post<unknown>(`/api/projects/${encodeURIComponent(projectId)}/dismiss-suggestion`, {
    agent,
  });
}
