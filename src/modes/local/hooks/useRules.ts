// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createRule,
  deleteRule,
  getRule,
  listPresets,
  listRules,
  updateRule,
} from '../lib/api/rules';
import type { Rule } from '@shared/schemas';
import { qk } from './query-keys';

export function useRules() {
  return useQuery({
    queryKey: qk.rules.list(),
    queryFn: () => listRules(),
  });
}

export function usePresets() {
  return useQuery({
    queryKey: qk.rules.presets(),
    queryFn: () => listPresets(),
  });
}

export function useRule(id: string | undefined) {
  return useQuery({
    queryKey: qk.rules.detail(id ?? ''),
    queryFn: () => getRule(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Rule) => createRule(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.rules.list() });
    },
  });
}

export function useUpdateRule(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Rule>) => updateRule(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.rules.list() });
      void qc.invalidateQueries({ queryKey: qk.rules.detail(id) });
    },
  });
}

export function useDeleteRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRule(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.rules.list() });
    },
  });
}
