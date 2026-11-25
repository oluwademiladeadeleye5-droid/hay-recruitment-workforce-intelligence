import React from 'react';
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react';
import { useWorkforce } from '../context/WorkforceContext';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useWorkforce();
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0 no-print"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const icon =
          t.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-[#00A859] dark:text-[#10B981] shrink-0 mt-0.5" />
          ) : t.type === 'warning' ? (
            <AlertTriangle className="w-4 h-4 text-[#D97706] dark:text-[#FBBF24] shrink-0 mt-0.5" />
          ) : t.type === 'error' ? (
            <XCircle className="w-4 h-4 text-[#E11D48] dark:text-[#FB7185] shrink-0 mt-0.5" />
          ) : (
            <Info className="w-4 h-4 text-[#533AFD] dark:text-[#7C6BFF] shrink-0 mt-0.5" />
          );

        return (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl bg-white dark:bg-[#0F2035] border border-[#E2E8F0] dark:border-[#1E3A5F] shadow-lg text-[#0A2540] dark:text-[#F8FAFC] transition-all duration-150"
          >
            {icon}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-snug">{t.title}</p>
              {t.detail && (
                <p className="text-xs text-[#425466] dark:text-slate-300 mt-0.5 leading-relaxed">
                  {t.detail}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              aria-label="Dismiss notification"
              className="p-1 rounded-md text-slate-400 hover:text-[#0A2540] dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
