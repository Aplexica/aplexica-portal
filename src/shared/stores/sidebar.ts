// SPDX-License-Identifier: AGPL-3.0-or-later
import { create } from 'zustand';

interface SidebarState {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (v: boolean) => void;
}

const KEY = 'aplx_sidebar_collapsed';

export const useSidebar = create<SidebarState>((set) => ({
  collapsed: typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === '1',
  toggle: () => set((s) => {
    const next = !s.collapsed;
    localStorage.setItem(KEY, next ? '1' : '0');
    return { collapsed: next };
  }),
  setCollapsed: (v) => {
    localStorage.setItem(KEY, v ? '1' : '0');
    set({ collapsed: v });
  },
}));
