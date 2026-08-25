// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from 'zod';

// One entry in the GET /api/native-backups catalog. A "pre-sync" snapshot is the
// first-run capture of every agent's native state; a "pre-restore"
// snapshot is the reversible capture taken automatically before a
// restore overwrites the live native roots.
export const BackupInfoSchema = z.object({
  // Snapshot directory base name (e.g. "pre-sync-2026-05-29T...").
  id: z.string(),
  // Absolute path to the snapshot directory.
  path: z.string().optional().default(''),
  // "pre-sync" or "pre-restore", inferred from the directory prefix.
  kind: z.string(),
  // Manifest createdAt when readable; otherwise the directory mod time.
  createdAt: z.string(),
  // Agent names recorded in the manifest. Absent on a bare directory.
  agents: z.array(z.string()).optional().default([]),
  // Sum of all recorded file sizes in the manifest.
  totalBytes: z.number(),
  // Number of files recorded in the manifest.
  fileCount: z.number(),
  location: z.enum(['local', 'cloud']).optional().default('local'),
  encrypted: z.boolean().optional().default(false),
  algorithm: z.string().optional().default(''),
  encryptedBytes: z.number().optional().default(0),
  cipherSha256: z.string().optional().default(''),
  plainSha256: z.string().optional().default(''),
  originDeviceId: z.string().optional().default(''),
  originDeviceName: z.string().optional().default(''),
  uploadedAt: z.string().optional().default(''),
});
export type BackupInfo = z.infer<typeof BackupInfoSchema>;

export const BackupsListSchema = z.array(BackupInfoSchema);

/** Parse the GET /api/native-backups response. */
export function listBackupsParse(data: unknown): BackupInfo[] {
  return BackupsListSchema.parse(data);
}

export const SafetyStatusSchema = z.object({
  agent: z.string(),
  state: z.string(),
  roots: z.array(z.string()).optional().default([]),
  rootSignature: z.string().optional().default(''),
  backupId: z.string().optional().default(''),
  lastBackupAt: z.string().optional().default(''),
  lastError: z.string().optional().default(''),
  lastFailureAt: z.string().optional().default(''),
  override: z.boolean().optional().default(false),
  overrideAt: z.string().optional().default(''),
  blocked: z.boolean().optional().default(false),
});
export type SafetyStatus = z.infer<typeof SafetyStatusSchema>;

export const BackupJobSchema = z.object({
  id: z.string(),
  kind: z.string(),
  state: z.enum(['running', 'canceling', 'succeeded', 'failed', 'canceled']),
  destination: z.enum(['local', 'cloud']).optional().default('local'),
  agents: z.array(z.string()).optional().default([]),
  createdAt: z.string(),
  startedAt: z.string().optional().default(''),
  completedAt: z.string().optional().default(''),
  backup: BackupInfoSchema.optional(),
  error: z.string().optional().default(''),
});
export type BackupJob = z.infer<typeof BackupJobSchema>;

export const BackupScheduleSchema = z.object({
  enabled: z.boolean().optional().default(false),
  intervalMinutes: z.number().int().positive().optional().default(1440),
  agents: z.array(z.string()).optional().default([]),
  destination: z.enum(['local', 'cloud']).optional().default('local'),
  lastRunAt: z.string().optional().default(''),
  nextRunAt: z.string().optional().default(''),
});
export type BackupSchedule = z.infer<typeof BackupScheduleSchema>;

export const BackupRetentionSchema = z.object({
  perAgent: z.record(z.string(), z.number().int().positive()).optional().default({}),
});
export type BackupRetention = z.infer<typeof BackupRetentionSchema>;

export const BackupCloudStatusSchema = z.object({
  configured: z.boolean().optional().default(false),
  paired: z.boolean().optional().default(false),
  available: z.boolean().optional().default(false),
  deviceId: z.string().optional().default(''),
  accountId: z.string().optional().default(''),
  message: z.string().optional().default(''),
});
export type BackupCloudStatus = z.infer<typeof BackupCloudStatusSchema>;

export const BackupStatusSchema = z.object({
  safety: z.array(SafetyStatusSchema).optional().default([]),
  schedule: BackupScheduleSchema.optional().default({}),
  retention: BackupRetentionSchema.optional().default({}),
  cloud: BackupCloudStatusSchema.optional().default({}),
  jobs: z.array(BackupJobSchema).optional().default([]),
});
export type BackupStatus = z.infer<typeof BackupStatusSchema>;

export function backupStatusParse(data: unknown): BackupStatus {
  return BackupStatusSchema.parse(data);
}

export const CreateBackupRequestSchema = z.object({
  agents: z.array(z.string()).optional(),
  destination: z.enum(['local', 'cloud']).optional(),
});
export type CreateBackupRequest = z.infer<typeof CreateBackupRequestSchema>;

export const CancelBackupJobRequestSchema = z.object({
  jobId: z.string().min(1),
});
export type CancelBackupJobRequest = z.infer<typeof CancelBackupJobRequestSchema>;

// Mirrors nativebackup.FileResult — the per-file outcome of a restore.
export const FileResultSchema = z.object({
  // Native (destination) absolute path written.
  path: z.string(),
  // Size copied, in bytes.
  bytes: z.number(),
  // True when the file was copied and verified successfully.
  ok: z.boolean(),
  // Human-readable error when ok is false; empty otherwise.
  err: z.string().optional().default(''),
});
export type FileResult = z.infer<typeof FileResultSchema>;

// Mirrors nativebackup.RestoreResult — the response to a restore POST.
export const RestoreResultSchema = z.object({
  // Absolute path of the reversible snapshot of the CURRENT native state
  // taken before any files were overwritten, so this restore can itself
  // be undone.
  preRestoreDir: z.string(),
  // Per-file restore outcome, in deterministic path order.
  files: z.array(FileResultSchema),
});
export type RestoreResult = z.infer<typeof RestoreResultSchema>;

/** Parse the POST /api/native-backups/restore response. */
export function restoreResultParse(data: unknown): RestoreResult {
  return RestoreResultSchema.parse(data);
}

// POST /api/native-backups/restore request body. An empty/omitted agent
// restores every agent recorded in the snapshot's manifest.
export const RestoreRequestSchema = z.object({
  backupId: z.string().min(1),
  agent: z.string().optional(),
  location: z.enum(['local', 'cloud']).optional(),
});
export type RestoreRequest = z.infer<typeof RestoreRequestSchema>;

// DELETE /api/native-backups request body. Location disambiguates a local
// snapshot from a client-encrypted cloud backup with the same ID.
export const DeleteBackupRequestSchema = z.object({
  backupId: z.string().min(1),
  location: z.enum(['local', 'cloud']).optional(),
});
export type DeleteBackupRequest = z.infer<typeof DeleteBackupRequestSchema>;
