import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '../lib/supabase/server';
import { WorkspaceSelector } from '../components/WorkspaceSelector';

// Always shows the selector — used by the workspace nav button.
export default async function WorkspacesPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: workspaces, error } = await supabase
    .from('workspaces')
    .select('id, name, created_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);

  return (
    <WorkspaceSelector
      workspaces={workspaces ?? []}
      userEmail={user.email ?? ''}
    />
  );
}
