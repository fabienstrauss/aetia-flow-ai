'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImageIcon, Sparkles, Video, Plus, Paperclip, Globe, Library, RefreshCw, Code2, X, Trash2, Download, Volume2 } from 'lucide-react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
} from 'reactflow';

import { useCanvasBoard } from '../../hooks/useCanvasBoard';
import { useChoiceConfig } from '../../hooks/useChoiceConfig';
import { FloatingToolbar } from './FloatingToolbar';
import { TopNavigation } from './TopNavigation';
import { WorkspaceActionPanel } from './WorkspaceActionPanel';
import { TemplateGallery } from './TemplateGallery';
import { ChoiceScreen } from './ChoiceScreen';
import { CanvasCardNode } from './nodes/CanvasCardNode';
import { contentTemplates } from '../../lib/templates/catalog';
import type { WorkspaceContextPack } from '../../lib/context/workspace-context';
import type { ContentTypeId, AspectRatioId, GeneratedContentRecord } from '../../lib/campaign/types';
import { GENERATED_CONTENT_TABLE, WORKSPACE_ID } from '../../lib/supabase/constants';
import { getSupabaseBrowserClient } from '../../lib/supabase/client';

type GenerationJobStatus = 'queued' | 'generating' | 'done' | 'error';

type GenerationJob = {
  jobId: string;
  platform: string;
  contentType: ContentTypeId;
  audience: string;
  aspectRatio: AspectRatioId;
  templateId?: string;
  status: GenerationJobStatus;
  result?: GeneratedContentRecord;
  error?: string;
  isRefining?: boolean;
  refinePrompt?: string;
  isAddingVoiceover?: boolean;
  voiceoverPrompt?: string;
  isGeneratingVoiceover?: boolean;
  voiceoverError?: string;
};

const PLATFORM_META: Record<string, { name: string; color: string }> = {
  instagram: { name: 'Instagram', color: '#E1306C' },
  tiktok: { name: 'TikTok', color: '#010101' },
  linkedin: { name: 'LinkedIn', color: '#0A66C2' },
  twitter: { name: 'X / Twitter', color: '#000000' },
  youtube: { name: 'YouTube', color: '#FF0000' },
};

const CONTENT_TYPE_LABELS: Record<ContentTypeId, string> = {
  image: 'Image',
  video: 'Video',
};

type ActivePanel = 'upload' | 'generate' | 'scrape' | 'template' | null;

function trimLabel(label: string, maxLength = 42) {
  if (label.length <= maxLength) {
    return label;
  }

  const extensionIndex = label.lastIndexOf('.');

  if (extensionIndex <= 0 || extensionIndex === label.length - 1) {
    return `${label.slice(0, maxLength - 1)}…`;
  }

  const extension = label.slice(extensionIndex);
  const base = label.slice(0, extensionIndex);
  const visibleBaseLength = Math.max(12, maxLength - extension.length - 1);

  return `${base.slice(0, visibleBaseLength)}…${extension}`;
}

