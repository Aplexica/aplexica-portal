// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from 'zod';

/** Session identity returned by the daemon's local authentication API. */
export const WhoamiSchema = z.object({
  user: z.string(),
  daemon: z.record(z.unknown()),
  mode: z.string(),
});
export type Whoami = z.infer<typeof WhoamiSchema>;

/** One-time bootstrap token exchanged when the tray opens the portal. */
export const BootstrapRequestSchema = z.object({
  token: z.string().min(1),
});
export type BootstrapRequest = z.infer<typeof BootstrapRequestSchema>;
