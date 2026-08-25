// SPDX-License-Identifier: AGPL-3.0-or-later
import { t } from '@shared/i18n';
import { Badge, type BadgeTone } from './Badge';
import { StatusDot, type StatusTone } from './StatusDot';
import { Tooltip } from './Tooltip';

export interface AgentStatusView {
  tone: StatusTone;
  badgeTone: BadgeTone;
  label: string;
  tip: string;
  pulse: boolean;
  hollow: boolean;
}

/**
 * Decodes the raw (installed, syncState) pair into a human-legible status.
 * This is what turns the old cryptic "idle · 3" into "Idle" + a tooltip that
 * explains what idle actually means.
 */
export function agentStatusView(args: { installed?: boolean; syncState: string }): AgentStatusView {
  if (args.installed === false) {
    return {
      tone: 'neutral',
      badgeTone: 'outline',
      label: t('agentStatus.notInstalled.label'),
      tip: t('agentStatus.notInstalled.tip'),
      pulse: false,
      hollow: true,
    };
  }
  switch (args.syncState) {
    case 'active':
      return {
        tone: 'success',
        badgeTone: 'success',
        label: t('agentStatus.active.label'),
        tip: t('agentStatus.active.tip'),
        pulse: true,
        hollow: false,
      };
    case 'paused':
      return {
        tone: 'warning',
        badgeTone: 'warning',
        label: t('agentStatus.paused.label'),
        tip: t('agentStatus.paused.tip'),
        pulse: false,
        hollow: false,
      };
    case 'error':
    case 'quarantined':
      return {
        tone: 'danger',
        badgeTone: 'danger',
        label: t('agentStatus.error.label'),
        tip: t('agentStatus.error.tip'),
        pulse: false,
        hollow: false,
      };
    case 'idle':
    default:
      return {
        tone: 'idle',
        badgeTone: 'idle',
        label: t('agentStatus.idle.label'),
        tip: t('agentStatus.idle.tip'),
        pulse: false,
        hollow: false,
      };
  }
}

export function AgentStatusBadge({
  installed,
  syncState,
}: {
  installed?: boolean;
  syncState: string;
}) {
  const v = agentStatusView({ installed, syncState });
  return (
    <Tooltip label={v.tip}>
      <Badge tone={v.badgeTone}>
        <StatusDot tone={v.tone} pulse={v.pulse} hollow={v.hollow} size="sm" />
        {v.label}
      </Badge>
    </Tooltip>
  );
}
