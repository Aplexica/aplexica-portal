// SPDX-License-Identifier: AGPL-3.0-or-later
import { api } from './client';
import {
  backupStatusParse,
  BackupInfoSchema,
  BackupJobSchema,
  listBackupsParse,
  restoreResultParse,
  BackupRetentionSchema,
  BackupScheduleSchema,
  type BackupInfo,
  type BackupJob,
  type BackupRetention,
  type BackupSchedule,
  type BackupStatus,
  type CreateBackupRequest,
  type DeleteBackupRequest,
  type SafetyStatus,
  type RestoreRequest,
  type RestoreResult,
} from '@shared/schemas';

export async function listNativeBackups(): Promise<BackupInfo[]> {
  return listBackupsParse(await api.get<unknown>('/api/native-backups'));
}

export async function getNativeBackupStatus(): Promise<BackupStatus> {
  return backupStatusParse(await api.get<unknown>('/api/native-backups/status'));
}

export async function createNativeBackup(
  body: CreateBackupRequest,
): Promise<BackupJob> {
  return BackupJobSchema.parse(await api.post<unknown>('/api/native-backups', body));
}

export async function cancelNativeBackupJob(jobId: string): Promise<BackupJob> {
  return BackupJobSchema.parse(await api.post<unknown>('/api/native-backups/jobs/cancel', { jobId }));
}

export async function overrideNativeBackupBlocker(agent: string): Promise<SafetyStatus> {
  return backupStatusParse({
    safety: [await api.post<unknown>('/api/native-backups/override', { agent })],
    schedule: {},
  }).safety[0];
}

export async function saveNativeBackupSchedule(body: BackupSchedule): Promise<BackupSchedule> {
  const payload = {
    enabled: body.enabled,
    intervalMinutes: body.intervalMinutes,
    agents: body.agents,
    destination: body.destination,
  };
  return BackupScheduleSchema.parse(await api.put<unknown>('/api/native-backups/schedule', payload));
}

export async function saveNativeBackupRetention(body: BackupRetention): Promise<BackupRetention> {
  return BackupRetentionSchema.parse(await api.put<unknown>('/api/native-backups/retention', body));
}

export async function restoreNativeBackup(body: RestoreRequest): Promise<RestoreResult> {
  return restoreResultParse(await api.post<unknown>('/api/native-backups/restore', body));
}

export async function deleteNativeBackup(body: DeleteBackupRequest): Promise<BackupInfo> {
  return BackupInfoSchema.parse(await api.delete<unknown>('/api/native-backups', { body }));
}
