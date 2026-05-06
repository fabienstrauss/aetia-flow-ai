'use client';

import 'reactflow/dist/style.css';
import { ReactFlowProvider } from 'reactflow';

import { WorkspaceCanvas } from './WorkspaceCanvas';

export type WorkspaceSummary = {
  id: string;
  name: string;
  created_at: string;
};

type Props = {
  workspaceId: string;
  workspaceName: string;
  userEmail: string;
  userAvatarUrl?: string;
  workspaces: WorkspaceSummary[];
};

export function WorkspaceScreen({
  workspaceId,
  workspaceName,
  userEmail,
  userAvatarUrl,
  workspaces,
}: Props) {
  return (
    <ReactFlowProvider>
      <WorkspaceCanvas
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        userEmail={userEmail}
        userAvatarUrl={userAvatarUrl}
        workspaces={workspaces}
      />
    </ReactFlowProvider>
  );
}
