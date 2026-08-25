// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from 'zod';

// Schemas for the daemon's optional hosted-service pairing API.

export const RemotePairRequestSchema = z.object({
  token: z.string().min(1),
  device_name: z.string().optional(),
});
export type RemotePairRequest = z.infer<typeof RemotePairRequestSchema>;

export const RemotePairResultSchema = z.object({
  paired: z.boolean(),
  device_id: z.string(),
  account_id: z.string(),
});
export type RemotePairResult = z.infer<typeof RemotePairResultSchema>;

export const RemoteStatusSchema = z.object({
  configured: z.boolean(),
  enabled: z.boolean(),
  paired: z.boolean(),
  device_id: z.string(),
  account_id: z.string(),
  conn_state: z.string(),
  restart_count: z.number(),
});
export type RemoteStatus = z.infer<typeof RemoteStatusSchema>;

export const RemoteVerifyResultSchema = z.object({
  connected: z.boolean(),
  message: z.string(),
});
export type RemoteVerifyResult = z.infer<typeof RemoteVerifyResultSchema>;
