// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { ConversationSearchResponseSchema } from './conversations';

describe('conversation search schemas', () => {
  it('parses searchable conversation summaries', () => {
    const out = ConversationSearchResponseSchema.parse({
      query: 'luna',
      conversations: [{
        artifactId: '019f',
        title: 'What is the luna size?',
        sourceAgent: 'claude-code',
        updatedAt: '2026-07-06T12:00:00Z',
        turnCount: 2,
        branchCount: 1,
      }],
    });

    expect(out.conversations[0].materializedIn).toEqual([]);
    expect(out.conversations[0].title).toBe('What is the luna size?');
  });
});
