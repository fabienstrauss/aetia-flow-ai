import { NextResponse } from 'next/server';

import { getSupabaseServerClient } from '../../lib/supabase/server';

const WORKSPACE_LIMIT = 3;
const NAME_MAX_LENGTH = 50;

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: workspaces, error } = await supabase
    .from('workspaces')
    .select('id, name, created_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ workspaces });
}

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { count } = await supabase
    .from('workspaces')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', user.id);

  if ((count ?? 0) >= WORKSPACE_LIMIT) {
    return NextResponse.json(
      { error: `You can have at most ${WORKSPACE_LIMIT} workspaces on the free plan.` },
      { status: 403 },
    );
  }

  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name || name.length > NAME_MAX_LENGTH) {
    return NextResponse.json(
      { error: `Workspace name must be between 1 and ${NAME_MAX_LENGTH} characters.` },
      { status: 400 },
    );
  }

  const { data: workspace, error } = await supabase
    .from('workspaces')
    .insert({ name, owner_id: user.id })
    .select('id, name, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ workspace }, { status: 201 });
}
