'use client';

import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, LogOut, MoreHorizontal, Pencil, Plus, Settings, Trash2, X } from 'lucide-react';

import { getSupabaseBrowserClient } from '../../lib/supabase/client';
import type { WorkspaceSummary } from './WorkspaceScreen';

type PersistenceStatus = 'local-only' | 'loading' | 'ready' | 'saving' | 'saved' | 'error';

type TopNavigationProps = {
  persistenceStatus: PersistenceStatus;
  persistenceError?: string | null;
  currentStep: number;
  onStepClick: (step: number) => void;
  workspaceId?: string;
  workspaceName: string;
  workspaces: WorkspaceSummary[];
  userEmail: string;
  userAvatarUrl?: string;
};

const MAX_WORKSPACES = 3;

const STEPS = [
  { id: 1, label: 'BRAINSTORMING' },
  { id: 2, label: 'PLATFORM' },
  { id: 3, label: 'GENERATING' },
];

function SyncDot({ status }: { status: PersistenceStatus }) {
  if (status === 'saved' || status === 'local-only' || status === 'ready') return null;

  return (
    <span
      className={[
        'inline-block size-1.5 flex-shrink-0 rounded-full',
        status === 'error' ? 'bg-red-500' : 'bg-amber-400 animate-pulse',
      ].join(' ')}
    />
  );
}

