import { useContext, useEffect, useRef, type ReactNode } from 'react';
import { WorkspaceContext } from '@/app/workspace-context';
import { Button } from './button';
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const workspace = useContext(WorkspaceContext);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="editor-dialog"
      aria-label={title}
      onCancel={onClose}
    >
      <div className="dialog-header">
        <h2>{title}</h2>
        <Button
          variant="ghost"
          type="button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          Close
        </Button>
      </div>
      {workspace?.feedback?.error && (
        <p role="alert">{workspace.feedback.message}</p>
      )}
      {children}
    </dialog>
  );
}
