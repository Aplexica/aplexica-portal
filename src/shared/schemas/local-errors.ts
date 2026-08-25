// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from 'zod';

// The daemon's error response is flat:
//   { "error": "<msg>", "code": "<short>" }
export const LocalApiErrorSchema = z.object({
  error: z.string(),
  code: z.string(),
});
export type LocalApiError = z.infer<typeof LocalApiErrorSchema>;
