import { useToasts } from '@/lib/feedback';

/** Announced toasts near the status bar. */
export function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((x) => (
        <div className="toast" key={x.id}>
          {x.message}
        </div>
      ))}
    </div>
  );
}
