// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from 'zod';

export const DEFAULT_SCHEDULED_SYNC_INTERVAL_SECONDS = 15 * 60;

// The daemon rule schema is intentionally loose: the UI provides a practical
// form rather than a predicate builder, so
// we only validate the fields the form touches and let the daemon's
// syncrules.Validate handle the rest.
export const MatchScopeProjectSchema = z.object({
  id: z.array(z.string()).optional(),
  ephemeral: z.boolean().optional(),
}).partial();

export const MatchScopeSchema = z.object({
  kind: z.array(z.string()).optional(),
  project: MatchScopeProjectSchema.optional(),
  namespace: z.array(z.string()).optional(),
}).partial();

export const MatchSpecSchema = z.object({
  kind: z.string().optional(),
  tag: z.array(z.string()).optional(),
  type: z.array(z.string()).optional(),
  toolKind: z.array(z.string()).optional(),
  toolCapability: z.array(z.string()).optional(),
  scope: MatchScopeSchema.optional(),
  agentSource: z.array(z.string()).optional(),
  deviceSource: z.array(z.string()).optional(),
  size: z.string().optional(),
  path: z.string().optional(),
  branchName: z.string().optional(),
}).partial();

export const RouteSpecSchema = z.object({
  agents: z.array(z.string()).optional(),
  remote: z.string().optional(),
  skillMode: z.string().optional(),
  includeSecrets: z.boolean().optional(),
  // Hosted-sync device scope: omitted or ['*'] means all paired devices;
  // explicit IDs narrow the rule to those devices.
  devices: z.array(z.string()).optional(),
}).partial();

export const AssignSpecSchema = z.object({
  tags: z.array(z.string()).optional(),
}).partial();

export const RuleSchema = z.object({
  Name: z.string(),
  Match: MatchSpecSchema.optional(),
  Route: RouteSpecSchema.optional(),
  Assign: AssignSpecSchema.optional(),
  Mode: z.string().optional(),
  ScheduledIntervalSeconds: z.number().int().nonnegative().optional(),
  // The daemon uses the wire value 'cloud' for rules managed by a hosted account.
  Source: z.string().optional(),
}).passthrough();
export type Rule = z.infer<typeof RuleSchema>;

export const RulesListSchema = z.array(RuleSchema);

// The daemon's sentinel for routing back to the originating agent.
export const AGENT_ORIGINATING = '__originatingAgent__';

// Form-level input shape — what the practical Add/Edit form collects.
// This is intentionally the *practical* subset of the full Rule: the
// fields a user can sensibly set from a form. Advanced matchers
// (scope/path/branch/size/toolKind/agentSource) are preserved verbatim
// via PATCH-merge and shown read-only — they are NOT in this schema.
export const RuleFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  // artifact types — checkbox group (memory/skill/tool/conversation).
  // Empty = match every type.
  types: z.array(z.string()).default([]),
  // match tags — open-ended chip list.
  matchTags: z.array(z.string()).default([]),
  // target agents — multi-select. Empty = all installed agents.
  // The literal `__originatingAgent__` token routes back to origin.
  agents: z.array(z.string()).default([]),
  // route.remote === "exclude" — keep matching artifacts on this device.
  syncOffDevice: z.boolean().optional(),
  // route.includeSecrets — when false, secret values are stripped.
  includeSecrets: z.boolean().optional(),
  // assign.tags — open-ended chip list.
  assignTags: z.array(z.string()).default([]),
  // Device scope used by hosted sync. The local form keeps this hidden and
  // preserves the daemon's all-devices default.
  devices: z.array(z.string()).default([]),
  // sync mode — live | scheduled | manual (or "" = unset).
  mode: z.string().optional(),
  // Scheduled sync cadence in seconds. Only sent when mode === "scheduled".
  scheduledIntervalSeconds: z.number().int().positive().default(DEFAULT_SCHEDULED_SYNC_INTERVAL_SECONDS),
});
// Output shape (post-resolution) — what react-hook-form holds and
// handleSubmit yields: the array fields are always present (defaulted []).
export type RuleFormValues = z.infer<typeof RuleFormSchema>;
// Input shape — what callers may pass before resolution: the defaulted
// array fields are optional. `RuleFormValues` is assignable to this, so
// the transforms below accept both the resolved form values and the
// looser literals used in tests.
export type RuleFormInput = z.input<typeof RuleFormSchema>;

