// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from 'zod';

// GET /api/config returns the entire loaded daemon.Config struct; we
// don't enumerate every field here — only the ones the safe-toggle UI
// reads. Unknown keys passthrough so future-proofness is free.
export const ConfigSchema = z
  .object({
    logLevel: z.string().optional(),
    hermesWatchInterval: z.union([z.string(), z.number()]).optional(),
    snapshotCadenceConversation: z.union([z.string(), z.number()]).optional(),
    snapshotCadenceMemory: z.union([z.string(), z.number()]).optional(),
    snapshotCadenceSkill: z.union([z.string(), z.number()]).optional(),
    snapshotCadenceTool: z.union([z.string(), z.number()]).optional(),
    snapshotMaxAgeConversation: z.union([z.string(), z.number()]).optional(),
    snapshotMaxAgeMemory: z.union([z.string(), z.number()]).optional(),
    snapshotMaxAgeSkill: z.union([z.string(), z.number()]).optional(),
    snapshotMaxAgeTool: z.union([z.string(), z.number()]).optional(),
    storeHighWatermarkGB: z.union([z.string(), z.number()]).optional(),
    tray: z
      .object({
        enabled: z.boolean().optional(),
      })
      .partial()
      .optional(),
    web: z
      .object({
        enabled: z.boolean().optional(),
        port: z.number().optional(),
        bind: z.string().optional(),
      })
      .partial()
      .optional(),
  })
  .passthrough();
export type Config = z.infer<typeof ConfigSchema>;

// PATCH /api/config is a free-form map; whitelist enforced server-side.
export const ConfigPatchSchema = z.record(z.unknown());
export type ConfigPatch = z.infer<typeof ConfigPatchSchema>;

// Form-level shape used by SettingsPage. Strings (vs raw numbers) keep
// the controlled inputs straightforward.
export const SettingsFormSchema = z.object({
  logLevel: z.string().optional(),
  hermesWatchInterval: z.string().optional(),
});
export type SettingsFormValues = z.infer<typeof SettingsFormSchema>;

export const RawPathResponseSchema = z.object({ path: z.string() });
