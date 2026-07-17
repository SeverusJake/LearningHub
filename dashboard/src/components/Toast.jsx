import { useAppState } from '../context/AppStateContext.jsx';

export default function ToastStack() {
  const { toasts } = useAppState();
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2.5">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto relative min-w-[230px] max-w-[350px] overflow-hidden border border-bord border-l-2 border-l-accent bg-s1 px-4 py-3 shadow-xl ${
            t.leaving ? 'toast-leave' : 'toast-enter'
          }`}
        >
          <p className="text-[13px] text-tp">{t.message}</p>
          <span className="toast-bar absolute bottom-0 left-0 h-[2px] bg-accent/60" />
        </div>
      ))}
    </div>
  );
}
