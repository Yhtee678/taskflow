import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
export function AccountMenu({
  id,
  name,
  initials,
  busy,
  onEdit,
  onSignOut,
}: {
  id: string;
  name: string;
  initials: string;
  busy: boolean;
  onEdit: () => void;
  onSignOut: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const firstFocus = useRef(0);
  useEffect(() => {
    if (open) items.current[firstFocus.current]?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return (
    <div
      className="account-menu"
      ref={root}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.preventDefault();
          e.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
          e.preventDefault();
          if (!open) {
            firstFocus.current = e.key === 'ArrowUp' || e.key === 'End' ? 1 : 0;
            setOpen(true);
            return;
          }
          const current = items.current.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          const index =
            e.key === 'Home'
              ? 0
              : e.key === 'End'
                ? 1
                : (current + (e.key === 'ArrowDown' ? 1 : -1) + 2) % 2;
          items.current[index]?.focus();
        }
      }}
    >
      <button
        type="button"
        ref={trigger}
        className="account-trigger"
        aria-label={`Account: ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          firstFocus.current = 0;
          setOpen(!open);
        }}
      >
        <span className="avatar" aria-hidden="true">
          {initials}
        </span>
        <strong>{name}</strong>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div
          id={id}
          role="menu"
          aria-label="Account options"
          className="account-options"
        >
          <button
            ref={(el) => {
              items.current[0] = el;
            }}
            role="menuitem"
            tabIndex={-1}
            type="button"
            onClick={() => {
              setOpen(false);
              trigger.current?.focus();
              onEdit();
            }}
          >
            Edit display name
          </button>
          <button
            ref={(el) => {
              items.current[1] = el;
            }}
            role="menuitem"
            tabIndex={-1}
            type="button"
            disabled={busy}
            onClick={() => {
              setOpen(false);
              trigger.current?.focus();
              void onSignOut();
            }}
          >
            {busy ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  );
}
