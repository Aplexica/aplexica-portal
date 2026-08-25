// SPDX-License-Identifier: AGPL-3.0-or-later
import { api } from './client';
import {
  ConfigSchema,
  RawPathResponseSchema,
  type Config,
  type ConfigPatch,
} from '@shared/schemas';

export async function getConfig(): Promise<Config> {
  return ConfigSchema.parse(await api.get<unknown>('/api/config'));
}

export async function patchConfig(body: ConfigPatch): Promise<{ updated: ConfigPatch }> {
  return api.patch<{ updated: ConfigPatch }>('/api/config', body);
}

export async function rawConfigPath(): Promise<string> {
  const parsed = RawPathResponseSchema.parse(await api.get<unknown>('/api/config/raw-path'));
  return parsed.path;
}
