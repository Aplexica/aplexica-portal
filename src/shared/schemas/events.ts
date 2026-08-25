// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from 'zod';

// Canonical SSE event kinds exposed by the daemon.
export const EVENT_KINDS = [
  'daemon.state',
  'agent.activity',
  'artifact.imported',
  'artifact.synced',
  'artifact.checkpoint',
  'artifact.refused',
  'conflict.created',
  'conflict.resolved',
  'pending.added',
  'pending.linked',
  'rule.fired',
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

// REST backfill record (mirrors EventRecord in events.go).
export const EventRecordSchema = z.object({
  seq: z.number(),
  type: z.string(),
  timestamp: z.string(),
  artifactId: z.string().optional(),
  kind: z.string().optional(),
  agent: z.string().optional(),
  name: z.string().optional(),
  action: z.string().optional(),
  sourcePath: z.string().optional(),
  targetAgents: z.array(z.string()).optional(),
  scope: z.string().optional(),
  projectId: z.string().optional(),
  projectPath: z.string().optional(),
  origin: z.string().optional(),
  reason: z.string().optional(),
  size: z.number().optional(),
  limit: z.number().optional(),
  data: z.unknown().optional(),
});
export type EventRecord = z.infer<typeof EventRecordSchema>;

export const EventPageSchema = z.object({
  events: z.array(EventRecordSchema),
  // The backfill feed is newest-first; nextBefore is the cursor for the next
  // (older) page — pass it back as `before`. (Mirrors EventPage in events.go.)
  nextBefore: z.number(),
});
export type EventPage = z.infer<typeof EventPageSchema>;

// SSE frame payload (mirrors Event in bus.go).
export interface SSEEvent {
  seq: number;
  kind: EventKind | string;
  ts: string;
  body?: unknown;
}
