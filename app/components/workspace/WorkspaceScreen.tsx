'use client';

import 'reactflow/dist/style.css';
import { ReactFlowProvider } from 'reactflow';

import { WorkspaceCanvas } from './WorkspaceCanvas';

type Props = {
  workspaceId: string;
  workspaceName: string;
  userEmail: string;
};

export function WorkspaceScreen({ workspaceId, workspaceName, userEmail }: Props) {
  return (
    <ReactFlowProvider>
      <WorkspaceCanvas
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        userEmail={userEmail}
      />
    </ReactFlowProvider>
  );
}
