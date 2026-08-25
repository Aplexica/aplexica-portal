// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from 'zod';

// Daemon status wire shape:
//   { version, pid, watchedDir, paused, uptime, state, pendingImports }
export const DaemonStatusSchema = z.object({
  version: z.string(),
  pid: z.number().int(),
  watchedDir: z.string(),
  paused: z.boolean(),
  uptime: z.number(),
  state: z.string(),
  pendingImports: z.number().int(),
});
export type DaemonStatus = z.infer<typeof DaemonStatusSchema>;

export const PauseResponseSchema = z.object({ paused: z.boolean() });
export type PauseResponse = z.infer<typeof PauseResponseSchema>;
