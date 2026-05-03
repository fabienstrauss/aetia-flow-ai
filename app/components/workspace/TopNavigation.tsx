'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

import { getSupabaseBrowserClient } from '../../lib/supabase/client';

type TopNavigationProps = {
  persistenceStatus: 'local-only' | 'loading' | 'ready' | 'saving' | 'saved' | 'error';
  persistenceError?: string | null;
  currentStep: number;
  onStepClick: (step: number) => void;
  workspaceName: string;
  userEmail: string;
};

function getStatusLabel(status: TopNavigationProps['persistenceStatus']) {
  if (status === 'local-only') return 'Local only';
  if (status === 'loading') return 'Loading';
  if (status === 'saving') return 'Saving';
  if (status === 'saved') return 'Saved';
  if (status === 'error') return 'Sync error';
  return 'Ready';
}

export function TopNavigation({
  persistenceStatus,
  persistenceError,
  currentStep,
  onStepClick,
  workspaceName,
  userEmail,
}: TopNavigationProps) {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  const steps = [
    { id: 1, label: 'BRAINSTORMING' },
    { id: 2, label: 'PLATFORM' },
    { id: 3, label: 'GENERATING' },
  ];

  async function handleSignOut() {
    await supabase?.auth.signOut();
    router.push('/login');
  }

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-start justify-between px-4 pt-6">
      {/* Left — workspace name, links back to selector */}
      <div className="pointer-events-auto">
        <button
          onClick={() => router.push('/workspaces')}
          className="flex items-center gap-1.5 rounded-full border border-white/20 bg-slate-900/10 px-3 py-1.5 text-[10px] font-bold tracking-[0.10em] text-slate-600 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] backdrop-blur-xl transition-colors hover:bg-white/50 hover:text-slate-900 max-w-[180px] truncate"
          title={workspaceName}
        >
          <span className="truncate">{workspaceName}</span>
        </button>
      </div>

      {/* Centre — step navigation + sync status */}
      <div className="pointer-events-auto flex items-center gap-2">
        <nav className="flex items-center gap-1 rounded-full border border-white/20 bg-slate-900/10 p-1 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] backdrop-blur-xl">
          {steps.map((step) => (
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

        <span
          title={persistenceError ?? getStatusLabel(persistenceStatus)}
          className={[
            'rounded-full border border-white/20 px-3 py-1.5 text-[10px] font-bold tracking-[0.12em] shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] backdrop-blur-xl transition-colors',
            persistenceStatus === 'error'
              ? 'bg-red-500/10 text-red-600'
              : 'bg-slate-900/10 text-slate-600',
          ].join(' ')}
        >
          {getStatusLabel(persistenceStatus).toUpperCase()}
        </span>
      </div>

      {/* Right — user email + sign out */}
      <div className="pointer-events-auto flex items-center gap-2">
        <span className="hidden sm:block rounded-full border border-white/20 bg-slate-900/10 px-3 py-1.5 text-[10px] font-bold tracking-[0.10em] text-slate-600 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] backdrop-blur-xl max-w-[160px] truncate">
          {userEmail}
        </span>
        <button
          onClick={handleSignOut}
          title="Sign out"
          className="flex items-center gap-1.5 rounded-full border border-white/20 bg-slate-900/10 px-3 py-1.5 text-[10px] font-bold tracking-[0.10em] text-slate-600 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] backdrop-blur-xl transition-colors hover:bg-red-500/10 hover:text-red-600 hover:border-red-200"
        >
          <LogOut size={11} />
          SIGN OUT
        </button>
      </div>
    </header>
  );
}
