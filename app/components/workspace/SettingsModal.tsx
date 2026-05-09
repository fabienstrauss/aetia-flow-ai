'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Eye, EyeOff, X } from 'lucide-react';

import { getStoredKey, setStoredKey } from '../../lib/byok/keys';

type Provider = {
  id: 'gemini' | 'tavily' | 'hera';
  label: string;
  placeholder: string;
  hint: string;
};

const PROVIDERS: Provider[] = [
  {
    id: 'gemini',
    label: 'Gemini API Key',
    placeholder: 'AIza…',
    hint: 'Used for image/video generation and context extraction.',
  },
  {
    id: 'tavily',
    label: 'Tavily API Key',
    placeholder: 'tvly-…',
    hint: 'Used for live web research.',
  },
  {
    id: 'hera',
    label: 'Hera API Key',
    placeholder: 'hera-…',
    hint: 'Used for animation generation.',
  },
];

type FieldState = {
  value: string;
  saved: boolean;
  show: boolean;
};

type Props = {
  onClose: () => void;
};

export function SettingsModal({ onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const [fields, setFields] = useState<Record<string, FieldState>>(() => {
    const initial: Record<string, FieldState> = {};
    PROVIDERS.forEach((p) => {
      initial[p.id] = { value: getStoredKey(p.id), saved: false, show: false };
    });
    return initial;
  });

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  function save(id: string) {
    const provider = PROVIDERS.find((p) => p.id === id);
    if (!provider) return;
    setStoredKey(provider.id, fields[id].value);
    setFields((prev) => ({ ...prev, [id]: { ...prev[id], saved: true } }));
    setTimeout(() => {
      setFields((prev) => ({ ...prev, [id]: { ...prev[id], saved: false } }));
    }, 1500);
  }

  function toggle(id: string) {
    setFields((prev) => ({ ...prev, [id]: { ...prev[id], show: !prev[id].show } }));
  }

  return (
    <div
      ref={overlayRef}
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_24px_64px_-12px_rgba(15,23,42,0.3)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">API Keys</h2>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Keys are stored in your browser&apos;s <code className="rounded bg-slate-100 px-1 font-mono text-slate-500">localStorage</code> — never in our database.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={15} />
          </button>
        </div>

        <div className="divide-y divide-slate-50 p-5 space-y-4">
          {PROVIDERS.map((provider) => {
            const field = fields[provider.id];
            return (
              <div key={provider.id} className="pt-4 first:pt-0">
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {provider.label}
                </label>
                <p className="mb-2 text-[11px] text-slate-400">{provider.hint}</p>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={field.show ? 'text' : 'password'}
                      value={field.value}
                      onChange={(e) =>
                        setFields((prev) => ({
                          ...prev,
                          [provider.id]: { ...prev[provider.id], value: e.target.value, saved: false },
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') save(provider.id);
                      }}
                      placeholder={provider.placeholder}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-3 pr-9 text-xs text-slate-900 placeholder-slate-300 outline-none transition focus:border-slate-400 focus:bg-white"
                      spellCheck={false}
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => toggle(provider.id)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                    >
                      {field.show ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                  <button
                    onClick={() => save(provider.id)}
                    className={[
                      'flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-semibold transition',
                      field.saved
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-900 text-white hover:bg-slate-700',
                    ].join(' ')}
                  >
                    {field.saved ? <Check size={12} /> : null}
                    {field.saved ? 'Saved' : 'Save'}
                  </button>
                </div>
              </div>
            );
          })}

          <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-700">
            <span className="font-semibold">Security note:</span> Keys stored in{' '}
            <code className="rounded bg-amber-100 px-1 font-mono">localStorage</code> are readable
            by JavaScript on this page and by browser extensions. They are never saved in our
            database and only travel to our server encrypted over HTTPS when you trigger a generation.
            Avoid using this on a shared or public computer.
          </div>
        </div>
      </div>
    </div>
  );
}
