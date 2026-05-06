import { NextResponse } from 'next/server';

import { getSupabaseServerClient } from '../../../lib/supabase/server';

const NAME_MAX_LENGTH = 50;

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { name?: string };
  try {
    body = (await request.json()) as { name?: string };
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
    .update({ name })
    .eq('id', id)
    .eq('owner_id', user.id)
    .select('id, name, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  return NextResponse.json({ workspace });
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error } = await supabase
    .from('workspaces')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
