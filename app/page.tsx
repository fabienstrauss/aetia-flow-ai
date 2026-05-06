import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from './lib/supabase/server';
import { WorkspaceSelector } from './components/WorkspaceSelector';

export default async function HomePage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Middleware guarantees auth, but guard defensively.
  if (!user) redirect('/login');

  const { data: workspaces, error } = await supabase
    .from('workspaces')
    .select('id, name, created_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);

  // First visit — auto-create a default workspace and go straight in.
  if (!workspaces || workspaces.length === 0) {
    const { data: created, error: createError } = await supabase
      .from('workspaces')
      .insert({ name: 'My Workspace', owner_id: user.id })
      .select('id')
      .single();

    if (createError || !created) throw new Error('Failed to create default workspace');

    redirect(`/workspace/${created.id}`);
  }

  // Always go straight to the first workspace — switcher lives in the nav.
  redirect(`/workspace/${workspaces[0].id}`);
}
