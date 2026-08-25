// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SCHEDULED_SYNC_INTERVAL_SECONDS,
  RuleFormSchema,
  ruleEditFields,
  ruleFromForm,
  ruleToForm,
  listPresetsParse,
  summarizeRule,
} from './rules';

describe('rule form transforms', () => {
  it('requires a name', () => {
    const r = RuleFormSchema.safeParse({ name: '' });
    expect(r.success).toBe(false);
  });

  it('maps array types, match tags, agents and assign tags to the wire shape', () => {
    const out = ruleFromForm({
      name: 'share-skills',
      types: ['skill', 'memory'],
      matchTags: ['team', 'shared'],
      agents: ['claude-code', 'codex', 'hermes'],
      assignTags: ['reviewed', 'team'],
      mode: 'live',
    });
    expect(out.Name).toBe('share-skills');
    // The "artifact types" selector maps to Match.type (array), not Match.kind.
    expect(out.Match?.type).toEqual(['skill', 'memory']);
    expect(out.Match?.kind).toBeUndefined();
    expect(out.Match?.tag).toEqual(['team', 'shared']);
    expect(out.Route?.agents).toEqual(['claude-code', 'codex', 'hermes']);
    expect(out.Assign?.tags).toEqual(['reviewed', 'team']);
    expect(out.Mode).toBe('live');
  });

  it('omits empty array fields from the wire shape', () => {
    const out = ruleFromForm({
      name: 'bare',
      types: [],
      matchTags: [],
      agents: [],
      assignTags: [],
    });
    expect(out.Match).toBeUndefined();
    expect(out.Route).toBeUndefined();
    expect(out.Assign).toBeUndefined();
  });

  it('maps syncOffDevice=false to route.remote="exclude"', () => {
    const off = ruleFromForm({ name: 'r', syncOffDevice: false });
    expect(off.Route?.remote).toBe('exclude');

    const on = ruleFromForm({ name: 'r', syncOffDevice: true });
    expect(on.Route?.remote).toBeUndefined();
    // No other route fields → Route should be omitted entirely.
    expect(on.Route).toBeUndefined();
  });

  it('maps includeSecrets toggle to route.includeSecrets', () => {
    const stripped = ruleFromForm({ name: 'r', includeSecrets: false });
    expect(stripped.Route?.includeSecrets).toBe(false);

    const kept = ruleFromForm({ name: 'r', includeSecrets: true });
    expect(kept.Route?.includeSecrets).toBe(true);
  });

  it('maps a concrete device list to route.devices', () => {
    const out = ruleFromForm({ name: 'phone-only', devices: ['dev-a', 'dev-b'] });
    expect(out.Route?.devices).toEqual(['dev-a', 'dev-b']);
  });

  it('omits route.devices for all-devices scope (empty or wildcard)', () => {
    const empty = ruleFromForm({ name: 'r', devices: [] });
    expect(empty.Route).toBeUndefined();

    const star = ruleFromForm({ name: 'r', devices: ['*'] });
    expect(star.Route).toBeUndefined();
  });

  it('round-trips route.devices back to the form, stripping the wildcard', () => {
    const scoped = ruleFromForm({ name: 'r', devices: ['dev-a'] });
    expect(ruleToForm(scoped).devices).toEqual(['dev-a']);

    // A wire rule explicitly scoped to ['*'] reads back as all-devices ([]).
    expect(ruleToForm({ Name: 'r', Route: { devices: ['*'] } }).devices).toEqual([]);
    // A bare rule surfaces an empty device scope.
    expect(ruleToForm({ Name: 'bare' }).devices).toEqual([]);
  });

  it('preserves the originating-agent sentinel through the form', () => {
    const out = ruleFromForm({ name: 'fork', agents: ['__originatingAgent__'] });
    expect(out.Route?.agents).toEqual(['__originatingAgent__']);
  });

  it('round-trips a rule back to the form shape', () => {
    const rule = ruleFromForm({
      name: 'r1',
      types: ['memory'],
      matchTags: ['x'],
      agents: ['a', 'b'],
      assignTags: ['y'],
      mode: 'scheduled',
      scheduledIntervalSeconds: 600,
      syncOffDevice: false,
      includeSecrets: false,
    });
    const back = ruleToForm(rule);
    expect(back.name).toBe('r1');
    expect(back.types).toEqual(['memory']);
    expect(back.matchTags).toEqual(['x']);
    expect(back.agents).toEqual(['a', 'b']);
    expect(back.assignTags).toEqual(['y']);
    expect(back.mode).toBe('scheduled');
    expect(back.scheduledIntervalSeconds).toBe(600);
    // route.remote === "exclude" → off-device sync OFF.
    expect(back.syncOffDevice).toBe(false);
    expect(back.includeSecrets).toBe(false);
  });

  it('surfaces syncOffDevice=true / includeSecrets=true defaults when route is bare', () => {
    const back = ruleToForm({ Name: 'bare' });
    expect(back.types).toEqual([]);
    expect(back.matchTags).toEqual([]);
    expect(back.agents).toEqual([]);
    expect(back.assignTags).toEqual([]);
    expect(back.syncOffDevice).toBe(true);
    expect(back.includeSecrets).toBe(true);
    expect(back.scheduledIntervalSeconds).toBe(DEFAULT_SCHEDULED_SYNC_INTERVAL_SECONDS);
  });

  it('sets the default scheduled-sync interval when scheduled mode is selected', () => {
    const out = ruleFromForm({ name: 'scheduled', mode: 'scheduled' });
    expect(out.Mode).toBe('scheduled');
    expect(out.ScheduledIntervalSeconds).toBe(DEFAULT_SCHEDULED_SYNC_INTERVAL_SECONDS);
  });

  it('omits the scheduled-sync interval for non-scheduled rules', () => {
    const live = ruleFromForm({
      name: 'live',
      mode: 'live',
      scheduledIntervalSeconds: 600,
    });
    expect(live.ScheduledIntervalSeconds).toBeUndefined();

    const manual = ruleFromForm({
      name: 'manual',
      mode: 'manual',
      scheduledIntervalSeconds: 600,
    });
    expect(manual.ScheduledIntervalSeconds).toBeUndefined();
  });
});

