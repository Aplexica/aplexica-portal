// SPDX-License-Identifier: AGPL-3.0-or-later
import { t } from '@shared/i18n';
import type { EventRecord, SSEEvent } from '@shared/schemas';

export interface EventDisplay {
  title: string;
  meta: string[];
  typeLabel: string;
  artifactKindLabel?: string;
}

interface EventFields {
  eventType?: string;
  action?: string;
  agent?: string;
  artifactId?: string;
  artifactKind?: string;
  name?: string;
  sourcePath?: string;
  targetAgents?: string[];
  scope?: string;
  projectPath?: string;
  origin?: string;
  reason?: string;
  sizeBytes?: number;
  limitBytes?: number;
}

function bodyRecord(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

function str(body: Record<string, unknown>, key: string): string {
  return typeof body[key] === 'string' ? (body[key] as string) : '';
}

function num(body: Record<string, unknown>, key: string): number | undefined {
  return typeof body[key] === 'number' && Number.isFinite(body[key]) ? (body[key] as number) : undefined;
}

function strArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function labelFromCatalog(prefix: string, value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const key = `${prefix}.${value}`;
  const label = t(key);
  return label === key ? fallback : label;
}

function prettify(value: string | undefined): string {
  if (!value) return t('events.labels.activity');
  return value
    .split(/[.\-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || bytes < 0) return t('common.unknown');
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = unit === 0 || value >= 10 ? Math.round(value).toString() : value.toFixed(1);
  return `${rounded} ${units[unit]}`;
}

export function eventTypeLabel(value: string | undefined): string {
  return labelFromCatalog('events.kinds', value, prettify(value));
}

function artifactKindLabel(value: string | undefined): string {
  return labelFromCatalog('events.artifactKinds', value, t('events.labels.artifact'));
}

function scopeLabel(value: string | undefined): string {
  return labelFromCatalog('events.scopes', value, value ?? '');
}

function actionFrom(fields: EventFields): string {
  if (fields.action) return fields.action;
  switch (fields.eventType) {
    case 'artifact.checkpoint':
      return 'checkpointed';
    case 'artifact.refused':
      return 'refused';
    case 'artifact.synced':
      return 'synced';
    case 'artifact.imported':
      return fields.targetAgents && fields.targetAgents.length > 0 ? 'synced' : 'imported';
    default:
      return '';
  }
}

function displayName(fields: EventFields): string {
  const rawName = fields.name?.trim();
  const rawKind = fields.artifactKind?.trim();
  const generatedJSONL = rawName ? rawName.toLowerCase().endsWith('.jsonl') : false;
  if (isSessionPath(fields.sourcePath) && fields.eventType === 'artifact.refused') {
    return t('events.labels.conversation');
  }
  if (rawKind === 'conversation' && generatedJSONL) return t('events.labels.conversation');
  if (rawName && !generatedJSONL) return rawName;
  if (rawKind) return artifactKindLabel(rawKind);
  if (fields.artifactId) return t('events.labels.artifact');
  return t('events.labels.activity');
}

function artifactDescription(fields: EventFields): string {
  const kind = artifactKindLabel(fields.artifactKind);
  const name = displayName(fields);
  if (name === kind || name === t('events.labels.artifact') || name === t('events.labels.activity')) {
    return name;
  }
  return t('events.labels.kindAndName', { kind, name });
}

function listAgents(agents: string[]): string {
  return unique(agents).join(', ');
}

function isSessionPath(path: string | undefined): boolean {
  return Boolean(path?.toLowerCase().endsWith('.jsonl'));
}

export function agentFromPath(path: string | undefined): string {
  const p = path?.toLowerCase() ?? '';
  if (p.includes('/.claude/') || p.includes('\\.claude\\')) return 'claude-code';
  if (p.includes('/.codex/') || p.includes('\\.codex\\')) return 'codex';
  if (p.includes('/.config/kilo/') || p.includes('\\.config\\kilo\\') || p.includes('/.kilo/') || p.includes('\\.kilo\\')) {
    return 'kilo';
  }
  if (p.includes('/.hermes/') || p.includes('\\.hermes\\')) return 'hermes';
  if (p.includes('/.openclaw/') || p.includes('\\.openclaw\\')) return 'openclaw';
  return '';
}

function resolvedAgent(fields: EventFields): string {
  return fields.agent || agentFromPath(fields.sourcePath) || t('events.labels.unknownAgent');
}

function sourceLocation(fields: EventFields): string {
  if (!fields.sourcePath) return '';
  if ((fields.artifactKind === 'conversation' || fields.eventType === 'artifact.refused') && isSessionPath(fields.sourcePath)) {
    return t('events.sources.agentSession', {
      agent: resolvedAgent(fields),
    });
  }
  return fields.sourcePath;
}

function refusedDescription(fields: EventFields): string {
  if (isSessionPath(fields.sourcePath)) {
    return t('events.sources.agentSession', { agent: resolvedAgent(fields) });
  }
  return artifactDescription(fields);
}

function titleFor(fields: EventFields): string {
  const agent = resolvedAgent(fields);
  const item = artifactDescription(fields);
  const targets = listAgents(fields.targetAgents ?? []);
  const action = actionFrom(fields);

  if (fields.eventType === 'daemon.state') {
    return t('events.labels.daemonState');
  }
  if (fields.eventType === 'agent.activity') {
    return t('events.labels.active', { agent });
  }
  if (action === 'checkpointed') {
    return t('events.labels.checkpointed', { item });
  }
  if (action === 'refused') {
    return t('events.labels.refused', { item: refusedDescription(fields) });
  }
  if (action === 'synced' && targets) {
    return t('events.labels.syncedTo', { agent, item, targets });
  }
  if (action === 'synced') {
    return t('events.labels.synced', { agent, item });
  }
  if (action === 'imported') {
    return t('events.labels.imported', { agent, item });
  }
  return t('events.labels.activity');
}

function reasonFor(fields: EventFields): string {
  if (fields.reason === 'max-artifact-size') {
    return t('events.reasons.maxArtifactSize', {
      size: formatBytes(fields.sizeBytes),
      limit: formatBytes(fields.limitBytes),
    });
  }
  return fields.reason ? prettify(fields.reason) : '';
}

function metaFor(fields: EventFields): string[] {
  const meta: string[] = [];
  const source = sourceLocation(fields);
  if (source) {
    meta.push(t('events.meta.from', { value: source }));
  }
  const reason = reasonFor(fields);
  if (reason) {
    meta.push(t('events.meta.reason', { value: reason }));
  }
  if (fields.origin === 'remote') {
    meta.push(t('events.meta.origin', { value: t('events.origins.remote') }));
  }
  const targets = listAgents(fields.targetAgents ?? []);
  if (targets) {
    meta.push(t('events.meta.to', { value: targets }));
  }
  if (fields.projectPath) {
    meta.push(t('events.meta.project', { value: fields.projectPath }));
  } else if (fields.scope) {
    meta.push(t('events.meta.scope', { value: scopeLabel(fields.scope) }));
  }
  return meta;
}

function describeFields(fields: EventFields): EventDisplay {
  return {
    title: titleFor(fields),
    meta: metaFor(fields),
    typeLabel: eventTypeLabel(fields.eventType),
    artifactKindLabel: fields.artifactKind ? artifactKindLabel(fields.artifactKind) : undefined,
  };
}

export function agentsForRecord(event: EventRecord): string[] {
  return unique([event.agent ?? '', ...(event.targetAgents ?? [])]);
}

export function agentsForBody(body: unknown): string[] {
  const b = bodyRecord(body);
  return unique([
    str(b, 'agent') || str(b, 'source') || str(b, 'adapter'),
    str(b, 'target'),
    ...strArray(b.targetAgents),
  ]);
}

export function describeEventRecord(event: EventRecord): EventDisplay {
  return describeFields({
    eventType: event.type,
    action: event.action,
    agent: event.agent,
    artifactId: event.artifactId,
    artifactKind: event.kind,
    name: event.name,
    sourcePath: event.sourcePath,
    targetAgents: event.targetAgents,
    scope: event.scope,
    projectPath: event.projectPath,
    origin: event.origin,
    reason: event.reason,
    sizeBytes: event.size,
    limitBytes: event.limit,
  });
}

export function describeSSEEvent(event: SSEEvent): EventDisplay {
  const b = bodyRecord(event.body);
  return describeFields({
    eventType: event.kind,
    action: str(b, 'action'),
    agent: str(b, 'agent') || str(b, 'source') || str(b, 'adapter'),
    artifactId: str(b, 'artifactId'),
    artifactKind: str(b, 'kind'),
    name: str(b, 'name'),
    sourcePath: str(b, 'sourcePath'),
    targetAgents: strArray(b.targetAgents),
    scope: str(b, 'scope'),
    projectPath: str(b, 'projectPath'),
    origin: str(b, 'origin'),
    reason: str(b, 'reason'),
    sizeBytes: num(b, 'size'),
    limitBytes: num(b, 'limit'),
  });
}
