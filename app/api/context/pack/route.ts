import { NextResponse } from 'next/server';

import { loadCanvasState } from '../../../lib/canvas/persistence';
import { loadCampaignConfig } from '../../../lib/campaign/persistence';
import { buildWorkspaceContextPack } from '../../../lib/context/context-pack-service';
import { extractWorkspaceSources } from '../../../lib/context/extraction-service';
import { getSupabaseServerClient } from '../../../lib/supabase/server';

type ContextPackRequest = {
  workspaceId: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as ContextPackRequest;
    const { workspaceId } = body;

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const client = await getSupabaseServerClient();
    const canvasState = await loadCanvasState(client, workspaceId);
    const choiceConfig = await loadCampaignConfig(client, workspaceId);

    const extraction = await extractWorkspaceSources({
      client,
      workspaceId,
      nodes: canvasState.nodes,
      choiceConfig,
    });

    const packed = await buildWorkspaceContextPack({
      client,
      workspaceId,
      artifacts: extraction.artifacts,
      choiceConfig,
    });

    return NextResponse.json({
      ...packed,
      extraction,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to build workspace context pack',
      },
      { status: 500 },
    );
  }
}
