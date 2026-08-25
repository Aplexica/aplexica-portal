// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Initial checkbox selection when opening the agent editor for a project.
 *
 * A project's stored `agents` field is empty when it means "all installed
 * agents", so we pre-check every installed agent in that case. Otherwise we
 * pre-check the stored agents that are still installed (silently dropping any
 * that have since been uninstalled, so a stale name can't survive a round-trip).
 */
export function editSelection(projectAgents: string[], installed: string[]): string[] {
  const inst = new Set(installed);
  if (projectAgents.length === 0) return [...installed];
  return projectAgents.filter((a) => inst.has(a));
}

/**
 * Normalize a checkbox selection into the value to persist in a project's
 * `agents` field. Returns:
 *   - `null`  when nothing is selected — invalid, since a project must sync to
 *             at least one agent. The caller disables Save on null.
 *   - `[]`    when every installed agent is selected — the canonical "all
 *             agents" value, which stays correct as new agents are installed
 *             later (an explicit full list would freeze the set).
 *   - the sorted subset otherwise.
 *
 * Values that are not currently installed are ignored, so the result can never
 * reintroduce an uninstalled agent.
 */
export function normalizeAgentSelection(
  selected: string[],
  installed: string[],
): string[] | null {
  const inst = new Set(installed);
  const picked = Array.from(new Set(selected.filter((a) => inst.has(a))));
  if (picked.length === 0) return null;
  if (picked.length === installed.length) return [];
  return picked.sort();
}
