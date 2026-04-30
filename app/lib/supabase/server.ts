import 'server-only';

import { createClient } from '@supabase/supabase-js';

type SupabaseServerEnv = {
  url: string;
  anonKey: string;
};

function getServerEnv(): SupabaseServerEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Missing Supabase env for server access');
  }

  return { url, anonKey };
}

export function getSupabaseRestUrl(path: string) {
  const { url } = getServerEnv();
  return `${url}/rest/v1/${path}`;
}

export function getSupabaseAuthHeaders() {
  const { anonKey } = getServerEnv();

  return {
    Authorization: `Bearer ${anonKey}`,
    apikey: anonKey,
    'Content-Type': 'application/json',
  };
}

export function getSupabaseStoragePublicUrl(bucket: string, path: string) {
  const { url } = getServerEnv();
  return `${url}/storage/v1/object/public/${bucket}/${path}`;
}

export function getSupabaseServerClient() {
  const { url, anonKey } = getServerEnv();
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
