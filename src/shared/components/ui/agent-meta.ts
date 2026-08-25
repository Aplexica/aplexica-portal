// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Per-agent presentation metadata: a human display name, a one-line blurb,
 * and a brand hue used to tint the agent's monogram glyph. Keeps the UI from
 * showing raw ids like "claude-code" and gives each agent a recognizable
 * color identity without shipping (potentially trademarked) vendor logos.
 */
export interface AgentMeta {
  id: string;
  name: string;
  blurb: string;
  /** HSL hue (0–360) for the monogram tint. */
  hue: number;
}

const META: Record<string, AgentMeta> = {
  'claude-code': { id: 'claude-code', name: 'Claude Code', blurb: 'Anthropic’s terminal coding agent', hue: 24 },
  codex: { id: 'codex', name: 'Codex', blurb: 'OpenAI’s coding agent', hue: 152 },
  hermes: { id: 'hermes', name: 'Hermes', blurb: 'Conversation-rich local agent', hue: 265 },
  openclaw: { id: 'openclaw', name: 'OpenClaw', blurb: 'Open-source coding agent', hue: 205 },
  kilo: { id: 'kilo', name: 'Kilo', blurb: 'Project-scoped coding agent', hue: 330 },
};

export function agentMeta(id: string): AgentMeta {
  return META[id] ?? { id, name: id, blurb: '', hue: 220 };
}

/** Two-letter (or one-letter) monogram for the glyph tile. */
export function agentMonogram(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9 ]/g, '').trim();
  const parts = cleaned.split(/[\s-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return cleaned.slice(0, 2).toUpperCase() || '?';
}
