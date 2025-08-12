import { useEffect, useRef } from 'react';

interface ModalProps {
  open: boolean;
  message: string;
  onClose: () => void;
  actionText?: string;
}

export function Modal({ open, message, onClose, actionText = 'OK' }: ModalProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const lastActiveRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      lastActiveRef.current = document.activeElement as HTMLElement;
      buttonRef.current?.focus();
      const handler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        } else if (e.key === 'Tab') {
          e.preventDefault();
          buttonRef.current?.focus();
        }
      };
      document.addEventListener('keydown', handler);
      return () => document.removeEventListener('keydown', handler);
    }
    return undefined;
  }, [open, onClose]);

  useEffect(() => {
    if (!open && lastActiveRef.current) {
      lastActiveRef.current.focus();
      lastActiveRef.current = null;
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="custom-modal open" role="dialog" aria-modal="true" aria-labelledby="custom-modal-message">
      <div className="custom-modal-content" role="document">
        <p id="custom-modal-message">{message}</p>
        <button ref={buttonRef} className="custom-modal-button" aria-label="Close dialog" onClick={onClose}>
          {actionText}
        </button>
      </div>
    </div>
  );
}

export default Modal;

