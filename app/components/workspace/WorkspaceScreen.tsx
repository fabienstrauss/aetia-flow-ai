'use client';

import 'reactflow/dist/style.css';
import { ReactFlowProvider } from 'reactflow';

import { WorkspaceCanvas } from './WorkspaceCanvas';

export function WorkspaceScreen() {
  return (
    <ReactFlowProvider>
      <WorkspaceCanvas />
    </ReactFlowProvider>
  );
}
