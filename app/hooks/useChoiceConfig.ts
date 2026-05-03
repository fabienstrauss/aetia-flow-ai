'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { loadCampaignConfig, saveCampaignConfig } from '../lib/campaign/persistence';
import type { ChoiceConfig } from '../lib/campaign/types';
import { getSupabaseBrowserClient } from '../lib/supabase/client';

type PersistenceStatus = 'local-only' | 'loading' | 'ready' | 'saving' | 'saved' | 'error';

export function useChoiceConfig(workspaceId?: string) {
  const supabase = getSupabaseBrowserClient();
  const shouldPersist = Boolean(supabase && workspaceId);

  const [config, setConfig] = useState<ChoiceConfig | null>(null);
  const [status, setStatus] = useState<PersistenceStatus>(shouldPersist ? 'loading' : 'local-only');
  const [error, setError] = useState<string | null>(null);

  const hasLoadedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!supabase || !workspaceId) return;

    let active = true;

    async function hydrate() {
      setStatus('loading');
      setError(null);
      try {
        const loaded = await loadCampaignConfig(supabase!, workspaceId!);
        if (!active) return;
        if (loaded) setConfig(loaded);
        hasLoadedRef.current = true;
        setStatus('saved');
      } catch (err) {
        if (!active) return;
        hasLoadedRef.current = true;
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Failed to load campaign config');
      }
    }

    hydrate();
    return () => { active = false; };
  }, [supabase, workspaceId]);

  useEffect(() => {
    if (!supabase || !workspaceId || !hasLoadedRef.current || !config) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setStatus('saving');

    saveTimerRef.current = setTimeout(async () => {
      try {
        await saveCampaignConfig(supabase, workspaceId, config);
        setStatus('saved');
        setError(null);
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Failed to save campaign config');
      }
    }, 700);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [config, supabase, workspaceId]);

  const updateConfig = useCallback((next: ChoiceConfig) => {
    if (!hasLoadedRef.current) hasLoadedRef.current = true;
    setConfig(next);
  }, []);

  return { config, updateConfig, status, error };
}
