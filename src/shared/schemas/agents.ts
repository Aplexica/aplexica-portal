// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from 'zod';

// Agent summary returned by the daemon API.
export const AgentSummarySchema = z.object({
  name: z.string(),
  version: z.string(),
  syncState: z.string(),
  lastActivity: z.string().optional(),
  // Whether the agent was found installed on this machine.
  installed: z.boolean().optional(),
  // Native global-storage roots the daemon watches for this agent.
  globalRoots: z.array(z.string()).optional(),
  // Count of canonical-store artifacts attributed to this agent.
  artifactCount: z.number().optional(),
  // Whether cross-agent fan-out to this agent is
  // enabled. Discovery + import happen regardless; this controls outbound
  // sync. Toggled from the portal. Optional for back-compat.
  syncEnabled: z.boolean().optional(),
});
export type AgentSummary = z.infer<typeof AgentSummarySchema>;

// GET /api/sync — the await-config fan-out gate state.
export const SyncStateSchema = z.object({
  all: z.boolean(),
  agents: z.record(z.string(), z.boolean()).default({}),
});
export type SyncState = z.infer<typeof SyncStateSchema>;

// Mirrors AgentEvent.
export const AgentEventSchema = z.object({
  timestamp: z.string(),
  type: z.string(),
  detail: z.string().optional(),
});
export type AgentEvent = z.infer<typeof AgentEventSchema>;

// Mirrors AgentDetail (AgentSummary embedded + namespaces + recentEvents).
export const AgentDetailSchema = AgentSummarySchema.extend({
  namespaces: z.array(z.string()),
  recentEvents: z.array(AgentEventSchema),
});
export type AgentDetail = z.infer<typeof AgentDetailSchema>;

export const AgentsListSchema = z.array(AgentSummarySchema);
