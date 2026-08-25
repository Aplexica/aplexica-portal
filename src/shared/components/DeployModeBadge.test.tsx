// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DeployModeBadge } from './DeployModeBadge';

describe('DeployModeBadge', () => {
  it('renders the Local pill with a healthy status', () => {
    const { container } = render(<DeployModeBadge />);
    expect(screen.getByText('Local')).toBeInTheDocument();
    expect(container.querySelector('.bg-success')).toBeInTheDocument();
  });
});
