'use client';
import { useEffect, useRef, type ReactNode } from 'react';

/** Uses the native <dialog>: focus trap, Escape to close, focus restore. */
export function ConfirmDialog(props: {
  open: boolean; title: string; children: ReactNode; confirmLabel: string;
  danger?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (props.open && !d.open) d.showModal();
    if (!props.open && d.open) d.close();
  }, [props.open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby="dlg-title"
      onCancel={(e) => { e.preventDefault(); props.onCancel(); }}
      className="m-auto w-[min(92vw,26rem)] rounded-2xl border border-line-strong bg-bg p-5 text-fg backdrop:bg-black/50"
    >
      <h2 id="dlg-title" className="text-lg font-semibold">{props.title}</h2>
      <div className="mt-2 text-sm text-muted">{props.children}</div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn" onClick={props.onCancel} autoFocus>Cancel</button>
        <button type="button" className={props.danger ? 'btn-danger' : 'btn-primary'} onClick={props.onConfirm}>
          {props.confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
