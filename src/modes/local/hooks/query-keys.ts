// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Centralised query-key registry for TanStack Query. Hooks reference
 * these so invalidations stay precise — e.g. mutating a rule
 * invalidates `qk.rules.list()` AND `qk.rules.detail(name)`.
 */
export const qk = {
  auth: {
    session: () => ['auth', 'session'] as const,
  },
  daemon: {
    status: () => ['daemon'] as const,
  },
  agents: {
    list: () => ['agents', 'list'] as const,
    detail: (name: string) => ['agents', 'detail', name] as const,
  },
  events: {
    backfill: (since: number) => ['events', 'backfill', since] as const,
  },
  rules: {
    list: () => ['rules', 'list'] as const,
    detail: (id: string) => ['rules', 'detail', id] as const,
    presets: () => ['rules', 'presets'] as const,
  },
  conflicts: {
    list: () => ['conflicts', 'list'] as const,
    detail: (id: string) => ['conflicts', 'detail', id] as const,
  },
  conversations: {
    search: (query: string, limit: number) => ['conversations', 'search', query, limit] as const,
  },
  conversationBranches: {
    detail: (id: string) => ['conversation-branches', 'detail', id] as const,
  },
  nativeBackups: {
    list: () => ['native-backups', 'list'] as const,
    status: () => ['native-backups', 'status'] as const,
  },
  pending: {
    list: () => ['pending', 'list'] as const,
  },
  projects: {
    list: () => ['projects', 'list'] as const,
    memory: (id: string) => ['projects', 'memory', id] as const,
  },
  config: {
    current: () => ['config', 'current'] as const,
    rawPath: () => ['config', 'raw-path'] as const,
  },
  transport: {
    current: () => ['transport', 'current'] as const,
  },
  onboarding: {
    state: () => ['onboarding', 'state'] as const,
  },
  remote: {
    status: () => ['remote', 'status'] as const,
  },
  sync: {
    state: () => ['sync', 'state'] as const,
  },
};
