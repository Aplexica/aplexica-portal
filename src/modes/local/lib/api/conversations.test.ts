// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, vi } from 'vitest';
import { listConversations } from './conversations';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('listConversations', () => {
  it('dedupes rows that point at the same source conversation path', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          conversations: [
            {
              artifactId: 'a-new',
              title: 'Largest planet',
              sourcePath: '/tmp/codex/session.jsonl',
              turnCount: 2,
              branchCount: 1,
            },
            {
              artifactId: 'a-old',
              title: 'Largest planet duplicate',
              sourcePath: '/tmp/codex/session.jsonl',
              turnCount: 2,
              branchCount: 1,
            },
            {
              artifactId: 'b',
              title: 'Different conversation',
              turnCount: 1,
              branchCount: 1,
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const got = await listConversations('', 25);

    expect(got.conversations.map((conversation) => conversation.artifactId)).toEqual([
      'a-new',
      'b',
    ]);
  });
});
