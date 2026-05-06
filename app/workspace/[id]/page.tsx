import { notFound, redirect } from 'next/navigation';

import { getSupabaseServerClient } from '../../lib/supabase/server';
import { WorkspaceScreen } from '../../components/workspace/WorkspaceScreen';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function WorkspacePage({ params }: Props) {
  const { id } = await params;

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [{ data: workspace }, { data: workspaces }] = await Promise.all([
    supabase
      .from('workspaces')
      .select('id, name')
      .eq('id', id)
      .eq('owner_id', user.id)
      .single(),
    supabase
      .from('workspaces')
      .select('id, name, created_at')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true }),
  ]);

  // Return 404 rather than 403 — don't leak that the workspace exists.
  if (!workspace) notFound();

  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;

  return (
    <WorkspaceScreen
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      userEmail={user.email ?? ''}
      userAvatarUrl={avatarUrl}
      workspaces={workspaces ?? []}
    />
  );
}