// Translate the practical form into the wire shape the daemon expects.
// The form's "artifact types" selector maps to Match.type (the
// artifact-type matcher), NOT Match.kind (a separate high-level matcher
// that is "any" in the default ruleset).
//
// syncOffDevice is inverted into route.remote: when the user turns
// OFF-device sync off (syncOffDevice=false) we set route.remote="exclude"
// so matching artifacts never leave this machine. Default (undefined or
// true) leaves remote unset = remote transport allowed.
export function ruleFromForm(v: RuleFormInput): Rule {
  const types = v.types ?? [];
  const matchTags = v.matchTags ?? [];
  const agents = v.agents ?? [];
  const assignTags = v.assignTags ?? [];
  const devices = v.devices ?? [];

  const match: NonNullable<Rule['Match']> = {};
  if (types.length > 0) match.type = types;
  if (matchTags.length > 0) match.tag = matchTags;

  const route: NonNullable<Rule['Route']> = {};
  if (agents.length > 0) route.agents = agents;
  if (v.syncOffDevice === false) route.remote = 'exclude';
  if (v.includeSecrets !== undefined) route.includeSecrets = v.includeSecrets;
  // Empty or ['*'] = all devices → omit route.devices entirely. Only a
  // concrete device list narrows the scope.
  if (devices.length > 0 && !(devices.length === 1 && devices[0] === '*')) {
    route.devices = devices;
  }

  return {
    Name: v.name,
    Match: Object.keys(match).length > 0 ? match : undefined,
    Route: Object.keys(route).length > 0 ? route : undefined,
    Assign: assignTags.length > 0 ? { tags: assignTags } : undefined,
    Mode: v.mode || undefined,
    ScheduledIntervalSeconds:
      v.mode === 'scheduled'
        ? (v.scheduledIntervalSeconds ?? DEFAULT_SCHEDULED_SYNC_INTERVAL_SECONDS)
        : undefined,
  };
}

export function ruleToForm(r: Rule): RuleFormValues {
  return {
    name: r.Name ?? '',
    types: r.Match?.type ?? [],
    matchTags: r.Match?.tag ?? [],
    agents: r.Route?.agents ?? [],
    // route.remote === "exclude" means OFF-device sync is disabled, so
    // the toggle ("sync off device") is the inverse. Default true.
    syncOffDevice: r.Route?.remote !== 'exclude',
    // includeSecrets is a tri-state on the wire (*bool). When unset we
    // surface `true` in the form (the daemon's default), but
    // ruleEditFields() only emits it when the user actually changed it.
    includeSecrets: r.Route?.includeSecrets ?? true,
    assignTags: r.Assign?.tags ?? [],
    // route.devices omitted/['*'] surfaces as an empty list = all devices.
    devices: (r.Route?.devices ?? []).filter((d) => d !== '*'),
    mode: r.Mode ?? '',
    scheduledIntervalSeconds:
      r.ScheduledIntervalSeconds && r.ScheduledIntervalSeconds > 0
        ? r.ScheduledIntervalSeconds
        : DEFAULT_SCHEDULED_SYNC_INTERVAL_SECONDS,
  };
}

// Practical-set field keys a PATCH may send. PATCH-merge on the daemon
// decodes the body over the existing rule, so advanced matchers are
// preserved as long as we never send the keys we don't own.
const PRACTICAL_MATCH_KEYS = ['type', 'tag'] as const;
const PRACTICAL_ROUTE_KEYS = ['agents', 'remote', 'includeSecrets', 'devices'] as const;

/**
 * Build the minimal PATCH body for an edit: merge the practical-set
 * blocks the form owns INTO the existing rule's blocks, so advanced
 * matchers (scope/path/branch/size/toolKind/agentSource/skillMode) that
 * the form does not surface are preserved verbatim. Only Match/Route/
 * Assign/Mode are touched; Name is never sent (renames go DELETE+POST).
 */
