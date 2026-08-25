// SPDX-License-Identifier: AGPL-3.0-or-later
import { Link } from 'react-router';
import { Layers, Clock, ArrowRight } from 'lucide-react';
import type { AgentSummary } from '@shared/schemas';
import { t } from '@shared/i18n';
import { formatRelative } from '@shared/lib/time';
import { agentMeta } from './agent-meta';
import { AgentGlyph } from './AgentGlyph';
import { AgentStatusBadge } from './AgentStatusBadge';
import { Card } from './Card';
import { VersionTag } from './VersionTag';
import { Tooltip } from './Tooltip';

/**
 * The agent card. Installed agents are full-color, clickable, and carry the
 * agent's brand hue on a left rail; not-installed agents get a dashed, muted,
 * non-clickable treatment with an install hint — so "which agents are here"
 * reads in a glance. Versions are explicitly labelled (Adapter vs Agent) and
 * the artifact count is spelled out instead of a bare "· 3".
 */
export function AgentCard({ agent, href }: { agent: AgentSummary; href: string }) {
  const meta = agentMeta(agent.name);
  const installed = agent.installed !== false;

  if (!installed) {
    return (
      <Card muted accentHue={meta.hue} className="h-full">
        <div className="flex h-full flex-col p-4 pl-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <AgentGlyph id={agent.name} muted />
              <div>
                <p className="font-medium text-muted-foreground">{meta.name}</p>
                <p className="text-xs text-faint">{meta.blurb}</p>
              </div>
            </div>
            <AgentStatusBadge installed={false} syncState={agent.syncState} />
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-faint">
            {t('agents.installHint', { name: meta.name })}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Link to={href} className="group block h-full rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card interactive accentHue={meta.hue} className="h-full">
        <div className="flex h-full flex-col gap-3 p-4 pl-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <AgentGlyph id={agent.name} />
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{meta.name}</p>
                <p className="truncate text-xs text-faint">{meta.blurb}</p>
              </div>
            </div>
            <AgentStatusBadge installed syncState={agent.syncState} />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <Tooltip label={t('agents.artifactsTip')}>
              <span className="inline-flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-faint" aria-hidden="true" />
                <span className="font-mono text-foreground">{agent.artifactCount ?? 0}</span>
                <span>{t('agents.artifacts')}</span>
              </span>
            </Tooltip>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-faint" aria-hidden="true" />
              <span>{formatRelative(agent.lastActivity)}</span>
            </span>
          </div>

          <div className="mt-auto flex items-end justify-between gap-2 pt-1">
            <div className="flex flex-wrap gap-1.5">
              <VersionTag
                label={t('agents.adapterVersion')}
                value={agent.version}
                tip={t('agents.adapterVersionTip')}
              />
              <VersionTag
                label={t('agents.agentVersion')}
                value={null}
                tip={t('agents.agentVersionTip')}
              />
            </div>
            <ArrowRight
              className="h-4 w-4 shrink-0 translate-y-[-2px] text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
              aria-hidden="true"
            />
          </div>
        </div>
      </Card>
    </Link>
  );
}
