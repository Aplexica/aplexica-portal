// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelNativeBackupJob,
  createNativeBackup,
  deleteNativeBackup,
  getNativeBackupStatus,
  overrideNativeBackupBlocker,
  listNativeBackups,
  restoreNativeBackup,
  saveNativeBackupRetention,
  saveNativeBackupSchedule,
} from '../lib/api/native-backups';
import type { BackupRetention, BackupSchedule, CreateBackupRequest, DeleteBackupRequest, RestoreRequest } from '@shared/schemas';
import { qk } from './query-keys';

export function useNativeBackups() {
  return useQuery({
    queryKey: qk.nativeBackups.list(),
    queryFn: () => listNativeBackups(),
  });
}

export function useNativeBackupStatus() {
  return useQuery({
    queryKey: qk.nativeBackups.status(),
    queryFn: () => getNativeBackupStatus(),
    refetchInterval: (query) =>
      query.state.data?.jobs.some((job) => job.state === 'running' || job.state === 'canceling')
        ? 2000
        : false,
  });
}

function invalidateNativeBackups(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: qk.nativeBackups.list() });
  void qc.invalidateQueries({ queryKey: qk.nativeBackups.status() });
}

export function useCreateNativeBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateBackupRequest) => createNativeBackup(body),
    onSuccess: () => invalidateNativeBackups(qc),
  });
}

export function useCancelNativeBackupJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => cancelNativeBackupJob(jobId),
    onSuccess: () => invalidateNativeBackups(qc),
  });
}

export function useOverrideNativeBackupBlocker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (agent: string) => overrideNativeBackupBlocker(agent),
    onSuccess: () => invalidateNativeBackups(qc),
  });
}

export function useSaveNativeBackupSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BackupSchedule) => saveNativeBackupSchedule(body),
    onSuccess: () => invalidateNativeBackups(qc),
  });
}

export function useSaveNativeBackupRetention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BackupRetention) => saveNativeBackupRetention(body),
    onSuccess: () => invalidateNativeBackups(qc),
  });
}

export function useRestoreNativeBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RestoreRequest) => restoreNativeBackup(body),
    onSuccess: () => {
      // A restore writes a new reversible pre-restore snapshot, so the
      // catalog must be refetched.
      invalidateNativeBackups(qc);
    },
  });
}

export function useDeleteNativeBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: DeleteBackupRequest) => deleteNativeBackup(body),
    onSuccess: () => invalidateNativeBackups(qc),
  });
}
