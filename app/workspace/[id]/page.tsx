import { notFound, redirect } from 'next/navigation';

import { getSupabaseServerClient } from '../../lib/supabase/server';
import { WorkspaceScreen } from '../../components/workspace/WorkspaceScreen';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function WorkspacePage({ params }: Props) {
  const { id } = await params;

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single();

  // Return 404 rather than 403 — don't leak that the workspace exists.
  if (!workspace) notFound();

  return (
    <WorkspaceScreen
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      userEmail={user.email ?? ''}
    />
  );
}
