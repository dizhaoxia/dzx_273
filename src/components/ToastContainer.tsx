import { Info, CheckCircle, AlertTriangle, XCircle, X } from 'lucide-react';
import type { Toast, ToastType } from '../types';

const toastStyles: Record<ToastType, { bg: string; icon: typeof Info; border: string }> = {
  info: { bg: 'bg-slate-800', icon: Info, border: 'border-blue-500' },
  success: { bg: 'bg-slate-800', icon: CheckCircle, border: 'border-success' },
  warning: { bg: 'bg-slate-800', icon: AlertTriangle, border: 'border-amber-500' },
  error: { bg: 'bg-slate-800', icon: XCircle, border: 'border-red-500' },
};

const iconColors: Record<ToastType, string> = {
  info: 'text-blue-400',
  success: 'text-success',
  warning: 'text-amber-400',
  error: 'text-red-400',
};

interface ToastContainerProps {
  toasts: Toast[];
  setToasts: React.Dispatch<React.SetStateAction<Toast[]>>;
}

export function ToastContainer({ toasts, setToasts }: ToastContainerProps) {
  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => {
        const style = toastStyles[toast.type];
        const Icon = style.icon;

        return (
          <div
            key={toast.id}
            className={`toast-enter pointer-events-auto ${style.bg} ${style.border} border-l-4 text-white px-4 py-3 rounded shadow-xl flex items-center gap-3 min-w-[280px] max-w-sm`}
          >
            <Icon size={18} className={iconColors[toast.type]} />
            <span className="text-sm flex-1">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default ToastContainer;
