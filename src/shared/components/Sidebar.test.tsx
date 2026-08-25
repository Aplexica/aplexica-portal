// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { Sidebar, type NavEntry } from './Sidebar';

function renderSidebar(items: NavEntry[], initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Sidebar items={items} />
    </MemoryRouter>,
  );
}

describe('Sidebar nav badge', () => {
  it('renders a count badge with an aria-label when badge > 0', () => {
    renderSidebar([
      { to: '/pending', label: 'Pending projects', badge: 3, badgeAriaLabel: '3 pending projects' },
    ]);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByLabelText('3 pending projects')).toBeInTheDocument();
  });

  it('hides the badge when the count is 0', () => {
    renderSidebar([
      { to: '/pending', label: 'Pending projects', badge: 0, badgeAriaLabel: '0 pending projects' },
    ]);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('0 pending projects')).not.toBeInTheDocument();
  });

  it('omits the badge entirely when no badge is set', () => {
    const { container } = renderSidebar([{ to: '/help', label: 'Help' }]);
    expect(screen.getByText('Help')).toBeInTheDocument();
    expect(container.querySelector('[aria-label$="pending projects"]')).toBeNull();
  });
});

describe('Sidebar active state', () => {
  it('does not keep a parent item active when a child route is selected', () => {
    renderSidebar(
      [
        { to: '/settings', label: 'Settings', end: true },
        { to: '/settings/transport', label: 'Transport' },
      ],
      ['/settings/transport'],
    );

    expect(screen.getByRole('link', { name: 'Transport' })).toHaveClass('text-accent');
    expect(screen.getByRole('link', { name: 'Settings' })).not.toHaveClass('text-accent');
  });
});
