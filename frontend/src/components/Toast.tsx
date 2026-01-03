import { useEffect, useState } from 'react';
import type { FC } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose?: () => void;
}

export const Toast: FC<ToastProps> = ({
  message,
  type = 'info',
  duration = 5000,
  onClose,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible) return null;

  const icon =
    type === 'success'
      ? '✓'
      : type === 'error'
        ? '✕'
        : type === 'warning'
          ? '⚠'
          : 'ℹ';

  return (
    <div className={`toast toast--${type}`} role="alert">
      <div className="toast__icon">{icon}</div>
      <div className="toast__message">{message}</div>
      <button
        className="toast__close"
        type="button"
        onClick={onClose}
        aria-label="Close"
      >
        ×
      </button>
    </div>
  );
};

export default Toast;
