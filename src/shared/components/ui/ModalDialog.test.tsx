// SPDX-License-Identifier: AGPL-3.0-or-later
import { useRef, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ModalDialog } from './ModalDialog';

function DialogHarness() {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Restore backup</button>
      <button type="button">Background action</button>
      {open ? (
        <ModalDialog labelledBy="test-dialog-title" onClose={() => setOpen(false)} initialFocusRef={inputRef}>
          <h2 id="test-dialog-title">Confirm restore</h2>
          <input ref={inputRef} aria-label="Confirmation phrase" />
          <button type="button" onClick={() => setOpen(false)}>Cancel</button>
          <button type="button" onClick={() => setOpen(false)}>Confirm</button>
          <button type="button" hidden>Hidden trailing action</button>
          <button type="button" style={{ display: 'none' }}>CSS-hidden trailing action</button>
        </ModalDialog>
      ) : null}
    </>
  );
}

function openDialog() {
  const invoker = screen.getByRole('button', { name: 'Restore backup' });
  invoker.focus();
  fireEvent.click(invoker);
  return invoker;
}

describe('ModalDialog', () => {
  it('makes the background inert and wraps Tab in both directions', () => {
    const { container } = render(<DialogHarness />);
    openDialog();

    const input = screen.getByLabelText('Confirmation phrase');
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    const hidden = screen.getByText('Hidden trailing action');
    const cssHidden = screen.getByText('CSS-hidden trailing action');
    expect(input).toHaveFocus();
    expect(container).toHaveAttribute('inert');
    expect(container).toHaveAttribute('aria-hidden', 'true');

    fireEvent.keyDown(input, { key: 'Tab', shiftKey: true });
    expect(confirm).toHaveFocus();
    expect(hidden).not.toHaveFocus();
    expect(cssHidden).not.toHaveFocus();
    fireEvent.keyDown(confirm, { key: 'Tab' });
    expect(input).toHaveFocus();
    expect(cancel).not.toHaveFocus();
  });

  it('closes on Escape and restores focus to the invoker', () => {
    render(<DialogHarness />);
    const invoker = openDialog();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(invoker).toHaveFocus();
  });

  it.each(['Cancel', 'Confirm'])('restores focus to the invoker after %s closes it', (action) => {
    render(<DialogHarness />);
    const invoker = openDialog();

    fireEvent.click(screen.getByRole('button', { name: action }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(invoker).toHaveFocus();
  });
});
