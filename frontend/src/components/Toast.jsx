/**
 * Toast notification system.
 *
 * Usage:
 *   import { useToast } from '../components/Toast';
 *   const { toast } = useToast();
 *   toast.success('File deleted!');
 *   toast.error('Something went wrong');
 *   toast.info('Scan started');
 *   toast.warning('Drive almost full');
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

let _toastId = 0;

function ToastItem({ item, onDismiss }) {
  const { id, type, message, duration } = item;

  useEffect(() => {
    const t = setTimeout(() => onDismiss(id), duration);
    return () => clearTimeout(t);
  }, [id, duration, onDismiss]);

  const styles = {
    success: { bg: 'bg-green-900/90 border-green-700/60', icon: <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" /> },
    error:   { bg: 'bg-red-900/90 border-red-700/60',     icon: <XCircle     className="w-4 h-4 text-red-400   flex-shrink-0" /> },
    warning: { bg: 'bg-yellow-900/90 border-yellow-700/60', icon: <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" /> },
    info:    { bg: 'bg-slate-800/95 border-slate-600/60', icon: <Info         className="w-4 h-4 text-brand-400 flex-shrink-0" /> },
  };

  const s = styles[type] || styles.info;

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-sm text-sm text-white
        ${s.bg} animate-slide-in`}
      style={{ minWidth: 280, maxWidth: 400 }}
    >
      {s.icon}
      <p className="flex-1 leading-snug">{message}</p>
      <button
        onClick={() => onDismiss(id)}
        className="text-slate-400 hover:text-white transition-colors flex-shrink-0 mt-0.5"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback((type, message, duration = 4000) => {
    const id = ++_toastId;
    setToasts((prev) => [...prev.slice(-4), { id, type, message, duration }]);
    return id;
  }, []);

  const toast = {
    success: (msg, d) => add('success', msg, d),
    error:   (msg, d) => add('error',   msg, d || 6000),
    warning: (msg, d) => add('warning', msg, d),
    info:    (msg, d) => add('info',    msg, d),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Portal: fixed bottom-right stack */}
      <div
        aria-live="polite"
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((item) => (
          <div key={item.id} className="pointer-events-auto">
            <ToastItem item={item} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
