'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { Conversation } from '@aurora/core';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

export function ConversationItem(props: {
  c: Conversation; active: boolean;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onNavigate: () => void;
}) {
  const { c } = props;
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.title);
  const [confirm, setConfirm] = useState(false);

  const save = async () => {
    await props.onRename(c.id, draft);
    setEditing(false); setMenu(false);
  };

  return (
    <li className={`rounded-lg ${props.active ? 'bg-surface2' : ''}`}>
      {editing ? (
        <form className="flex gap-1 p-1" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <label className="sr-only" htmlFor={`rename-${c.id}`}>Conversation title</label>
          <input
            id={`rename-${c.id}`} className="field" value={draft} maxLength={120} autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { setEditing(false); setMenu(false); } }}
          />
          <button type="submit" className="btn-primary">Save</button>
        </form>
      ) : (
        <div className="flex items-center">
          <Link
            href={`/chat/?c=${c.id}`} onClick={props.onNavigate}
            aria-current={props.active ? 'page' : undefined}
            className="min-h-[44px] flex-1 truncate rounded-lg px-3 py-2.5 text-sm hover:bg-surface2"
          >
            {c.title}
          </Link>
          <button
            type="button" className="btn-ghost" aria-label={`Options for ${c.title}`}
            aria-expanded={menu} onClick={() => setMenu((m) => !m)}
          >⋯</button>
        </div>
      )}
      {menu && !editing && (
        <div className="flex gap-2 px-2 pb-2">
          <button type="button" className="btn flex-1" onClick={() => { setDraft(c.title); setEditing(true); }}>Rename</button>
          <button type="button" className="btn-danger flex-1" onClick={() => setConfirm(true)}>Delete</button>
        </div>
      )}
      <ConfirmDialog
        open={confirm} title="Delete this conversation?" confirmLabel="Delete" danger
        onCancel={() => setConfirm(false)}
        onConfirm={async () => { setConfirm(false); await props.onDelete(c.id); }}
      >
        “{c.title}” and all of its messages will be permanently deleted from this browser. This cannot be undone.
      </ConfirmDialog>
    </li>
  );
}