describe('ruleEditFields (PATCH-merge)', () => {
  it('preserves advanced matchers the form does not own', () => {
    const original = {
      Name: 'guard',
      Match: {
        // practical
        type: ['memory'],
        tag: ['old'],
        // advanced — must survive an edit
        scope: { project: { ephemeral: true } },
        path: 'secrets/**',
        toolKind: ['mcp'],
      },
      Route: { agents: ['claude-code'], skillMode: 'strict', remote: 'exclude' },
    };
    const patch = ruleEditFields(original, {
      name: 'guard',
      types: ['memory', 'skill'],
      matchTags: ['new'],
      agents: ['claude-code', 'codex'],
      assignTags: [],
      syncOffDevice: true, // turn off-device sync back ON → drop route.remote
    });

    // Practical fields reflect the edit.
    expect(patch.Match?.type).toEqual(['memory', 'skill']);
    expect(patch.Match?.tag).toEqual(['new']);
    expect(patch.Route?.agents).toEqual(['claude-code', 'codex']);
    // route.remote cleared because syncOffDevice is true now.
    expect(patch.Route?.remote).toBeUndefined();

    // Advanced matchers are preserved verbatim.
    const m = patch.Match as Record<string, unknown>;
    expect(m.scope).toEqual({ project: { ephemeral: true } });
    expect(m.path).toBe('secrets/**');
    expect(m.toolKind).toEqual(['mcp']);
    expect((patch.Route as Record<string, unknown>).skillMode).toBe('strict');
  });

  it('writes and clears route.devices as a practical route key', () => {
    // Narrowing: a scoped form sets route.devices.
    const scoped = ruleEditFields(
      { Name: 'r', Route: { agents: ['claude-code'] } },
      { name: 'r', agents: ['claude-code'], devices: ['dev-a'] },
    );
    expect((scoped.Route as Record<string, unknown>).devices).toEqual(['dev-a']);

    // Widening back to all devices clears route.devices from the patch.
    const widened = ruleEditFields(
      { Name: 'r', Route: { agents: ['claude-code'], devices: ['dev-a'] } },
      { name: 'r', agents: ['claude-code'], devices: [] },
    );
    expect((widened.Route as Record<string, unknown>).devices).toBeUndefined();
    // Agents (another practical key) survive the widening.
    expect((widened.Route as Record<string, unknown>).agents).toEqual(['claude-code']);
  });

  it('clears the scheduled-sync interval when mode changes away from scheduled', () => {
    const patch = ruleEditFields(
      { Name: 'r', Mode: 'scheduled', ScheduledIntervalSeconds: 600 },
      { name: 'r', mode: 'live', scheduledIntervalSeconds: 600 },
    );
    expect(patch.Mode).toBe('live');
    expect(patch.ScheduledIntervalSeconds).toBe(0);
  });

  it('drops a cleared practical match key without touching advanced keys', () => {
    const original = { Name: 'r', Match: { type: ['memory'], path: 'a/**' } };
    const patch = ruleEditFields(original, {
      name: 'r',
      types: [],
      matchTags: [],
      agents: [],
      assignTags: [],
    });
    const m = patch.Match as Record<string, unknown>;
    expect(m.type).toBeUndefined();
    expect(m.path).toBe('a/**');
  });
});