export function WorkspaceCanvas() {
  const {
    nodes,
    onNodesChange,
    actions,
    persistenceStatus,
    persistenceError,
    isCanvasReady,
  } =
    useCanvasBoard();
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [isRefreshingContext, setIsRefreshingContext] = useState(false);
  const [showContextDebug, setShowContextDebug] = useState(false);
  const [contextPack, setContextPack] = useState<WorkspaceContextPack | null>(null);
  const [generateType, setGenerateType] = useState<'image' | 'video' | 'animation'>('image');
  const [generatePrompt, setGeneratePrompt] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [includeImages, setIncludeImages] = useState(true);
  const { config: persistedChoiceConfig, updateConfig: persistChoiceConfig } = useChoiceConfig();
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lightboxAsset, setLightboxAsset] = useState<{ url: string; type: 'image' | 'video'; title: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load saved results when entering Step 3
  useEffect(() => {
    if (currentStep !== 3) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    supabase
      .from(GENERATED_CONTENT_TABLE)
      .select('*')
      .eq('workspace_id', WORKSPACE_ID)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        setJobs((prev) => {
          if (prev.length > 0) return prev; // don't overwrite active session
          return (data as GeneratedContentRecord[]).map((record) => ({
            jobId: `${record.platform}-${record.content_type}-${record.id}`,
            platform: record.platform,
            contentType: record.content_type,
            audience: record.audience ?? 'genz',
            aspectRatio: (record.aspect_ratio as AspectRatioId) ?? 'vertical',
            templateId: record.template_id ?? undefined,
            status: 'done' as const,
            result: record,
          }));
        });
      });
  }, [currentStep]);

  const handleGenerate = useCallback(async () => {
    if (!persistedChoiceConfig || isGenerating) return;

    setIsGenerating(true);
    setContextError(null);

    let freshContext: WorkspaceContextPack;
    try {
      const res = await fetch('/api/context/pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: WORKSPACE_ID }),
      });
      const json = (await res.json()) as { contextPack?: WorkspaceContextPack; error?: string };
      if (!res.ok || !json.contextPack) throw new Error(json.error ?? 'Failed to extract context');
      freshContext = json.contextPack;
      setContextPack(freshContext);
    } catch (error) {
      setContextError(error instanceof Error ? error.message : 'Context extraction failed');
      setIsGenerating(false);
      return;
    }

    // Build job list from choice config
    const newJobs: GenerationJob[] = [];
    for (const [platform, platformConfig] of Object.entries(persistedChoiceConfig.platforms)) {
      for (const contentType of platformConfig.contentTypes) {
        newJobs.push({
          jobId: `${platform}-${contentType}-${Date.now()}-${Math.random()}`,
          platform,
          contentType: contentType as ContentTypeId,
          audience: platformConfig.audience,
          aspectRatio: (platformConfig.aspectRatios?.[contentType as ContentTypeId] ?? (contentType === 'image' ? 'square' : 'vertical')) as AspectRatioId,
          templateId: platformConfig.templates?.[contentType as ContentTypeId],
          status: 'queued',
        });
      }
    }

    setJobs((prev) => [...newJobs, ...prev]);

    // Generate sequentially, updating each job's status as we go
    for (let i = 0; i < newJobs.length; i++) {
      const job = newJobs[i];

      setJobs((prev) =>
        prev.map((j) => (j.jobId === job.jobId ? { ...j, status: 'generating' } : j))
      );

      try {
        const res = await fetch('/api/campaign/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: job.platform,
            contentType: job.contentType,
            audience: job.audience,
            aspectRatio: job.aspectRatio,
            templateId: job.templateId,
            contextPack: freshContext,
          }),
        });

        const json = (await res.json()) as GeneratedContentRecord & { error?: string };
        if (!res.ok) {
          setJobs((prev) =>
            prev.map((j) => (j.jobId === job.jobId ? { ...j, status: 'error', error: json.error ?? 'Generation failed' } : j))
          );
        } else {
          setJobs((prev) =>
            prev.map((j) => (j.jobId === job.jobId ? { ...j, status: 'done', result: json as GeneratedContentRecord } : j))
          );
        }
      } catch {
        setJobs((prev) =>
          prev.map((j) => (j.jobId === job.jobId ? { ...j, status: 'error', error: 'Network error' } : j))
        );
      }
    }

    setIsGenerating(false);
  }, [persistedChoiceConfig, isGenerating]);

  const clearAllResults = useCallback(async () => {
    if (!window.confirm('Are you sure you want to clear all results from the UI? (Files will remain in storage but won\'t be visible here)')) return;
    
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    try {
      // We only delete from the DATABASE table.
      // We do NOT call bucket removal, so the files stay in the bucket.
      const { error } = await supabase
        .from(GENERATED_CONTENT_TABLE)
        .delete()
        .eq('workspace_id', WORKSPACE_ID);

      if (error) throw error;
      setJobs([]);
    } catch (error) {
      console.error('Failed to clear results:', error);
    }
  }, []);

  const handleDeleteResult = useCallback(async (job: GenerationJob) => {
    if (!job.result) return;
    setJobs((prev) => prev.filter((j) => j.jobId !== job.jobId));

    try {
      await fetch('/api/campaign/generate', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: job.result.id, storagePath: job.result.storage_path }),
      });
    } catch {
      // Restore on network failure
      setJobs((prev) => [...prev, job]);
    }
  }, []);

  const handleDownload = useCallback(async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      window.open(url, '_blank');
    }
  }, []);

  const handleRefine = useCallback(async (job: GenerationJob) => {
    if (!job.refinePrompt?.trim() || job.status === 'generating') return;

    setJobs((prev) =>
      prev.map((j) => (j.jobId === job.jobId ? { ...j, status: 'generating', isRefining: false } : j))
    );

    try {
      // Auto-fetch context if missing (e.g. after page reload)
      let pack = contextPack;
      if (!pack) {
        const ctxRes = await fetch('/api/context/pack', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId: WORKSPACE_ID }),
        });
        const ctxJson = (await ctxRes.json()) as { contextPack?: WorkspaceContextPack; error?: string };
        if (!ctxRes.ok || !ctxJson.contextPack) throw new Error(ctxJson.error ?? 'Failed to extract context');
        pack = ctxJson.contextPack;
        setContextPack(pack);
      }

      const res = await fetch('/api/campaign/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: job.platform,
          contentType: job.contentType,
          audience: job.audience,
          aspectRatio: job.aspectRatio,
          templateId: job.templateId,
          contextPack: pack,
          refinePrompt: job.refinePrompt,
          referenceAsset: job.result,
          existingId: job.result?.id,
        }),
      });

      const json = (await res.json()) as GeneratedContentRecord & { error?: string };
      if (!res.ok) {
        setJobs((prev) =>
          prev.map((j) => (j.jobId === job.jobId ? { ...j, status: 'error', error: json.error ?? 'Refinement failed' } : j))
        );
      } else {
        setJobs((prev) =>
          prev.map((j) =>
            j.jobId === job.jobId
              ? {
                  ...j,
                  status: 'done',
                  result: json as GeneratedContentRecord,
                  refinePrompt: '',
                  isAddingVoiceover: false,
                  isGeneratingVoiceover: false,
                  voiceoverError: undefined,
                }
              : j,
          )
        );
      }
    } catch (err) {
      setJobs((prev) =>
        prev.map((j) => (j.jobId === job.jobId ? { ...j, status: 'error', error: err instanceof Error ? err.message : 'Network error' } : j))
      );
    }
  }, [contextPack]);

  const handleGenerateVoiceover = useCallback(async (job: GenerationJob) => {
    if (!job.result || job.isGeneratingVoiceover) return;

    const voiceoverText = job.voiceoverPrompt?.trim();
    if (!voiceoverText) return;

    setJobs((prev) =>
      prev.map((j) =>
        j.jobId === job.jobId
          ? {
              ...j,
              isGeneratingVoiceover: true,
              voiceoverError: undefined,
            }
          : j,
      ),
    );

    try {
      const response = await fetch('/api/campaign/voiceover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generatedContentId: job.result.id,
          text: voiceoverText,
        }),
      });

      const json = (await response.json()) as GeneratedContentRecord & { error?: string };

      if (!response.ok) {
        throw new Error(json.error ?? 'Voiceover generation failed');
      }

      setJobs((prev) =>
        prev.map((j) =>
          j.jobId === job.jobId
            ? {
                ...j,
                result: json as GeneratedContentRecord,
                isAddingVoiceover: false,
                isGeneratingVoiceover: false,
                voiceoverPrompt: voiceoverText,
                voiceoverError: undefined,
              }
            : j,
        ),
      );
    } catch (error) {
      setJobs((prev) =>
        prev.map((j) =>
          j.jobId === job.jobId
            ? {
                ...j,
                isGeneratingVoiceover: false,
                voiceoverError:
                  error instanceof Error ? error.message : 'Voiceover generation failed',
              }
            : j,
        ),
      );
    }
  }, []);

  const nodeTypes = useMemo(
    () => ({
      'canvas-card': CanvasCardNode,
    }),
    [],
  );

  const closePanel = () => {
    setActivePanel(null);
    setActionError(null);
  };
  const handlePaneClick = useCallback(() => setActivePanel(null), []);

  const brainstormActions = [
    { label: 'Add note', icon: Plus, onClick: actions.addQuickNote, primary: true },
    { label: 'Own content', icon: Paperclip, onClick: () => setActivePanel('upload') },
    { label: 'Generate', icon: Sparkles, onClick: () => setActivePanel('generate') },
    { label: 'Tavily scrape', icon: Globe, onClick: () => setActivePanel('scrape') },
    { label: 'Templates', icon: Library, onClick: () => setActivePanel('template') },
  ];

  const choiceActions = [
    { label: 'AI Assistant', icon: Sparkles, onClick: () => console.log('AI Refine'), primary: true },
    { label: 'Saved Presets', icon: Library, onClick: () => console.log('Presets') },
  ];

  const handleUploadSubmit = async () => {
    if (!selectedFiles.length) {
      return;
    }

    setIsUploading(true);
    setActionError(null);

    try {
      await actions.addOwnContent(selectedFiles);
      setSelectedFiles([]);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      closePanel();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerateSubmit = async () => {
    if (!generatePrompt.trim()) {
      return;
    }

    setActionError(null);
    actions.addGeneratedContent({
      type: generateType,
      prompt: generatePrompt.trim(),
    });
    setGeneratePrompt('');
    closePanel();
  };

  const handleScrapeSubmit = async () => {
    if (!searchQuery.trim()) {
      return;
    }

    setIsSearching(true);
    setActionError(null);

    try {
      await actions.addResearchPack({
        query: searchQuery.trim(),
        includeImages,
      });
      setSearchQuery('');
      setIncludeImages(true);
      closePanel();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleTemplateSubmit = async (templateId: string) => {
    setIsApplyingTemplate(true);
    setActionError(null);

    try {
      await actions.addTemplate({ templateId });
      closePanel();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Template failed');
    } finally {
      setIsApplyingTemplate(false);
    }
  };

  const handleRefreshContext = useCallback(async () => {
    setIsRefreshingContext(true);
    setContextError(null);

    try {
      const response = await fetch('/api/context/pack', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ workspaceId: 'main' }),
      });

      const json = (await response.json()) as {
        contextPack?: WorkspaceContextPack;
        extraction?: {
          reused: number;
          generated: number;
          failed: number;
        };
        error?: string;
      };

      if (!response.ok || !json.contextPack) {
        throw new Error(json.error ?? 'Failed to regenerate context');
      }

      setContextPack(json.contextPack);
    } catch (error) {
      setContextError(error instanceof Error ? error.message : 'Failed to regenerate context');
    } finally {
      setIsRefreshingContext(false);
    }
  }, []);

  const handleDownloadContext = useCallback(() => {
    if (!contextPack) {
      return;
    }

    const blob = new Blob([JSON.stringify(contextPack, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    anchor.href = url;
    anchor.download = `workspace-context-${timestamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [contextPack]);

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(240,249,255,0.95),_rgba(248,250,252,1)_45%,_rgba(255,255,255,1)_100%)] text-slate-900">
      <TopNavigation
        persistenceStatus={persistenceStatus}
        persistenceError={persistenceError}
        currentStep={currentStep}
        onStepClick={setCurrentStep}
      />

      <main className="relative h-full overflow-hidden">
        {/* Step 1: Brainstorming (ReactFlow) */}
        <div 
          className={[
            'absolute inset-0 pt-24 transition-all duration-500 ease-in-out',
            currentStep === 1 ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none'
          ].join(' ')}
        >
          {isCanvasReady ? (
            <ReactFlow
              nodes={nodes}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onPaneClick={handlePaneClick}
              deleteKeyCode={['Backspace', 'Delete']}
              noWheelClassName="nowheel"
              fitView
              fitViewOptions={{ padding: 0.2 }}
              proOptions={{ hideAttribution: true }}
              className="!bg-transparent"
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={20}
                size={1.2}
                color="#cbd5e1"
              />
              <Controls
                position="top-right"
                className="!top-4 !right-4 !rounded-2xl !border !border-slate-200 !bg-white/90 !shadow-lg !backdrop-blur"
              />
              <MiniMap
                pannable
                zoomable
                nodeColor={() => '#e2e8f0'}
                className="!bottom-24 !rounded-2xl !border !border-slate-200 !bg-white/90 !shadow-lg !backdrop-blur"
              />
            </ReactFlow>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="flex items-center gap-3 rounded-full border border-white/70 bg-white/85 px-5 py-3 text-sm font-medium text-slate-600 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)] backdrop-blur-xl">
                <span className="size-3 animate-pulse rounded-full bg-slate-400" />
                Loading your canvas...
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Choice */}
        <div 
          className={[
            'absolute inset-0 pt-24 transition-all duration-500 ease-in-out overflow-y-auto',
            currentStep === 2 ? 'translate-x-0 opacity-100' : (currentStep < 2 ? 'translate-x-full opacity-0' : '-translate-x-full opacity-0'),
            currentStep !== 2 ? 'pointer-events-none' : ''
          ].join(' ')}
        >
          <ChoiceScreen
            initialConfig={persistedChoiceConfig}
            onConfigChange={persistChoiceConfig}
            onComplete={(config) => {
              persistChoiceConfig(config);
              setCurrentStep(3);
            }}
          />
        </div>

        {/* Step 3: Generating */}
        <div
          className={[
            'absolute inset-0 pt-24 transition-all duration-500 ease-in-out',
            currentStep === 3 ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'
          ].join(' ')}
        >
          <div className="relative flex h-full flex-col overflow-hidden">

            {jobs.length === 0 && !isGenerating ? (
              /* Blank canvas: centered generate button */
              <div className="flex flex-1 flex-col items-center justify-center">
                <div className="relative inline-flex">
                  <span className="generate-ring generate-ring-1 absolute inset-0 rounded-full" />
                  <span className="generate-ring generate-ring-2 absolute inset-0 rounded-full" />
                  <span className="generate-ring generate-ring-3 absolute inset-0 rounded-full" />
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={!persistedChoiceConfig}
                    className="generate-btn relative z-10 flex items-center gap-3 rounded-full px-10 py-5 text-lg font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Sparkles className="size-5" />
                    Generate
                  </button>
                </div>
                <p className="mt-10 text-sm tracking-wide text-slate-400">
                  {persistedChoiceConfig
                    ? 'Click to start the generation workflow'
                    : 'Configure platforms on step 2 first'}
                </p>
                {contextError && (
                  <p className="mt-4 max-w-sm text-center text-sm text-red-500">{contextError}</p>
                )}
              </div>
            ) : (
              /* Results grid */
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="flex flex-shrink-0 items-center justify-between px-8 pb-4 pt-6">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Generated Content</h2>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {isGenerating
                        ? `Generating ${jobs.findIndex((j) => j.status === 'generating') + 1} of ${jobs.length}…`
                        : `${jobs.filter((j) => j.status === 'done').length} of ${jobs.length} complete`}
                    </p>
                    {contextError && (
                      <p className="mt-1 text-xs text-red-500">{contextError}</p>
                    )}
                  </div>
                  {!isGenerating && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={clearAllResults}
                        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-400 transition hover:border-red-100 hover:bg-red-50 hover:text-red-500 shadow-sm"
                      >
                        <Trash2 className="size-3.5" />
                        Clear all
                      </button>
                      <button
                        type="button"
                        onClick={handleGenerate}
                        disabled={!persistedChoiceConfig}
                        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Sparkles className="size-3.5" />
                        Generate new batch
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto px-8 pb-32">
                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
                    {jobs.map((job) => {
                      const meta = PLATFORM_META[job.platform] ?? { name: job.platform, color: '#64748b' };
                      const typeLabel = CONTENT_TYPE_LABELS[job.contentType] ?? job.contentType;
                      const isVideo =
                        job.result?.mime_type.startsWith('video/') || job.contentType === 'video';
                      const hasVoiceover = Boolean(job.result?.voiceover_public_url);

                      return (
                        <div
                          key={job.jobId}
                          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                        >
                          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                            <span
                              className="size-2 flex-shrink-0 rounded-full"
                              style={{ background: meta.color }}
                            />
                            <span className="truncate text-sm font-semibold text-slate-900">{meta.name}</span>
                            <span className="ml-auto flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                              {typeLabel}
                            </span>
                          </div>

                          <div className="relative aspect-[4/5] bg-slate-50">
                            {job.status === 'queued' ? (
                              <div className="h-full w-full animate-pulse bg-slate-100" />
                            ) : job.status === 'generating' ? (
                              <>
                                <div className="h-full w-full animate-pulse bg-slate-100" />
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                                  <div className="size-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
                                  <p className="text-xs font-medium text-slate-500">Generating…</p>
                                </div>
                              </>
                            ) : job.status === 'error' ? (
                              <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
                                <p className="text-xs font-medium text-red-400">Generation failed</p>
                                <p className="text-[10px] leading-relaxed text-slate-400">{job.error}</p>
                              </div>
                            ) : (
                              <div 
                                className="relative h-full w-full cursor-zoom-in"
                                onClick={() => setLightboxAsset({ 
                                  url: job.result!.public_url, 
                                  type: isVideo ? 'video' : 'image',
                                  title: `${meta.name} ${typeLabel}`
                                })}
                              >
                                {isVideo ? (
                                  <video
                                    src={job.result!.public_url}
                                    className="h-full w-full object-cover"
                                    controls={false}
                                    playsInline
                                    muted
                                    loop
                                  />
                                ) : (
                                  <img
                                    src={job.result!.public_url}
                                    alt={`${meta.name} ${typeLabel}`}
                                    className="h-full w-full object-cover"
                                  />
                                )}
                                
                                {/* Overlay Controls */}
                                <div className="absolute right-2 top-2 z-20 flex flex-col gap-2">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const ext = job.result!.mime_type.split('/')[1]?.split(';')[0] || (isVideo ? 'mp4' : 'jpg');
                                      handleDownload(job.result!.public_url, `${job.platform}-${job.contentType}.${ext}`);
                                    }}
                                    className="flex size-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60"
                                    title="Download"
                                  >
                                    <Download className="size-4" />
                                  </button>
                                </div>

                                {/* Refinement Overlay */}
                                {job.isRefining && (
                                  <div 
                                    className="absolute inset-0 z-30 flex items-end bg-black/40 p-3 backdrop-blur-[2px]"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="flex w-full flex-col gap-2 rounded-2xl bg-white/95 p-3 shadow-xl backdrop-blur-xl">
                                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Refine {typeLabel}</p>
                                      <textarea
                                        autoFocus
                                        value={job.refinePrompt ?? ''}
                                        onChange={(e) => setJobs(prev => prev.map(j => j.jobId === job.jobId ? { ...j, refinePrompt: e.target.value } : j))}
                                        placeholder="e.g. Make it warmer, add more glow..."
                                        className="min-h-[80px] w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700 outline-none focus:border-slate-300"
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleRefine(job);
                                          }
                                          if (e.key === 'Escape') {
                                            setJobs(prev => prev.map(j => j.jobId === job.jobId ? { ...j, isRefining: false } : j));
                                          }
                                        }}
                                      />
                                      <div className="flex justify-end gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setJobs(prev => prev.map(j => j.jobId === job.jobId ? { ...j, isRefining: false } : j))}
                                          className="rounded-lg px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-slate-600"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleRefine(job)}
                                          disabled={!job.refinePrompt?.trim()}
                                          className="rounded-lg bg-slate-900 px-3 py-1 text-[10px] font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
                                        >
                                          Apply
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {job.status === 'done' && (
                            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2">
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => setJobs(prev => prev.map(j => j.jobId === job.jobId ? { ...j, isRefining: true } : j))}
                                  className="flex items-center gap-1.5 rounded-lg py-1.5 text-xs font-bold text-slate-500 transition hover:text-slate-900"
                                >
                                  <RefreshCw className="size-3" />
                                  Refine
                                </button>
                                {isVideo ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setJobs((prev) =>
                                        prev.map((j) =>
                                          j.jobId === job.jobId
                                            ? {
                                                ...j,
                                                isAddingVoiceover: true,
                                                voiceoverPrompt:
                                                  j.voiceoverPrompt ??
                                                  j.result?.voiceover_text ??
                                                  j.result?.prompt ??
                                                  '',
                                                voiceoverError: undefined,
                                              }
                                            : j,
                                        ),
                                      )
                                    }
                                    className="flex items-center gap-1.5 rounded-lg py-1.5 text-xs font-bold text-slate-500 transition hover:text-slate-900"
                                  >
                                    <Volume2 className="size-3" />
                                    {hasVoiceover ? 'Update voiceover' : 'Add voiceover'}
                                  </button>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteResult(job)}
                                className="rounded-lg p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-400"
                                title="Delete"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          )}

                          {job.status === 'done' && isVideo && (job.isAddingVoiceover || hasVoiceover || job.voiceoverError) ? (
                            <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3">
                              {job.isAddingVoiceover ? (
                                <div className="space-y-2">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Gradium voiceover script
                                  </p>
                                  <textarea
                                    value={job.voiceoverPrompt ?? ''}
                                    onChange={(e) =>
                                      setJobs((prev) =>
                                        prev.map((j) =>
                                          j.jobId === job.jobId
                                            ? { ...j, voiceoverPrompt: e.target.value }
                                            : j,
                                        ),
                                      )
                                    }
                                    placeholder="Write narration text..."
                                    className="min-h-[86px] w-full resize-none rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-700 outline-none focus:border-slate-300"
                                  />
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setJobs((prev) =>
                                          prev.map((j) =>
                                            j.jobId === job.jobId
                                              ? { ...j, isAddingVoiceover: false, voiceoverError: undefined }
                                              : j,
                                          ),
                                        )
                                      }
                                      className="rounded-lg px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-slate-600"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleGenerateVoiceover(job)}
                                      disabled={!job.voiceoverPrompt?.trim() || job.isGeneratingVoiceover}
                                      className="rounded-lg bg-slate-900 px-3 py-1 text-[10px] font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
                                    >
                                      {job.isGeneratingVoiceover ? 'Generating…' : 'Generate voiceover'}
                                    </button>
                                  </div>
                                </div>
                              ) : null}

                              {hasVoiceover ? (
                                <div className={job.isAddingVoiceover ? 'mt-3' : ''}>
                                  <div className="mb-2 flex items-center justify-between gap-2">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                      Voiceover preview
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const ext = job.result?.voiceover_mime_type?.includes('ogg') ? 'ogg' : 'wav';
                                        handleDownload(
                                          job.result!.voiceover_public_url!,
                                          `${job.platform}-${job.contentType}-voiceover.${ext}`,
                                        );
                                      }}
                                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                                    >
                                      <Download className="size-3" />
                                      Download
                                    </button>
                                  </div>
                                  <audio
                                    controls
                                    preload="metadata"
                                    className="w-full"
                                    src={job.result!.voiceover_public_url ?? undefined}
                                  />
                                </div>
                              ) : null}

                              {job.voiceoverError ? (
                                <p className="mt-2 text-[11px] font-medium text-red-500">{job.voiceoverError}</p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Minimalistic context inspector toggle */}
            {!showContextDebug && (
              <button
                type="button"
                onClick={() => setShowContextDebug(true)}
                className="absolute bottom-8 left-1/2 z-30 -translate-x-1/2 flex items-center gap-1.5 rounded-full border border-slate-200/60 bg-white/50 px-3 py-1.5 text-[11px] font-medium text-slate-400 shadow-sm backdrop-blur-sm transition hover:border-slate-300 hover:bg-white/80 hover:text-slate-600"
              >
                <Code2 className="size-3" />
                context inspector
              </button>
            )}

            {/* Context inspector bottom drawer */}
            <div
              className={[
                'absolute inset-x-0 bottom-0 z-[60] max-h-[70vh] overflow-y-auto rounded-t-[28px] border-t border-white/10 bg-slate-950 shadow-[0_-32px_80px_-20px_rgba(15,23,42,0.7)] transition-transform duration-500 ease-in-out',
                showContextDebug ? 'translate-y-0' : 'translate-y-full'
              ].join(' ')}
            >
              <div className="p-6 text-slate-100">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Context Inspector</p>
                    <p className="mt-1 text-sm text-slate-300">Extracted workspace context structure.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadContext}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!contextPack || isRefreshingContext}
                    >
                      Download JSON
                    </button>
                    <button
                      type="button"
                      onClick={handleRefreshContext}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isRefreshingContext}
                    >
                      <RefreshCw className={['size-4', isRefreshingContext ? 'animate-spin' : ''].join(' ')} />
                      {isRefreshingContext ? 'Regenerating...' : 'Regenerate context'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowContextDebug(false)}
                      className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 p-2 text-slate-200 transition hover:bg-white/10"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>

                {contextPack ? (
                  <div className="grid gap-4">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Notes</p>
                        <p className="mt-3 text-3xl font-bold text-white">{contextPack.notes.length}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Templates</p>
                        <p className="mt-3 text-3xl font-bold text-white">{contextPack.templates.length}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Documents</p>
                        <p className="mt-3 text-3xl font-bold text-white">{contextPack.documents.length}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Media</p>
                        <p className="mt-3 text-3xl font-bold text-white">{contextPack.images.length + contextPack.videos.length}</p>
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Overview</p>
                        <p className="mt-3 text-sm leading-7 text-slate-200">{contextPack.overview.summary}</p>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Key Facts</p>
                            <ul className="mt-3 space-y-2 text-sm text-slate-200">
                              {contextPack.baseContext.keyFacts.slice(0, 8).map((item) => (
                                <li key={item} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">{item}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Style Signals</p>
                            <ul className="mt-3 space-y-2 text-sm text-slate-200">
                              {contextPack.baseContext.styleSignals.slice(0, 8).map((item) => (
                                <li key={item} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">{item}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Generation Intent</p>
                        <div className="mt-4 space-y-3 text-sm text-slate-200">
                          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"><span className="text-slate-400">Platforms:</span> {contextPack.generationIntent.platforms.join(', ') || 'None'}</div>
                          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"><span className="text-slate-400">Requested types:</span> {contextPack.generationIntent.requestedContentTypes.join(', ') || 'None'}</div>
                          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"><span className="text-slate-400">Selected templates:</span> {contextPack.generationIntent.selectedTemplates.join(', ') || 'None'}</div>
                          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"><span className="text-slate-400">Audiences:</span> {contextPack.generationIntent.audiences.join(', ') || 'None'}</div>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                      <div className="grid gap-4">
                        <pre className="max-h-[12vh] overflow-auto rounded-2xl border border-white/10 bg-black/20 p-3 text-xs leading-6 text-slate-200">{JSON.stringify({ overview: contextPack.overview }, null, 2)}</pre>
                        <pre className="max-h-[12vh] overflow-auto rounded-2xl border border-white/10 bg-black/20 p-3 text-xs leading-6 text-slate-200">{JSON.stringify({ notes: contextPack.notes }, null, 2)}</pre>
                        <pre className="max-h-[12vh] overflow-auto rounded-2xl border border-white/10 bg-black/20 p-3 text-xs leading-6 text-slate-200">{JSON.stringify({ templates: contextPack.templates }, null, 2)}</pre>
                        <pre className="max-h-[12vh] overflow-auto rounded-2xl border border-white/10 bg-black/20 p-3 text-xs leading-6 text-slate-200">{JSON.stringify({ documents: contextPack.documents }, null, 2)}</pre>
                        <pre className="max-h-[12vh] overflow-auto rounded-2xl border border-white/10 bg-black/20 p-3 text-xs leading-6 text-slate-200">{JSON.stringify({ images: contextPack.images, videos: contextPack.videos }, null, 2)}</pre>
                        <pre className="max-h-[12vh] overflow-auto rounded-2xl border border-white/10 bg-black/20 p-3 text-xs leading-6 text-slate-200">{JSON.stringify({ generatedContent: contextPack.generatedContent }, null, 2)}</pre>
                      </div>
                      <div className="grid gap-4">
                        <pre className="max-h-[18vh] overflow-auto rounded-2xl border border-white/10 bg-black/20 p-3 text-xs leading-6 text-slate-200">{JSON.stringify({ baseContext: contextPack.baseContext }, null, 2)}</pre>
                        <pre className="max-h-[18vh] overflow-auto rounded-2xl border border-white/10 bg-black/20 p-3 text-xs leading-6 text-slate-200">{JSON.stringify({ generationIntent: contextPack.generationIntent }, null, 2)}</pre>
                        <pre className="max-h-[24vh] overflow-auto rounded-2xl border border-white/10 bg-black/20 p-3 text-xs leading-6 text-slate-200">
                          {JSON.stringify(
                            contextPack.sourceArtifacts.map((artifact) => ({
                              sourceNodeId: artifact.sourceNodeId,
                              sourceType: artifact.sourceType,
                              title: artifact.title,
                              summary: artifact.summary,
                            })),
                            null,
                            2,
                          )}
                        </pre>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-[160px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/10 p-6 text-center text-sm text-slate-400">
                    {contextError ? (
                      <span className="text-red-300">{contextError}</span>
                    ) : (
                      'Regenerate the context to inspect the extracted workspace structure.'
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {activePanel === 'upload' ? (
        <WorkspaceActionPanel
          title="Upload From Your Machine"
          description="Choose images, videos, or documents. Each file will appear as its own asset on the canvas."
          onClose={closePanel}
        >
          <div className="flex flex-col gap-4">
            {actionError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {actionError}
              </div>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.txt"
              onChange={(event) =>
                setSelectedFiles(Array.from(event.target.files ?? []))
              }
              className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600 file:mr-4 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
            />
            {selectedFiles.length ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-sm font-medium text-slate-900">
                  Files ready for the canvas
                </p>
                <div className="flex flex-col gap-2">
                  {selectedFiles.map((file) => (
                    <div
                      key={`${file.name}-${file.lastModified}`}
                      className="truncate rounded-2xl bg-white px-3 py-2 text-sm text-slate-600"
                      title={file.name}
                    >
                      {trimLabel(file.name)}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleUploadSubmit}
                className="rounded-full bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!selectedFiles.length || isUploading}
              >
                {isUploading ? 'Uploading...' : 'Add to canvas'}
              </button>
              <button
                type="button"
                onClick={closePanel}
                className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition hover:text-slate-900"
              >
                Cancel
              </button>
            </div>
          </div>
        </WorkspaceActionPanel>
      ) : null}

      {activePanel === 'generate' ? (
        <WorkspaceActionPanel
          title="Generate Content"
          description="Choose a generator, describe the asset, and a node will appear immediately while it renders on the canvas."
          onClose={closePanel}
        >
          <div className="flex flex-col gap-4">
            {actionError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {actionError}
              </div>
            ) : null}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-700">Generator</span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setGenerateType('image')}
                  className={[
                    'flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition',
                    generateType === 'image'
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                  ].join(' ')}
                >
                  <ImageIcon className="size-4" />
                  Nano Banana
                </button>
                <button
                  type="button"
                  onClick={() => setGenerateType('video')}
                  className={[
                    'flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition',
                    generateType === 'video'
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                  ].join(' ')}
                >
                  <Video className="size-4" />
                  Veo
                </button>
                <button
                  type="button"
                  onClick={() => setGenerateType('animation')}
                  className={[
                    'flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition',
                    generateType === 'animation'
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                  ].join(' ')}
                >
                  <Sparkles className="size-4" />
                  Hera
                </button>
              </div>
            </div>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-700">Prompt</span>
              <textarea
                value={generatePrompt}
                onChange={(event) => setGeneratePrompt(event.target.value)}
                placeholder="A premium hero visual for a smart bottle on a marble desk at sunrise..."
                className="min-h-28 resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleGenerateSubmit}
                className="rounded-full bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!generatePrompt.trim()}
              >
                Add to canvas
              </button>
              <button
                type="button"
                onClick={closePanel}
                className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition hover:text-slate-900"
              >
                Cancel
              </button>
            </div>
          </div>
        </WorkspaceActionPanel>
      ) : null}

      {activePanel === 'scrape' ? (
        <WorkspaceActionPanel
          title="Scrape With Tavily"
          description="Enter what you want to research. The board will add a search result note and optionally an image stack."
          onClose={closePanel}
        >
          <div className="flex flex-col gap-4">
            {actionError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {actionError}
              </div>
            ) : null}
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-700">What should Tavily look for?</span>
              <textarea
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Best landing pages for wellness product launches"
                className="min-h-24 resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
              />
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={includeImages}
                onChange={(event) => setIncludeImages(event.target.checked)}
                className="size-4 rounded border-slate-300"
              />
              Include images and add them as a stack on the canvas
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleScrapeSubmit}
                className="rounded-full bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!searchQuery.trim() || isSearching}
              >
                {isSearching ? 'Searching...' : 'Add Tavily output'}
              </button>
              <button
                type="button"
                onClick={closePanel}
                className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition hover:text-slate-900"
              >
                Cancel
              </button>
            </div>
          </div>
        </WorkspaceActionPanel>
      ) : null}

      {activePanel === 'template' ? (
        <WorkspaceActionPanel
          title="Templates"
          description="Click a template to add it to your board."
          onClose={closePanel}
        >
          <TemplateGallery
            templates={contentTemplates}
            onSelect={handleTemplateSubmit}
            isApplying={isApplyingTemplate}
          />
        </WorkspaceActionPanel>
      ) : null}

      {lightboxAsset && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4 md:p-10"
          onClick={() => setLightboxAsset(null)}
        >
          <button
            onClick={() => setLightboxAsset(null)}
            className="absolute right-6 top-6 z-[110] flex size-12 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <X className="size-6" />
          </button>
          
          <div 
            className="relative flex max-h-full max-w-full flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex w-full items-center justify-between px-2 text-white">
              <h3 className="text-lg font-bold">{lightboxAsset.title}</h3>
              <button
                onClick={() => handleDownload(lightboxAsset.url, lightboxAsset.title.replace(/\s+/g, '-').toLowerCase())}
                className="flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-bold text-slate-900 transition hover:bg-slate-100"
              >
                <Download className="size-4" />
                Download
              </button>
            </div>

            <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl shadow-2xl">
              {lightboxAsset.type === 'video' ? (
                <video
                  src={lightboxAsset.url}
                  className="max-h-[80vh] w-auto max-w-full rounded-xl object-contain shadow-2xl"
                  controls
                  autoPlay
                  playsInline
                  loop
                />
              ) : (
                <img
                  src={lightboxAsset.url}
                  alt={lightboxAsset.title}
                  className="max-h-[80vh] w-auto max-w-full rounded-xl object-contain shadow-2xl"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {currentStep === 1 ? (
        <FloatingToolbar
          currentStep={currentStep}
          actions={brainstormActions}
        />
      ) : null}
    </div>
  );
}
