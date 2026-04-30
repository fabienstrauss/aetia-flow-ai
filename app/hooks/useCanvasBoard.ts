'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useEdgesState,
  useNodesState,
  useReactFlow,
} from 'reactflow';

import {
  createQuickNoteNode,
  createCanvasNode,
  createUploadedAssetNode,
  inferMediaType,
  initialEdges,
  initialNodes,
} from '../lib/canvas/sample-data';
import type {
  CanvasInsertionPayload,
  GenerateInput,
  TavilyInput,
  TemplateInput,
} from '../lib/canvas/contracts';
import {
  loadCanvasState,
  saveCanvasState,
  sanitizeNodesForStorage,
  uploadCanvasAsset,
} from '../lib/canvas/persistence';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '../lib/supabase/client';
import type {
  CanvasAssetItem,
  CanvasEdge,
  CanvasNode,
  CanvasNodeData,
} from '../lib/canvas/types';

type PersistenceStatus =
  | 'local-only'
  | 'loading'
  | 'ready'
  | 'saving'
  | 'saved'
  | 'error';

export function useCanvasBoard() {
  const shouldHydrateFromSupabase = isSupabaseConfigured();
  const [rawNodes, setNodes, onNodesChange] = useNodesState<CanvasNodeData>(
    shouldHydrateFromSupabase ? [] : initialNodes,
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<CanvasEdge>(
    shouldHydrateFromSupabase ? [] : initialEdges,
  );
  const { screenToFlowPosition } = useReactFlow();
  const [persistenceStatus, setPersistenceStatus] = useState<PersistenceStatus>(
    shouldHydrateFromSupabase ? 'loading' : 'local-only',
  );
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const [isCanvasReady, setIsCanvasReady] = useState(!shouldHydrateFromSupabase);
  const spawnCountRef = useRef(0);
  const objectUrlsRef = useRef<string[]>([]);
  const hasLoadedRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const supabase = getSupabaseBrowserClient();
  const nodesRef = useRef<CanvasNode[]>(shouldHydrateFromSupabase ? [] : initialNodes);

  useEffect(() => {
    nodesRef.current = rawNodes;
  }, [rawNodes]);

  useEffect(() => {
    const objectUrls = objectUrlsRef.current;

    return () => {
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const client = supabase;
    let isActive = true;

    async function hydrateCanvas() {
      setPersistenceStatus('loading');
      setPersistenceError(null);

      try {
        const canvas = await loadCanvasState(client);

        if (!isActive) {
          return;
        }

        setNodes(
          canvas.nodes?.length ? sanitizeNodesForStorage(canvas.nodes) : initialNodes,
        );
        setEdges([]);
        hasLoadedRef.current = true;
        setIsCanvasReady(true);
        setPersistenceStatus('saved');
      } catch (error) {
        if (!isActive) {
          return;
        }

        hasLoadedRef.current = true;
        setIsCanvasReady(true);
        setPersistenceStatus('error');
        setPersistenceError(
          error instanceof Error ? error.message : 'Failed to load canvas',
        );
      }
    }

    hydrateCanvas();

    return () => {
      isActive = false;
    };
  }, [setEdges, setNodes, supabase]);

  useEffect(() => {
    if (!supabase || !hasLoadedRef.current) {
      return;
    }

    const client = supabase;
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    setPersistenceStatus('saving');
    saveTimerRef.current = window.setTimeout(async () => {
      try {
        await saveCanvasState(client, { nodes: rawNodes, edges });
        setPersistenceStatus('saved');
        setPersistenceError(null);
      } catch (error) {
        setPersistenceStatus('error');
        setPersistenceError(
          error instanceof Error ? error.message : 'Failed to save canvas',
        );
      }
    }, 700);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [edges, rawNodes, supabase]);

  const updateNodeData = useCallback(
    (nodeId: string, patch: Partial<CanvasNodeData>) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  ...patch,
                },
              }
            : node,
        ),
      );
    },
    [setNodes],
  );

  const nodes = useMemo(
    () =>
      rawNodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          onUpdate: (patch: Partial<CanvasNodeData>) => updateNodeData(node.id, patch),
          onDelete: () => {
            if (window.confirm('Are you sure you want to delete this item?')) {
              setNodes((currentNodes) =>
                currentNodes.filter((currentNode) => currentNode.id !== node.id),
              );
            }
          },
        },
      })),
    [rawNodes, setNodes, updateNodeData],
  );

  const getSpawnPosition = useCallback(
    (offsetX = 0, offsetY = 0) => {
      const existingNodes = nodesRef.current;
      const attempts = 24;
      const width = 360;
      const height = 360;

      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const step = spawnCountRef.current + attempt;
        const candidate = screenToFlowPosition({
          x: window.innerWidth / 2 + offsetX + (step % 4) * 56,
          y: window.innerHeight / 2 + offsetY + Math.floor(step / 4) * 56,
        });

        const overlaps = existingNodes.some((node) => {
          return (
            Math.abs(node.position.x - candidate.x) < width &&
            Math.abs(node.position.y - candidate.y) < height
          );
        });

        if (!overlaps) {
          spawnCountRef.current = step + 1;
          return candidate;
        }
      }

      spawnCountRef.current += 1;
      return screenToFlowPosition({
        x: window.innerWidth / 2 + offsetX + spawnCountRef.current * 24,
        y: window.innerHeight / 2 + offsetY + spawnCountRef.current * 24,
      });
    },
    [screenToFlowPosition],
  );

  const addNode = useCallback(
    (node: CanvasNode) => {
      setNodes((currentNodes) => [...currentNodes, node]);
    },
    [setNodes],
  );

  const applyCanvasPayload = useCallback(
    (payload: CanvasInsertionPayload) => {
      const keyToId = new Map<string, string>();

      const nextNodes = payload.items.map((item, index) => {
        const id = `${item.key}-${Date.now()}-${index}`;
        keyToId.set(item.key, id);

        return createCanvasNode(
          id,
          getSpawnPosition(item.offsetX ?? index * 40, item.offsetY ?? index * 28),
          item.data,
        );
      });

      setNodes((currentNodes) => [...currentNodes, ...nextNodes]);

    },
    [getSpawnPosition, setNodes],
  );

  const requestCanvasPayload = useCallback(
    async <TInput>(path: string, body: TInput) => {
      const response = await fetch(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        let message = `Request failed for ${path}`;

        try {
          const errorJson = (await response.json()) as { error?: string };
          if (errorJson.error) {
            message = errorJson.error;
          }
        } catch {
          // Ignore JSON parse failures and keep the default message.
        }

        throw new Error(message);
      }

      return (await response.json()) as CanvasInsertionPayload;
    },
    [],
  );

  const addQuickNote = useCallback(() => {
    const id = `note-${Date.now()}`;
    addNode(createQuickNoteNode(id, getSpawnPosition(-220, -60), spawnCountRef.current + 1));
  }, [addNode, getSpawnPosition]);

  const addOwnContent = useCallback(
    async (files: File[]) => {
      const nextNodes: CanvasNode[] = [];

      for (const [index, file] of files.entries()) {
        const type = inferMediaType(file);
        let previewUrl: string | undefined;
        let storagePath: string | undefined;

        if (supabase) {
          const uploadedAsset = await uploadCanvasAsset(supabase, file, index);
          previewUrl = uploadedAsset.publicUrl;
          storagePath = uploadedAsset.path;
        } else if (type === 'image' || type === 'video') {
          previewUrl = URL.createObjectURL(file);
          objectUrlsRef.current.push(previewUrl);
        }

        const item: CanvasAssetItem = {
          id: `${file.name}-${index}-${Date.now()}`,
          label: file.name,
          type,
          meta:
            type === 'document'
              ? `${Math.max(1, Math.round(file.size / 1024))} KB document`
              : `${Math.max(1, Math.round(file.size / 1024 / 1024))} MB ${type}`,
          previewUrl,
          storagePath,
          mimeType: file.type,
          sizeBytes: file.size,
          lastModified: file.lastModified,
        };

        nextNodes.push(
          createUploadedAssetNode(
            `asset-${Date.now()}-${index}`,
            getSpawnPosition(-160 + index * 48, 40 + index * 24),
            item,
          ),
        );
      }

      setNodes((currentNodes) => [...currentNodes, ...nextNodes]);
    },
    [getSpawnPosition, setNodes, supabase],
  );

  const addGeneratedContent = useCallback(
    (input: GenerateInput) => {
      const nodeId = `generated-result-${Date.now()}`;
      const placeholderNode = createCanvasNode(
        nodeId,
        getSpawnPosition(120, -20),
        {
          kind: 'generation',
          badge: 'Generating',
          title:
            input.type === 'image'
              ? 'Generating image with Nano Banana'
              : input.type === 'video'
                ? 'Generating video with Veo'
                : 'Preparing animation with Hera',
          subtitle: 'This node will update automatically',
          accent: 'from-fuchsia-100 via-white to-rose-50',
          status: 'generating',
          generationType: input.type,
          generationProvider:
            input.type === 'image'
              ? 'nanobanana'
              : input.type === 'video'
                ? 'veo'
                : 'hera',
          aspectRatio: '16:9',
          statusMessage:
            input.type === 'image'
              ? 'Nano Banana is rendering your image...'
              : input.type === 'video'
                ? 'Veo is rendering your video...'
                : 'Hera generation is being prepared...',
          prompt: input.prompt,
        },
      );

      addNode(placeholderNode);

      void (async () => {
        try {
          const payload = await requestCanvasPayload('/api/generate', input);
          const [firstItem, ...otherItems] = payload.items;

          if (!firstItem) {
            throw new Error('No generated content was returned');
          }

          updateNodeData(nodeId, {
            ...firstItem.data,
            status: 'done',
          });

          if (otherItems.length || payload.edges?.length) {
            applyCanvasPayload({
              items: otherItems,
              edges: payload.edges,
            });
          }
        } catch (error) {
          updateNodeData(nodeId, {
            badge: 'Generation failed',
            status: 'error',
            statusMessage:
              error instanceof Error ? error.message : 'Generation failed',
            subtitle: 'Check your provider configuration and try again',
            body:
              error instanceof Error ? error.message : 'Generation failed',
          });
        }
      })();
    },
    [addNode, applyCanvasPayload, getSpawnPosition, requestCanvasPayload, updateNodeData],
  );

  const addResearchPack = useCallback(
    async (input: TavilyInput) => {
      const payload = await requestCanvasPayload('/api/search', input);
      applyCanvasPayload(payload);
    },
    [applyCanvasPayload, requestCanvasPayload],
  );

  const addTemplate = useCallback(
    async (input: TemplateInput) => {
      const payload = await requestCanvasPayload('/api/templates/apply', input);
      applyCanvasPayload(payload);
    },
    [applyCanvasPayload, requestCanvasPayload],
  );

  const actions = useMemo(
    () => ({
      addQuickNote,
      addOwnContent,
      addGeneratedContent,
      addResearchPack,
      addTemplate,
      updateNodeData,
    }),
    [addGeneratedContent, addOwnContent, addQuickNote, addResearchPack, addTemplate, updateNodeData],
  );

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    actions,
    persistenceStatus,
    persistenceError,
    isCanvasReady,
  };
}