describe('listPresetsParse', () => {
  it('parses the presets catalog including a group', () => {
    const out = listPresetsParse([
      {
        id: 'default-all-to-all',
        title: 'Sync everything everywhere',
        description: 'Fan out.',
        group: false,
        rules: [{ Name: 'default-all-to-all', Match: { kind: 'any' } }],
      },
      {
        id: 'recommended-starter-set',
        title: 'Recommended starter set',
        group: true,
        rules: [{ Name: 'a' }, { Name: 'b' }],
      },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].rules[0].Name).toBe('default-all-to-all');
    // group + description defaults applied.
    expect(out[1].group).toBe(true);
    expect(out[1].description).toBe('');
    expect(out[1].rules).toHaveLength(2);
  });
});

describe('summarizeRule', () => {
  it('describes the default fan-out rule', () => {
    const s = summarizeRule({
      Name: 'default-all-to-all',
      Match: { kind: 'any', type: ['memory', 'skill', 'tool', 'conversation'] },
    });
    expect(s.match).toBe('memory, skill, tool, conversation');
    expect(s.targets).toBe('all installed agents');
    expect(s.effect).toBe('fan out unchanged');
  });

  it('describes a tag-matched local-only rule', () => {
    const s = summarizeRule({
      Name: 'private-stays-local',
      Match: { tag: ['private', 'secret'] },
      Route: { remote: 'exclude' },
    });
    expect(s.match).toBe('tag: private, secret');
    expect(s.effect).toContain('local only');
  });

  it('renders the originating-agent sentinel and ephemeral scope', () => {
    const fork = summarizeRule({
      Name: 'fork-respects-origin',
      Match: { tag: ['fork-of:*'] },
      Route: { agents: ['__originatingAgent__'] },
    });
    expect(fork.targets).toBe('originating agent');

    const eph = summarizeRule({
      Name: 'ephemeral-projects-stay-local',
      Match: { scope: { kind: ['project'], project: { ephemeral: true } } },
      Route: { remote: 'exclude' },
    });
    expect(eph.match).toBe('ephemeral projects');
  });

  it('mentions device scope when route.devices narrows the rule', () => {
    const s = summarizeRule({
      Name: 'phone-only',
      Route: { agents: ['claude-code'], devices: ['dev-a', 'dev-b'] },
    });
    expect(s.effect).toContain('devices: dev-a, dev-b');

    // All-devices scope (omitted or ['*']) is not mentioned.
    const all = summarizeRule({ Name: 'r', Route: { devices: ['*'] } });
    expect(all.effect).toBe('fan out unchanged');
  });

  it('mentions scheduled cadence for scheduled rules', () => {
    const s = summarizeRule({
      Name: 'scheduled',
      Mode: 'scheduled',
      ScheduledIntervalSeconds: 600,
    });
    expect(s.effect).toContain('scheduled every 600s');
  });

  it('falls back to permissive defaults for a bare rule', () => {
    const s = summarizeRule({ Name: 'bare' });
    expect(s.match).toBe('all artifacts');
    expect(s.targets).toBe('all installed agents');
    expect(s.effect).toBe('fan out unchanged');
  });
});
