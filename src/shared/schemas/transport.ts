// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from 'zod';

export const TransportModeSchema = z.enum(['local', 'local-only', 'byo-relay', 'hosted']);
export type TransportMode = z.infer<typeof TransportModeSchema>;

export const BYORelayOptsSchema = z.object({
  url: z.string().url({ message: 'A valid URL is required' }),
  mtlsCertPath: z.string().optional(),
  mtlsKeyPath: z.string().optional(),
  caCertPath: z.string().optional(),
  namespaces: z.array(z.string()).optional(),
});
export type BYORelayOpts = z.infer<typeof BYORelayOptsSchema>;

export const TransportInfoSchema = z.object({
  mode: TransportModeSchema,
  available: z.array(TransportModeSchema),
  byo: BYORelayOptsSchema.nullable().optional(),
});
export type TransportInfo = z.infer<typeof TransportInfoSchema>;

export const TransportSetRequestSchema = z.object({
  mode: z.enum(['local', 'local-only', 'byo-relay']),
});
export type TransportSetRequest = z.infer<typeof TransportSetRequestSchema>;

// Form values for the BYO panel — wide-open so we can show validation
// progressively without blocking submit until every optional field is
// filled.
export const BYOFormSchema = z.object({
  url: z.string().min(1, 'Broker URL is required').url('A valid broker URL is required'),
  mtlsCertPath: z.string().optional(),
  mtlsKeyPath: z.string().optional(),
  caCertPath: z.string().optional(),
  namespaces: z.string().optional(), // comma-separated
});
export type BYOFormValues = z.infer<typeof BYOFormSchema>;
