// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, beforeEach } from 'vitest';
import { useSidebar } from './sidebar';

describe('useSidebar', () => {
  beforeEach(() => useSidebar.setState({ collapsed: false }));

  it('toggles collapsed state', () => {
    expect(useSidebar.getState().collapsed).toBe(false);
    useSidebar.getState().toggle();
    expect(useSidebar.getState().collapsed).toBe(true);
  });

  it('persists collapsed preference to localStorage', () => {
    useSidebar.getState().setCollapsed(true);
    expect(localStorage.getItem('aplx_sidebar_collapsed')).toBe('1');
  });
});