function WorkspaceSwitcher({
  currentWorkspaceId,
  currentWorkspaceName,
  initialWorkspaces,
  persistenceStatus,
  persistenceError,
}: {
  currentWorkspaceId?: string;
  currentWorkspaceName: string;
  initialWorkspaces: WorkspaceSummary[];
  persistenceStatus: PersistenceStatus;
  persistenceError?: string | null;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const portalMenuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState(initialWorkspaces);

  // Inline rename
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Inline delete confirmation (replaces window.confirm)
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // New workspace inline form
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');

  // Portal-based 3-dot menu (avoids overflow-hidden clipping)
  const [menuWsId, setMenuWsId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const [error, setError] = useState<string | null>(null);

  const displayedName =
    workspaces.find((w) => w.id === currentWorkspaceId)?.name ?? currentWorkspaceName;

  const atLimit = workspaces.length >= MAX_WORKSPACES;

  // Capture-phase listener so it fires before ReactFlow (or any other library)
  // can call stopPropagation() and swallow the event on the canvas.
  useEffect(() => {
    if (!isOpen) return;

    function handleOutside(e: MouseEvent) {
      const inContainer = containerRef.current?.contains(e.target as Node);
      const inPortalMenu = portalMenuRef.current?.contains(e.target as Node);
      if (!inContainer && !inPortalMenu) {
        setIsOpen(false);
        setMenuWsId(null);
      }
    }

    document.addEventListener('mousedown', handleOutside, { capture: true });
    return () => document.removeEventListener('mousedown', handleOutside, { capture: true });
  }, [isOpen]);

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  const openMenu = (wsId: string, buttonEl: HTMLElement) => {
    const rect = buttonEl.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, left: rect.left });
    setMenuWsId(wsId);
  };

  const startRename = (ws: WorkspaceSummary) => {
    setRenamingId(ws.id);
    setRenameValue(ws.name);
    setMenuWsId(null);
    setDeletingId(null);
  };

  const confirmRename = useCallback(
    async (id: string) => {
      const trimmed = renameValue.trim();
      const original = workspaces.find((w) => w.id === id)?.name;
      if (!trimmed || trimmed === original) { setRenamingId(null); return; }

      setWorkspaces((prev) => prev.map((w) => (w.id === id ? { ...w, name: trimmed } : w)));
      setRenamingId(null);
      setError(null);

      try {
        const res = await fetch(`/api/workspaces/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed }),
        });
        if (!res.ok) {
          const json = (await res.json()) as { error?: string };
          throw new Error(json.error ?? 'Rename failed');
        }
      } catch (err) {
        if (original) setWorkspaces((prev) => prev.map((w) => (w.id === id ? { ...w, name: original } : w)));
        setError(err instanceof Error ? err.message : 'Rename failed');
      }
    },
    [renameValue, workspaces],
  );

  const requestDelete = (wsId: string) => {
    setDeletingId(wsId);
    setMenuWsId(null);
  };

  const confirmDelete = useCallback(
    async (id: string) => {
      const removed = workspaces.find((w) => w.id === id);
      setWorkspaces((prev) => prev.filter((w) => w.id !== id));
      setDeletingId(null);
      setError(null);

      try {
        const res = await fetch(`/api/workspaces/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          const json = (await res.json()) as { error?: string };
          throw new Error(json.error ?? 'Delete failed');
        }
        if (id === currentWorkspaceId) {
          const remaining = workspaces.filter((w) => w.id !== id);
          router.push(remaining.length > 0 ? `/workspace/${remaining[0].id}` : '/');
        }
      } catch (err) {
        if (removed) {
          setWorkspaces((prev) =>
            [...prev, removed].sort((a, b) => a.created_at.localeCompare(b.created_at)),
          );
        }
        setError(err instanceof Error ? err.message : 'Delete failed');
      }
    },
    [workspaces, currentWorkspaceId, router],
  );

  const createWorkspace = useCallback(async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    setError(null);
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const json = (await res.json()) as { workspace?: WorkspaceSummary; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Create failed');

      setWorkspaces((prev) => [...prev, json.workspace!]);
      setNewName('');
      setIsCreating(false);
      router.push(`/workspace/${json.workspace!.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    }
  }, [newName, router]);

  return (
    <>
      {/* Morphing pill → panel — single element, no separate dropdown panel.
          Uses explicit width (not min-width) so the container never grows wider
          than its target. rounded-3xl (~24px) instead of rounded-full avoids the
          "nearly circular" artifact during the border-radius transition. */}
      <div
        ref={containerRef}
        style={{ width: isOpen ? '17rem' : '10rem' }}
        className={[
          'overflow-hidden transition-all duration-300 ease-out',
          'border backdrop-blur-xl',
          isOpen
            ? 'rounded-2xl bg-white/95 border-slate-200/70 shadow-[0_20px_56px_-12px_rgba(15,23,42,0.25)]'
            : 'rounded-3xl bg-slate-900/10 border-white/20 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)]',
        ].join(' ')}
      >
        {/* Header row — always visible, looks like the pill when closed */}
        <button
          onClick={() => {
            setIsOpen((v) => !v);
            setMenuWsId(null);
          }}
          title={persistenceError ?? displayedName}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] font-bold tracking-[0.10em] text-slate-600 transition-colors hover:text-slate-900"
        >
          <SyncDot status={persistenceStatus} />
          <span className="truncate">{displayedName}</span>
          <ChevronDown
            size={10}
            className={[
              'ml-auto flex-shrink-0 transition-transform duration-300',
              isOpen ? 'rotate-180' : '',
            ].join(' ')}
          />
        </button>

        {/* Collapsible body */}
        <div
          className={[
            'transition-[max-height] duration-300 ease-out overflow-hidden',
            isOpen ? 'max-h-80' : 'max-h-0',
          ].join(' ')}
        >
          {/* Separator + breathing room between the pill row and the list */}
          <div className="mx-3 border-t border-slate-100 pt-2" />

          {error && (
            <p className="mx-2 mb-1 rounded-xl bg-red-50 px-3 py-2 text-[11px] text-red-600">
              {error}
            </p>
          )}

          <div className="px-2 pb-1">
            {workspaces.map((ws) => (
              <div key={ws.id}>
                {renamingId === ws.id ? (
                  <form
                    className="flex items-center gap-1 rounded-xl px-2 py-1.5"
                    onSubmit={(e) => { e.preventDefault(); void confirmRename(ws.id); }}
                  >
                    <input
                      ref={renameInputRef}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Escape' && setRenamingId(null)}
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-900 outline-none focus:border-slate-400"
                      maxLength={50}
                    />
                    <button type="submit" className="rounded-lg p-1 text-emerald-600 hover:bg-emerald-50">
                      <Check size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenamingId(null)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                    >
                      <X size={12} />
                    </button>
                  </form>
                ) : deletingId === ws.id ? (
                  <div className="flex items-center gap-2 rounded-xl px-2 py-1.5">
                    <span className="flex-1 truncate text-[11px] text-slate-500">
                      Delete{' '}
                      <span className="font-semibold text-slate-800">{ws.name}</span>?
                    </span>
                    <button
                      onClick={() => void confirmDelete(ws.id)}
                      className="rounded-lg bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-red-600"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      className="rounded-lg px-2 py-0.5 text-[10px] font-bold text-slate-400 hover:text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="group flex items-center gap-1 rounded-xl px-2 py-1.5 hover:bg-slate-50">
                    <button
                      onClick={() => {
                        if (ws.id !== currentWorkspaceId) router.push(`/workspace/${ws.id}`);
                        setIsOpen(false);
                        setMenuWsId(null);
                      }}
                      className="flex flex-1 items-center gap-1.5 truncate text-left text-xs font-medium text-slate-600 hover:text-slate-900"
                    >
                      {ws.id === currentWorkspaceId && (
                        <span className="inline-block size-1.5 flex-shrink-0 rounded-full bg-slate-900" />
                      )}
                      <span className="truncate">{ws.name}</span>
                    </button>

                    <button
                      onClick={(e) => openMenu(ws.id, e.currentTarget)}
                      className="rounded-lg p-1 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-600"
                    >
                      <MoreHorizontal size={13} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 p-2">
            {isCreating ? (
              <form
                className="flex items-center gap-1"
                onSubmit={(e) => { e.preventDefault(); void createWorkspace(); }}
              >
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { setIsCreating(false); setNewName(''); }
                  }}
                  placeholder="Workspace name…"
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 outline-none focus:border-slate-400"
                  maxLength={50}
                />
                <button
                  type="submit"
                  disabled={!newName.trim()}
                  className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
                >
                  <Check size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => { setIsCreating(false); setNewName(''); }}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                >
                  <X size={12} />
                </button>
              </form>
            ) : (
              <button
                onClick={() => !atLimit && setIsCreating(true)}
                disabled={atLimit}
                className={[
                  'flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition',
                  atLimit
                    ? 'cursor-not-allowed text-slate-300'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900',
                ].join(' ')}
              >
                <Plus size={12} />
                {atLimit ? `Limit of ${MAX_WORKSPACES} workspaces reached` : 'New workspace'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3-dot menu — portal so it's never clipped by overflow-hidden ancestors.
          No backdrop: the unified outside-click handler above closes it correctly. */}
      {menuWsId && menuPos && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={portalMenuRef}
            onMouseDown={(e) => e.stopPropagation()}
            style={{ top: menuPos.top, left: menuPos.left }}
            className="fixed z-[99] w-36 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
          >
            <button
              onMouseDown={() => {
                const ws = workspaces.find((w) => w.id === menuWsId);
                if (ws) startRename(ws);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              <Pencil size={11} />
              Rename
            </button>
            <button
              onMouseDown={() => {
                if (menuWsId) requestDelete(menuWsId);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"
            >
              <Trash2 size={11} />
              Delete
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}

function UserMenu({
  userEmail,
  userAvatarUrl,
}: {
  userEmail: string;
  userAvatarUrl?: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    if (!isOpen) return;

    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

  async function handleSignOut() {
    await supabase?.auth.signOut();
    router.push('/login');
  }

  const initial = userEmail.charAt(0).toUpperCase();

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        title={userEmail}
        className="flex size-8 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-slate-900/10 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] backdrop-blur-xl transition hover:border-slate-300 hover:bg-white/50"
      >
        {userAvatarUrl ? (
          <img
            src={userAvatarUrl}
            alt={userEmail}
            className="size-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="text-[11px] font-bold text-slate-600">{initial}</span>
        )}
      </button>

      <div
        className={[
          'absolute right-0 top-full mt-2 w-52 origin-top-right overflow-hidden rounded-2xl border border-white/30 bg-white/95 shadow-[0_24px_60px_-8px_rgba(15,23,42,0.22)] backdrop-blur-xl transition-all duration-200 ease-out',
          isOpen
            ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none -translate-y-1 scale-95 opacity-0',
        ].join(' ')}
      >
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="truncate text-[11px] font-medium text-slate-500">{userEmail}</p>
        </div>

        <div className="p-2">
          <button
            disabled
            className="flex w-full cursor-not-allowed items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-slate-300"
          >
            <Settings size={13} />
            Settings
            <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-slate-200">
              Soon
            </span>
          </button>
          <button
            onClick={() => void handleSignOut()}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-slate-600 transition hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

export function TopNavigation({
  persistenceStatus,
  persistenceError,
  currentStep,
  onStepClick,
  workspaceId,
  workspaceName,
  workspaces,
  userEmail,
  userAvatarUrl,
}: TopNavigationProps) {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-20 px-4 pt-4">
      {/* Fixed-height row so all three sections align to the same baseline */}
      <div className="relative flex h-9 items-center">
        {/* Left — self-start so the morphing container anchors at the top of the
            row and expands downward, never getting pushed upward by items-center */}
        <div className="pointer-events-auto self-start">
          <WorkspaceSwitcher
            currentWorkspaceId={workspaceId}
            currentWorkspaceName={workspaceName}
            initialWorkspaces={workspaces}
            persistenceStatus={persistenceStatus}
            persistenceError={persistenceError}
          />
        </div>

        {/* Centre — absolutely positioned so it's truly centered regardless of side widths */}
        <div className="pointer-events-auto absolute inset-y-0 left-1/2 flex -translate-x-1/2 items-center">
          <nav className="flex items-center gap-1 rounded-full border border-white/20 bg-slate-900/10 p-1 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] backdrop-blur-xl">
            {STEPS.map((step) => (
              <button
                key={step.id}
                onClick={() => onStepClick(step.id)}
                className={[
                  'rounded-full px-4 py-1.5 text-[10px] font-bold tracking-[0.12em] transition-all',
                  currentStep === step.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-white/50 hover:text-slate-900',
                ].join(' ')}
              >
                {step.id}. {step.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right — user avatar menu */}
        <div className="pointer-events-auto ml-auto">
          <UserMenu userEmail={userEmail} userAvatarUrl={userAvatarUrl} />
        </div>
      </div>
    </header>
  );
}