export function ruleEditFields(original: Rule, v: RuleFormInput): Partial<Rule> {
  const next = ruleFromForm(v);

  // Merge practical Match keys over the original Match, dropping any
  // practical key the form cleared.
  const match: Record<string, unknown> = { ...(original.Match ?? {}) };
  for (const k of PRACTICAL_MATCH_KEYS) {
    const val = (next.Match as Record<string, unknown> | undefined)?.[k];
    if (val === undefined) delete match[k];
    else match[k] = val;
  }

  const route: Record<string, unknown> = { ...(original.Route ?? {}) };
  for (const k of PRACTICAL_ROUTE_KEYS) {
    const val = (next.Route as Record<string, unknown> | undefined)?.[k];
    if (val === undefined) delete route[k];
    else route[k] = val;
  }

  return {
    Match: match as Rule['Match'],
    Route: route as Rule['Route'],
    Assign: next.Assign ?? { tags: [] },
    Mode: next.Mode ?? '',
    ScheduledIntervalSeconds: next.ScheduledIntervalSeconds ?? 0,
  };
}

// ----- Presets (GET /api/rules/presets) -------------------------------
// A preset bundles one or
// more concrete Rule objects the client POSTs (one POST per element).
export const RulePresetSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional().default(''),
  group: z.boolean().optional().default(false),
  rules: z.array(RuleSchema),
});
export type RulePreset = z.infer<typeof RulePresetSchema>;

export const RulePresetsListSchema = z.array(RulePresetSchema);

/** Parse the GET /api/rules/presets response. */
export function listPresetsParse(data: unknown): RulePreset[] {
  return RulePresetsListSchema.parse(data);
}

export interface RuleSummary {
  /** What artifacts the rule applies to. */
  match: string;
  /** Which agents receive matching artifacts. */
  targets: string;
  /** What the rule enforces beyond plain fan-out. */
  effect: string;
}

/**
 * Derive a human-readable summary of a rule from its real (nested)
 * Match / Route / Assign shape — mirrors what `aplexica rules list`
 * prints. Falls back to permissive defaults so a bare rule still reads
 * sensibly ("all artifacts → all installed agents → fan out").
 */
export function summarizeRule(r: Rule): RuleSummary {
  const m = r.Match ?? {};
  const matchParts: string[] = [];
  if (m.type?.length) matchParts.push(m.type.join(', '));
  if (m.tag?.length) matchParts.push(`tag: ${m.tag.join(', ')}`);
  if (m.toolKind?.length) matchParts.push(`tool kind: ${m.toolKind.join(', ')}`);
  if (m.toolCapability?.length) matchParts.push(`tool cap: ${m.toolCapability.join(', ')}`);
  if (m.scope?.project?.ephemeral) matchParts.push('ephemeral projects');
  else if (m.scope?.kind?.length) matchParts.push(`scope: ${m.scope.kind.join(', ')}`);
  if (m.scope?.namespace?.length) matchParts.push(`namespace: ${m.scope.namespace.join(', ')}`);
  if (m.agentSource?.length) matchParts.push(`from: ${m.agentSource.join(', ')}`);
  if (m.branchName) matchParts.push(`branch: ${m.branchName}`);
  if (m.path) matchParts.push(`path: ${m.path}`);
  const match = matchParts.length > 0 ? matchParts.join(' · ') : 'all artifacts';

  const agents = r.Route?.agents ?? [];
  const targets =
    agents.length === 0
      ? 'all installed agents'
      : agents
          .map((a) => (a === AGENT_ORIGINATING ? 'originating agent' : a))
          .join(', ');

  const effectParts: string[] = [];
  // Hosted device scope: omitted/['*'] = all devices; otherwise list the
  // narrowed scope so the summary reflects per-device targeting.
  const devices = (r.Route?.devices ?? []).filter((d) => d !== '*');
  if (devices.length > 0) effectParts.push(`devices: ${devices.join(', ')}`);
  if (r.Route?.remote === 'exclude') effectParts.push('local only (never sent off-device)');
  if (r.Route?.includeSecrets === false) effectParts.push('secret values excluded');
  if (r.Route?.skillMode) effectParts.push(`skill mode: ${r.Route.skillMode}`);
  if (r.Mode === 'scheduled') {
    effectParts.push(
      `scheduled every ${r.ScheduledIntervalSeconds ?? DEFAULT_SCHEDULED_SYNC_INTERVAL_SECONDS}s`,
    );
  }
  if (r.Assign?.tags?.length) effectParts.push(`assigns tags: ${r.Assign.tags.join(', ')}`);
  const effect = effectParts.length > 0 ? effectParts.join(' · ') : 'fan out unchanged';

  return { match, targets, effect };
}
