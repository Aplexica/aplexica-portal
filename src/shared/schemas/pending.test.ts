// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import {
  PendingListSchema,
  ApproveRequestSchema,
  ProjectListSchema,
  AddProjectRequestSchema,
} from './index';

describe('pending schemas', () => {
  it('parses a discovered folder with discovery metadata', () => {
    const out = PendingListSchema.parse([
      {
        id: 'proj-1',
        artifactCount: 3,
        samplePath: '/home/dev/code/widget',
        source: 'discovered',
        agents: ['claude-code', 'codex'],
        lastActive: 1_717_000_000,
        isGitRepo: true,
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe('discovered');
    expect(out[0].agents).toEqual(['claude-code', 'codex']);
    expect(out[0].isGitRepo).toBe(true);
  });

  it('stays back-compat with a pre-discovery row (no optional fields)', () => {
    const out = PendingListSchema.parse([{ id: 'old', artifactCount: 1 }]);
    expect(out[0].source).toBeUndefined();
    expect(out[0].agents).toBeUndefined();
    expect(out[0].lastActive).toBeUndefined();
  });

  it('requires scope + path on an approve request', () => {
    expect(ApproveRequestSchema.safeParse({ scope: 'local', path: '/p' }).success).toBe(true);
    expect(ApproveRequestSchema.safeParse({ scope: 'global', path: '' }).success).toBe(false);
    expect(ApproveRequestSchema.safeParse({ scope: 'nope', path: '/p' }).success).toBe(false);
    expect(
      ApproveRequestSchema.safeParse({ scope: 'local', path: '/p', agents: ['codex'] }).success,
    ).toBe(true);
  });
});

describe('projects schemas', () => {
  it('parses the GET /api/projects list and defaults a missing agents array', () => {
    const out = ProjectListSchema.parse([
      { id: 'p1', path: '/home/dev/code/widget', scope: 'local', agents: ['codex'], vcs: 'git' },
      { id: 'p2', path: '/home/dev', scope: 'global' },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].scope).toBe('local');
    expect(out[1].agents).toEqual([]);
  });

  it('requires a non-empty path and a valid scope on add', () => {
    expect(AddProjectRequestSchema.safeParse({ path: '/p', scope: 'global' }).success).toBe(true);
    expect(AddProjectRequestSchema.safeParse({ path: '', scope: 'global' }).success).toBe(false);
    expect(AddProjectRequestSchema.safeParse({ path: '/p', scope: 'bad' }).success).toBe(false);
  });
});
