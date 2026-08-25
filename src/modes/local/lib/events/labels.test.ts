// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { agentsForRecord, describeEventRecord, describeSSEEvent } from './labels';

describe('event labels', () => {
  it('renders conversation jsonl names as a readable conversation sync', () => {
    const display = describeEventRecord({
      seq: 1,
      type: 'artifact.imported',
      timestamp: '2026-07-02T18:00:00Z',
      artifactId: 'abc',
      kind: 'conversation',
      agent: 'claude-code',
      name: 'agent-a0b6e26ec165eadef.jsonl',
      action: 'synced',
      sourcePath: '~/.claude/projects/demo/agent-a0b6e26ec165eadef.jsonl',
      targetAgents: ['codex', 'kilo'],
      scope: 'project',
      projectPath: '~/code/demo',
    });

    expect(display.title).toBe('claude-code synced conversation to codex, kilo');
    expect(display.title).not.toContain('.jsonl');
    expect(display.meta).toContain('From: claude-code session history');
    expect(display.meta).toContain('To: codex, kilo');
    expect(display.meta).toContain('Project: ~/code/demo');
  });

  it('matches agent filters against source and target agents', () => {
    expect(
      agentsForRecord({
        seq: 1,
        type: 'artifact.imported',
        timestamp: '2026-07-02T18:00:00Z',
        agent: 'claude-code',
        targetAgents: ['codex'],
      }),
    ).toEqual(['claude-code', 'codex']);

    expect(
      describeSSEEvent({
        seq: 2,
        kind: 'artifact.synced',
        ts: '2026-07-02T18:00:01Z',
        body: { source: 'codex', targetAgents: ['claude-code'], kind: 'memory', name: 'AGENTS.md' },
      }).title,
    ).toBe('codex synced memory AGENTS.md to claude-code');
  });

  it('shows why oversized session history was refused', () => {
    const display = describeSSEEvent({
      seq: 3,
      kind: 'artifact.refused',
      ts: '2026-07-02T18:00:02Z',
      body: {
        action: 'refused',
        name: '5e4e934b-71c0-4319-b4b1-af4107dbc615.jsonl',
        sourcePath: '~/.claude/projects/demo/5e4e934b-71c0-4319-b4b1-af4107dbc615.jsonl',
        reason: 'max-artifact-size',
        size: 87_031_808,
        limit: 67_108_864,
      },
    });

    expect(display.title).toBe('Aplexica refused claude-code session history');
    expect(display.title).not.toContain('.jsonl');
    expect(display.meta).toContain('From: claude-code session history');
    expect(display.meta).toContain('Reason: 83 MB is above the 64 MB safety limit');
  });
});
