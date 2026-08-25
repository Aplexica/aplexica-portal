// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { ConflictSchema, ResolveRequestSchema } from './conflicts';

describe('ConflictSchema', () => {
  it('accepts optional readable analysis on detail responses', () => {
    const r = ConflictSchema.safeParse({
      artifactId: 'conversation-1.jsonl',
      title: 'What is the luna size?',
      description: 'The Moon is about 3,474 km in diameter.',
      kind: 'conversation',
      heads: [
        {
          sourceAgent: 'claude-code',
          eventId: 'event-a',
          contentSha256: 'abc123',
          absTimestamp: 1770000000,
          payloadPreview: '{"format":"acf.conversation.v1"}',
        },
      ],
      analysis: {
        summary: 'Visible conversation differs at turn 1.',
        recommendation: 'Review the highlighted turns.',
        autoResolvable: false,
        preferredHead: 'B',
        heads: [
          {
            label: 'A',
            sourceAgent: 'claude-code',
            summary: '2 visible turns',
            primaryText: 'user: what is my name?',
            payloadJson: '{\n  "format": "acf.conversation.v1"\n}',
          },
        ],
        differences: [
          {
            label: 'Turn 1',
            status: 'changed',
            headA: 'user: what is my name?',
            headB: "user: what is my dog's name?",
          },
        ],
      },
    });
    expect(r.success).toBe(true);
  });
});

describe('ResolveRequestSchema', () => {
  it('accepts accept-a without a manualBody', () => {
    const r = ResolveRequestSchema.safeParse({ action: 'accept-a' });
    expect(r.success).toBe(true);
  });

  it('accepts accept-b without a manualBody', () => {
    const r = ResolveRequestSchema.safeParse({ action: 'accept-b' });
    expect(r.success).toBe(true);
  });

  it('rejects manual without a manualBody', () => {
    const r = ResolveRequestSchema.safeParse({ action: 'manual' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].path).toEqual(['manualBody']);
    }
  });

  it('rejects manual with an empty manualBody', () => {
    const r = ResolveRequestSchema.safeParse({ action: 'manual', manualBody: '' });
    expect(r.success).toBe(false);
  });

  it('accepts manual with a non-empty manualBody', () => {
    const r = ResolveRequestSchema.safeParse({ action: 'manual', manualBody: '# merged' });
    expect(r.success).toBe(true);
  });

  it('rejects an unknown action', () => {
    const r = ResolveRequestSchema.safeParse({ action: 'ignore' });
    expect(r.success).toBe(false);
  });
});
