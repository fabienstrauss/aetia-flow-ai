import { NextResponse } from 'next/server';

import { loadCanvasState } from '../../../lib/canvas/persistence';
import { loadCampaignConfig } from '../../../lib/campaign/persistence';
import { extractWorkspaceSources } from '../../../lib/context/extraction-service';
import { CANVAS_BOARD_ID } from '../../../lib/supabase/constants';
import { getSupabaseServerClient } from '../../../lib/supabase/server';

type ExtractContextRequest = {
  workspaceId?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as ExtractContextRequest;
    const workspaceId = body.workspaceId ?? CANVAS_BOARD_ID;
    const client = getSupabaseServerClient();
    const canvasState = await loadCanvasState(client);
    const choiceConfig = await loadCampaignConfig(client);

    const result = await extractWorkspaceSources({
      client,
      workspaceId,
      nodes: canvasState.nodes,
      choiceConfig,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to extract workspace context',
      },
      { status: 500 },
    );
  }
}
