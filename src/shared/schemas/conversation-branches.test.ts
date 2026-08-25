// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  ConversationBranchMutationResponseSchema,
  ConversationBranchesResponseSchema,
  ConversationForkRequestSchema,
} from './conversation-branches';

describe('conversation branch schemas', () => {
  it('parses branch responses and defaults missing materialized agents', () => {
    const got = ConversationBranchesResponseSchema.parse({
      artifactId: '019f',
      branches: [
        { name: 'main', eventCount: 2 },
        { name: 'review', eventCount: 1, materializedAgents: null },
      ],
    });
    expect(got.branches[0].materializedAgents).toEqual([]);
    expect(got.branches[1].materializedAgents).toEqual([]);
  });

  it('validates fork requests', () => {
    expect(ConversationForkRequestSchema.safeParse({ fromEventId: '', targetAgent: 'codex' }).success).toBe(false);
    expect(ConversationForkRequestSchema.parse({ fromEventId: 'evt-1', targetAgent: 'codex' })).toEqual({
      fromEventId: 'evt-1',
      targetAgent: 'codex',
    });
  });

  it('parses mutation warnings without treating them as failures', () => {
    const got = ConversationBranchMutationResponseSchema.parse({
      artifactId: '019f',
      branch: 'review',
      agent: 'codex',
      materialized: false,
      warning: 'agent is idle',
      operation: 'fork',
      createdBranch: true,
    });
    expect(got.warning).toBe('agent is idle');
  });
});
