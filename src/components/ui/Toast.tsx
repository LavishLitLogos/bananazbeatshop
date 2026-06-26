import { useApp } from '../../context/AppContext';

export function ToastContainer() {
  const { toasts } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast px-4 py-2.5 rounded-xl text-sm font-medium shadow-xl border pointer-events-auto ${
            t.type === 'success'
              ? 'bg-green-900/90 border-green-700 text-green-100'
              : t.type === 'error'
              ? 'bg-red-900/90 border-red-700 text-red-100'
              : 'bg-[#1a1a1a]/95 border-[#333] text-white'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
