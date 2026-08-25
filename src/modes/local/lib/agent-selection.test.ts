// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { editSelection, normalizeAgentSelection } from './agent-selection';

const ALL = ['claude-code', 'codex', 'hermes'];

describe('editSelection', () => {
  it('pre-checks every installed agent when the stored set is empty (= all agents)', () => {
    expect(editSelection([], ALL)).toEqual(ALL);
  });

  it('pre-checks the stored subset', () => {
    expect(editSelection(['claude-code'], ALL)).toEqual(['claude-code']);
  });

  it('drops stored agents that are no longer installed', () => {
    expect(editSelection(['claude-code', 'gone'], ALL)).toEqual(['claude-code']);
  });
});

describe('normalizeAgentSelection', () => {
  it('returns null when nothing is selected (a project must sync to >=1 agent)', () => {
    expect(normalizeAgentSelection([], ALL)).toBeNull();
  });

  it('collapses "all installed selected" to [] (canonical all-agents, future-proof)', () => {
    expect(normalizeAgentSelection(['hermes', 'claude-code', 'codex'], ALL)).toEqual([]);
  });

  it('returns the sorted subset when a strict subset is selected', () => {
    expect(normalizeAgentSelection(['codex', 'claude-code'], ALL)).toEqual([
      'claude-code',
      'codex',
    ]);
  });

  it('ignores values that are not installed', () => {
    expect(normalizeAgentSelection(['claude-code', 'ghost'], ALL)).toEqual(['claude-code']);
  });

  it('treats an all-but-uninstalled-noise selection as all-agents', () => {
    expect(normalizeAgentSelection([...ALL, 'ghost'], ALL)).toEqual([]);
  });
});
