'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, LogOut, LayoutDashboard } from 'lucide-react';

import { getSupabaseBrowserClient } from '../lib/supabase/client';

type Workspace = {
  id: string;
  name: string;
  created_at: string;
};

type Props = {
  workspaces: Workspace[];
  userEmail: string;
};

const WORKSPACE_LIMIT = 3;

export function WorkspaceSelector({ workspaces: initial, userEmail }: Props) {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  const [workspaces, setWorkspaces] = useState(initial);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const atLimit = workspaces.length >= WORKSPACE_LIMIT;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;

    setCreating(true);
    setError(null);

    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    const json = await res.json() as { workspace?: Workspace; error?: string };

    if (!res.ok || !json.workspace) {
      setError(json.error ?? 'Failed to create workspace');
      setCreating(false);
      return;
    }

    router.push(`/workspace/${json.workspace.id}`);
  }

  async function handleSignOut() {
    await supabase?.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <span className="text-lg font-semibold text-gray-900">Aetia</span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 hidden sm:block">{userEmail}</span>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Your workspaces</h1>
          {!atLimit && !isCreating && (
            <button
              onClick={() => { setIsCreating(true); setError(null); }}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              <Plus size={15} />
              New workspace
            </button>
          )}
        </div>

        {isCreating && (
          <form onSubmit={handleCreate} className="mb-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Workspace name
            </label>
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={50}
              placeholder="e.g. Brand campaign Q3"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent mb-3"
            />
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => { setIsCreating(false); setNewName(''); setError(null); }}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => router.push(`/workspace/${ws.id}`)}
              className="w-full flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-gray-300 hover:shadow transition-all text-left"
            >
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                <LayoutDashboard size={17} className="text-gray-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{ws.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Created {new Date(ws.created_at).toLocaleDateString()}
                </p>
              </div>
            </button>
          ))}
        </div>

        {atLimit && (
          <p className="mt-4 text-xs text-center text-gray-400">
            You&apos;ve reached the 3-workspace limit on the free plan.
          </p>
        )}
      </main>
    </div>
  );
}
