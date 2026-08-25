// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  useLayoutEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@shared/lib/utils';

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface ModalDialogProps {
  labelledBy: string;
  describedBy?: string;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
  panelClassName?: string;
  children: ReactNode;
}

/**
 * Accessible modal surface shared by local-mode confirmation flows.
 *
 * Native `showModal()` supplies top-layer modality. Explicit background
 * inertness and a small focus loop keep the behavior deterministic in older
 * embedded browsers as well as current desktop engines.
 */
export function ModalDialog({
  labelledBy,
  describedBy,
  onClose,
  initialFocusRef,
  panelClassName,
  children,
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const invoker = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const background = Array.from(document.body.children)
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== dialog)
      .map((element) => ({
        element,
        hadInert: element.hasAttribute('inert'),
        ariaHidden: element.getAttribute('aria-hidden'),
      }));

    for (const { element } of background) {
      element.setAttribute('inert', '');
      element.setAttribute('aria-hidden', 'true');
    }

    try {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    } catch {
      // A narrow fallback for partial <dialog> implementations.
      dialog.setAttribute('open', '');
    }

    (initialFocusRef?.current ?? firstFocusable(dialog) ?? panelRef.current)?.focus({ preventScroll: true });

    return () => {
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');

      for (const { element, hadInert, ariaHidden } of background) {
        if (!hadInert) element.removeAttribute('inert');
        if (ariaHidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', ariaHidden);
      }

      if (invoker?.isConnected) invoker.focus({ preventScroll: true });
    };
  }, [initialFocusRef]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCloseRef.current();
      return;
    }
    if (event.key !== 'Tab') return;

    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = focusableElements(dialog);
    if (focusable.length === 0) {
      event.preventDefault();
      panelRef.current?.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !dialog.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <dialog
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className="fixed inset-0 z-50 m-0 hidden h-full max-h-none w-full max-w-none items-center justify-center border-0 bg-black/50 p-4 text-foreground open:flex"
      onCancel={(event) => {
        event.preventDefault();
        onCloseRef.current();
      }}
      onKeyDown={onKeyDown}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          'flex w-full max-w-md flex-col gap-4 rounded-md border border-border bg-background p-5 shadow-xl',
          panelClassName,
        )}
      >
        {children}
      </div>
    </dialog>,
    document.body,
  );
}

function focusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => isActuallyTabbable(element, root),
  );
}

function isActuallyTabbable(element: HTMLElement, root: HTMLElement): boolean {
  if (element.tabIndex < 0 || element.matches(':disabled')) return false;
  if (element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;

  let current: HTMLElement | null = element;
  while (current) {
    const style = window.getComputedStyle(current);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    if (current === root) break;
    current = current.parentElement;
  }

  const visibilityCandidate = element as HTMLElement & {
    checkVisibility?: (options?: { checkOpacity?: boolean; checkVisibilityCSS?: boolean }) => boolean;
  };
  return visibilityCandidate.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true }) ?? true;
}

function firstFocusable(root: HTMLElement): HTMLElement | null {
  return focusableElements(root)[0] ?? null;
}
