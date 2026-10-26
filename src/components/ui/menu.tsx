'use client';

import * as React from 'react';

import { cn } from '@/shared/lib/cn';

const MenuContext = React.createContext<{ close: () => void } | null>(null);

interface MenuProps {
  /** The trigger's accessible name: "Mais ações", "Ações de Padaria Real". */
  label: string;
  /** What the trigger shows. */
  trigger: React.ReactNode;
  triggerClassName?: string;
  /** Which edge of the trigger the menu lines up with. */
  align?: 'start' | 'end';
  children: React.ReactNode;
}

const GAP = 4;
const MARGIN = 8;

/**
 * A button that opens a short list of actions (WAI-ARIA menu button). The
 * list is a popover, so it sits in the top layer: no surrounding overflow
 * can clip it, and a click outside or Escape closes it. Arrow keys, Home
 * and End move between the items; closing puts focus back on the button.
 */
export function Menu({
  label,
  trigger,
  triggerClassName,
  align = 'end',
  children,
}: MenuProps) {
  const id = React.useId();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const focusOnOpen = React.useRef<'first' | 'last'>('first');
  const [open, setOpen] = React.useState(false);

  const items = React.useCallback(
    () => [
      ...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ??
        []),
    ],
    [],
  );

  React.useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    function place() {
      const button = triggerRef.current;
      if (!button || !menu) return;
      const rect = button.getBoundingClientRect();
      const { offsetHeight: height, offsetWidth: width } = menu;
      const fitsBelow =
        window.innerHeight - rect.bottom >= height + GAP + MARGIN;
      const top =
        fitsBelow || rect.top < height + GAP + MARGIN
          ? rect.bottom + GAP
          : rect.top - height - GAP;
      const left = align === 'end' ? rect.right - width : rect.left;
      menu.style.top = `${Math.max(MARGIN, top)}px`;
      menu.style.left = `${Math.min(
        Math.max(MARGIN, left),
        window.innerWidth - width - MARGIN,
      )}px`;
    }

    function onToggle(event: Event) {
      const isOpen = (event as ToggleEvent).newState === 'open';
      setOpen(isOpen);
      if (isOpen) {
        place();
        const list = items();
        (focusOnOpen.current === 'last' ? list.at(-1) : list[0])?.focus();
        focusOnOpen.current = 'first';
        return;
      }
      // Escape or a picked item leaves focus nowhere; a click elsewhere,
      // or a dialog an item opened, already moved it on purpose.
      const active = document.activeElement;
      if (!active || active === document.body || menu?.contains(active)) {
        triggerRef.current?.focus();
      }
    }

    menu.addEventListener('toggle', onToggle);
    return () => menu.removeEventListener('toggle', onToggle);
  }, [align, items]);

  // A fixed list would stay put while the page scrolls the button away.
  React.useEffect(() => {
    if (!open) return;
    const close = () => menuRef.current?.hidePopover();
    window.addEventListener('scroll', close, { capture: true, passive: true });
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, { capture: true });
      window.removeEventListener('resize', close);
    };
  }, [open]);

  function onMenuKeyDown(event: React.KeyboardEvent) {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    const move: Record<string, number | undefined> = {
      ArrowDown: (index + 1) % list.length,
      ArrowUp: (index - 1 + list.length) % list.length,
      Home: 0,
      End: list.length - 1,
    };
    const target = move[event.key];
    if (target !== undefined) {
      event.preventDefault();
      list[target]?.focus();
    } else if (event.key === 'Tab') {
      menuRef.current?.hidePopover();
    }
  }

  const context = React.useMemo(
    () => ({ close: () => menuRef.current?.hidePopover() }),
    [],
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => menuRef.current?.togglePopover()}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          focusOnOpen.current = event.key === 'ArrowUp' ? 'last' : 'first';
          menuRef.current?.showPopover();
        }}
        className={triggerClassName}
      >
        {trigger}
      </button>
      <div
        ref={menuRef}
        id={id}
        popover="auto"
        role="menu"
        aria-label={label}
        onKeyDown={onMenuKeyDown}
        className="popover-pop bg-popover text-popover-foreground [inset:auto] m-0 min-w-48 rounded-lg p-1 shadow-[var(--shadow-elevation)]"
      >
        <MenuContext.Provider value={context}>{children}</MenuContext.Provider>
      </div>
    </>
  );
}

const ITEM_CLASSES =
  'hover:bg-accent focus-visible:bg-accent flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none [&_svg]:text-muted-foreground';

interface MenuItemProps {
  children: React.ReactNode;
  /** Runs after the menu closes. */
  onSelect?: () => void;
  /** Makes the item a plain link, e.g. to a file download. */
  href?: string;
  destructive?: boolean;
}

export function MenuItem({
  children,
  onSelect,
  href,
  destructive,
}: MenuItemProps) {
  const menu = React.useContext(MenuContext);
  const className = cn(ITEM_CLASSES, destructive && 'text-destructive');

  if (href) {
    return (
      <a
        role="menuitem"
        tabIndex={-1}
        href={href}
        className={className}
        onClick={() => menu?.close()}
      >
        {children}
      </a>
    );
  }
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      className={className}
      onClick={() => {
        menu?.close();
        onSelect?.();
      }}
    >
      {children}
    </button>
  );
}
