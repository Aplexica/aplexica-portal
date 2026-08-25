// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import {
  backupStatusParse,
  listBackupsParse,
  restoreResultParse,
  CreateBackupRequestSchema,
  DeleteBackupRequestSchema,
  RestoreRequestSchema,
} from './native-backups';

describe('native-backups schemas', () => {
  it('parses the GET /api/native-backups catalog', () => {
    const out = listBackupsParse([
      {
        id: 'pre-sync-2026-05-29T12:00:00Z',
        path: '/home/dev/.aplexica/backups/pre-sync-2026-05-29T12:00:00Z',
        kind: 'pre-sync',
        createdAt: '2026-05-29T12:00:00Z',
        agents: ['claude-code', 'codex'],
        totalBytes: 1024,
        fileCount: 7,
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('pre-sync');
    expect(out[0].agents).toEqual(['claude-code', 'codex']);
  });

  it('defaults a missing agents array to empty', () => {
    const out = listBackupsParse([
      {
        id: 'pre-restore-x',
        path: '/p',
        kind: 'pre-restore',
        createdAt: '2026-05-29T12:00:00Z',
        totalBytes: 0,
        fileCount: 0,
      },
    ]);
    expect(out[0].agents).toEqual([]);
  });

  it('parses the restore result with per-file outcomes', () => {
    const out = restoreResultParse({
      preRestoreDir: '/home/dev/.aplexica/backups/pre-restore-2026-05-29T13:00:00Z',
      files: [
        { path: '/home/dev/.claude/x.md', bytes: 12, ok: true },
        { path: '/home/dev/.claude/y.md', bytes: 0, ok: false, err: 'permission denied' },
      ],
    });
    expect(out.preRestoreDir).toContain('pre-restore-');
    expect(out.files).toHaveLength(2);
    expect(out.files[1].ok).toBe(false);
    expect(out.files[1].err).toBe('permission denied');
  });

  it('requires a non-empty backupId in a restore request', () => {
    expect(RestoreRequestSchema.safeParse({ backupId: '' }).success).toBe(false);
    expect(RestoreRequestSchema.safeParse({ backupId: 'pre-sync-x' }).success).toBe(true);
    expect(
      RestoreRequestSchema.safeParse({ backupId: 'pre-sync-x', agent: 'codex' }).success,
    ).toBe(true);
  });

  it('parses safety status and schedule defaults', () => {
    const out = backupStatusParse({
      safety: [
        {
          agent: 'kilo',
          state: 'blocked',
          roots: ['/home/dev/.config/kilo'],
          lastError: 'permission denied',
          blocked: true,
        },
      ],
      schedule: { enabled: true, intervalMinutes: 60, agents: ['kilo'] },
      retention: { perAgent: { kilo: 3, codex: 7 } },
      jobs: [
        {
          id: 'job-1',
          kind: 'manual',
          state: 'running',
          destination: 'cloud',
          agents: ['kilo'],
          createdAt: '2026-07-05T18:52:33Z',
          startedAt: '2026-07-05T18:52:33Z',
        },
      ],
    });
    expect(out.safety[0].agent).toBe('kilo');
    expect(out.safety[0].blocked).toBe(true);
    expect(out.schedule.intervalMinutes).toBe(60);
    expect(out.retention.perAgent.kilo).toBe(3);
    expect(out.retention.perAgent.codex).toBe(7);
    expect(out.jobs[0].state).toBe('running');
  });

  it('parses create backup requests for all or selected agents', () => {
    expect(CreateBackupRequestSchema.safeParse({}).success).toBe(true);
    expect(CreateBackupRequestSchema.safeParse({ agents: ['kilo'] }).success).toBe(true);
  });

  it('requires a non-empty backupId in a delete request', () => {
    expect(DeleteBackupRequestSchema.safeParse({ backupId: '' }).success).toBe(false);
    expect(DeleteBackupRequestSchema.safeParse({ backupId: 'manual-kilo-x' }).success).toBe(true);
    expect(DeleteBackupRequestSchema.safeParse({ backupId: 'manual-kilo-x', location: 'cloud' }).success).toBe(true);
  });
});
