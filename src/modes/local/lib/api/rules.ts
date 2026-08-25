// SPDX-License-Identifier: AGPL-3.0-or-later
import { api } from './client';
import {
  RuleSchema,
  RulesListSchema,
  listPresetsParse,
  type Rule,
  type RulePreset,
} from '@shared/schemas';

export async function listRules(): Promise<Rule[]> {
  return RulesListSchema.parse(await api.get<unknown>('/api/rules'));
}

export async function listPresets(): Promise<RulePreset[]> {
  return listPresetsParse(await api.get<unknown>('/api/rules/presets'));
}

export async function getRule(id: string): Promise<Rule> {
  return RuleSchema.parse(await api.get<unknown>(`/api/rules/${encodeURIComponent(id)}`));
}

export async function createRule(body: Rule): Promise<Rule> {
  return RuleSchema.parse(await api.post<unknown>('/api/rules', body));
}

export async function updateRule(id: string, body: Partial<Rule>): Promise<Rule> {
  return RuleSchema.parse(await api.patch<unknown>(`/api/rules/${encodeURIComponent(id)}`, body));
}

export async function deleteRule(id: string): Promise<void> {
  await api.delete(`/api/rules/${encodeURIComponent(id)}`);
}
