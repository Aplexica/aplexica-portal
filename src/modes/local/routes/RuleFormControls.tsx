// SPDX-License-Identifier: AGPL-3.0-or-later
import { Controller, type Control } from 'react-hook-form';
import { t } from '@shared/i18n';
import { CheckboxGroup, TagInput, agentMeta } from '@shared/components/ui';
import { AGENT_ORIGINATING, type RuleFormValues } from '@shared/schemas';
import type { AgentSummary } from '@shared/schemas';

// Fixed artifact-type set the daemon matches on (Match.type). Mirrors the
// Canonical artifact kinds; no selection matches every type.
const ARTIFACT_TYPES = ['memory', 'skill', 'tool', 'conversation'] as const;

// Predefined chip suggestions. Tags are open-ended, so these are hints,
// not an exhaustive enum — free-text entry is still allowed.
const MATCH_TAG_SUGGESTIONS = ['private', 'secret', 'fork-of:*'];
const ASSIGN_TAG_SUGGESTIONS = ['shared', 'team'];

/**
 * The three richer rule-form controls shared between the add form
 * (RulesPage) and the edit form (RuleDetailPage): an artifact-type
 * checkbox group, two tag-chip inputs (match / assign), and an
 * installed-agent multi-select. All wired through react-hook-form's
 * Controller because they are custom controlled inputs, not register()d.
 */
export function RuleFormControls({
  control,
  agents,
}: {
  control: Control<RuleFormValues>;
  /** Agents discovered on this device (from useAgents). */
  agents: AgentSummary[] | undefined;
}) {
  // Only installed agents are routable targets. Each maps to its display
  // name; the originating-agent sentinel is offered as an extra option.
  const agentOptions = [
    ...(agents ?? [])
      .filter((a) => a.installed !== false)
      .map((a) => ({ value: a.name, label: agentMeta(a.name).name })),
    { value: AGENT_ORIGINATING, label: t('rules.form.agentsOriginating') },
  ];

  return (
    <>
      <fieldset className="flex flex-col gap-1 text-sm">
        <legend className="mb-1">{t('rules.form.typesLabel')}</legend>
        <Controller
          name="types"
          control={control}
          render={({ field }) => (
            <CheckboxGroup
              ariaLabel={t('rules.form.typesLabel')}
              options={ARTIFACT_TYPES.map((v) => ({ value: v, label: v }))}
              value={field.value ?? []}
              onChange={field.onChange}
            />
          )}
        />
        <span className="mt-1 text-xs text-muted-foreground">{t('rules.form.typesHint')}</span>
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">
        <span>{t('rules.form.matchTagsLabel')}</span>
        <Controller
          name="matchTags"
          control={control}
          render={({ field }) => (
            <TagInput
              ariaLabel={t('rules.form.matchTagsLabel')}
              placeholder={t('rules.form.matchTagsPlaceholder')}
              suggestions={MATCH_TAG_SUGGESTIONS}
              value={field.value ?? []}
              onChange={field.onChange}
            />
          )}
        />
      </label>

      <fieldset className="flex flex-col gap-1 text-sm">
        <legend className="mb-1">{t('rules.form.agentsLabel')}</legend>
        <Controller
          name="agents"
          control={control}
          render={({ field }) => (
            <CheckboxGroup
              ariaLabel={t('rules.form.agentsLabel')}
              options={agentOptions}
              value={field.value ?? []}
              onChange={field.onChange}
            />
          )}
        />
        <span className="mt-1 text-xs text-muted-foreground">{t('rules.form.agentsHint')}</span>
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">
        <span>{t('rules.form.tagsLabel')}</span>
        <Controller
          name="assignTags"
          control={control}
          render={({ field }) => (
            <TagInput
              ariaLabel={t('rules.form.tagsLabel')}
              placeholder={t('rules.form.tagsPlaceholder')}
              suggestions={ASSIGN_TAG_SUGGESTIONS}
              value={field.value ?? []}
              onChange={field.onChange}
            />
          )}
        />
      </label>
    </>
  );
}
