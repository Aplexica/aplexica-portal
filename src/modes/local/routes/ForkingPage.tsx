// SPDX-License-Identifier: AGPL-3.0-or-later
import { useDeferredValue, useMemo, useState } from 'react';
import { Check, Clock, GitBranch, MessageSquare, Search } from 'lucide-react';
import { t } from '@shared/i18n';
import { EmptyState } from '@shared/components/EmptyState';
import { Loading } from '@shared/components/Loading';
import { Badge } from '@shared/components/ui';
import type { ConversationSummary } from '@shared/schemas';
import { useConversations } from '../hooks/useConversations';
import { formatTimestamp } from '../lib/format';
import { ConversationBranchesPanel } from './ConversationBranchesPanel';

const CONVERSATION_LIMIT = 12;

export default function ForkingPage() {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const conversations = useConversations(deferredSearch, CONVERSATION_LIMIT);
  const [selectedId, setSelectedId] = useState('');

  const rows = useMemo(
    () => conversations.data?.conversations ?? [],
    [conversations.data?.conversations],
  );
  const isSearching = deferredSearch.trim().length > 0;

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">{t('forking.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('forking.subtitle')}</p>
      </header>

      <section className="rounded-md border border-border bg-background p-4">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('forking.searchLabel')}
          <span className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('forking.searchPlaceholder')}
              className="w-full rounded-md border border-border bg-background py-2 pl-8 pr-3 text-sm text-foreground"
            />
          </span>
        </label>
      </section>

      <section className="min-w-0 rounded-md border border-border bg-background">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            {isSearching ? t('forking.resultsTitle') : t('forking.recentTitle')}
          </h2>
          {conversations.isFetching ? <span className="text-xs text-faint">{t('app.loading')}</span> : null}
        </div>

        {conversations.error ? (
          <div className="p-4 text-sm text-destructive">
            {conversations.error instanceof Error ? conversations.error.message : t('forking.loadError')}
          </div>
        ) : conversations.isLoading ? (
          <div className="p-4">
            <Loading />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title={isSearching ? t('forking.noResults') : t('forking.noConversations')}
            body={isSearching ? t('forking.noResultsBody') : t('forking.noConversationsBody')}
          />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => {
              const selected = row.artifactId === selectedId;
              return (
                <li key={row.artifactId}>
                  <ConversationRow
                    conversation={row}
                    selected={selected}
                    onSelect={() => setSelectedId(row.artifactId)}
                  />
                  {selected ? (
                    <div className="border-t border-border bg-muted/10 px-4 py-4">
                      <SelectedConversation conversation={row} />
                      <div className="mt-3">
                        <ConversationBranchesPanel artifactId={row.artifactId} />
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function ConversationRow({
  conversation,
  selected,
  onSelect,
}: {
  conversation: ConversationSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
    >
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-faint">
        {selected ? <Check className="h-3.5 w-3.5 text-accent" aria-hidden="true" /> : <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          {conversation.sourceAgent ? <Badge tone="outline">{conversation.sourceAgent}</Badge> : null}
          <span className="truncate text-sm font-medium text-foreground">{conversation.title}</span>
        </span>
        {conversation.description ? (
          <span className="mt-1 block truncate text-sm text-muted-foreground">{conversation.description}</span>
        ) : null}
        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
          <span className="font-mono">{conversation.artifactId}</span>
          <span>{t('forking.meta.turns', { count: conversation.turnCount })}</span>
          <span>{t('forking.meta.branches', { count: conversation.branchCount })}</span>
          {conversation.updatedAt ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {formatTimestamp(conversation.updatedAt)}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}

function SelectedConversation({ conversation }: { conversation: ConversationSummary }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('forking.selected')}
        </span>
        {conversation.sourceAgent ? <Badge tone="outline">{conversation.sourceAgent}</Badge> : null}
      </div>
      <p className="mt-1 truncate text-sm font-medium text-foreground">{conversation.title}</p>
      <p className="mt-1 font-mono text-xs text-faint">{conversation.artifactId}</p>
    </div>
  );
}
