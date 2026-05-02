import type { SupabaseClient } from '@supabase/supabase-js';

import { CAMPAIGN_CONFIG_TABLE } from '../supabase/constants';
import type { ChoiceConfig } from './types';

export async function loadCampaignConfig(
  client: SupabaseClient,
  workspaceId: string,
): Promise<ChoiceConfig | null> {
  const { data, error } = await client
    .from(CAMPAIGN_CONFIG_TABLE)
    .select('config')
    .eq('workspace_id', workspaceId)
    .maybeSingle<{ config: ChoiceConfig }>();

  if (error) throw error;
  if (!data?.config || Object.keys(data.config).length === 0) return null;

  return data.config;
}

export async function saveCampaignConfig(
  client: SupabaseClient,
  workspaceId: string,
  config: ChoiceConfig,
): Promise<void> {
  const { error } = await client
    .from(CAMPAIGN_CONFIG_TABLE)
    .upsert({ workspace_id: workspaceId, config });

  if (error) throw error;
}
