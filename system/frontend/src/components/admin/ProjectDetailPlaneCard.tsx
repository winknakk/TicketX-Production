import React, { useState, useEffect } from 'react';
import {
  Send,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Settings,
  RefreshCw,
  Sparkles,
  Shield,
  Layers,
  Copy,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '../../lib/apiFetch';
import { API_BASE_URL } from '../../lib/apiBaseUrl';



interface ProjectDetailPlaneCardProps {
  projectId: number;
  projectName?: string;
  onOpenManagementModal?: () => void;
}

export function ProjectDetailPlaneCard({
  projectId,
  projectName = 'Project',
  onOpenManagementModal
}: ProjectDetailPlaneCardProps) {
  const [mapping, setMapping] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchMapping = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/v1/admin/projects/${projectId}/plane-integration`).then(r => r.json());
      if (res && res.mapping) {
        setMapping(res.mapping);
      } else {
        setMapping(null);
      }
    } catch {
      setMapping(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) fetchMapping();
  }, [projectId]);

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/v1/admin/projects/${projectId}/plane-integration/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      }).then(r => r.json());
      setTestResult(res);
      fetchMapping();
    } catch (err: any) {
      setTestResult({ status: 'FAILED', message: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 animate-pulse">
        <div className="h-5 w-40 bg-slate-200 dark:bg-slate-800 rounded mb-4" />
        <div className="h-20 bg-slate-100 dark:bg-slate-800/50 rounded" />
      </div>
    );
  }

  const isConnected = mapping?.enabled && mapping?.connectionStatus === 'CONNECTED';
  const planeUrl = mapping
    ? `${mapping.apiBaseUrl.replace('api.', 'app.')}/${mapping.workspaceSlug}/projects/${mapping.planeProjectId}/issues`
    : '#';

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
            <Send className="h-4 w-4 rotate-[-20deg]" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
              Plane.so Integration
            </h3>
            <p className="text-xs text-slate-500">Real-time issue synchronization for {projectName}</p>
          </div>
        </div>

        <div>
          {mapping ? (
            isConnected ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                Disconnected
              </span>
            )
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              Not Configured
            </span>
          )}
        </div>
      </div>

      {mapping ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800/80 dark:bg-slate-800/40">
              <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Workspace Slug</span>
              <p className="mt-1 font-bold text-slate-800 dark:text-slate-200 text-sm">{mapping.workspaceSlug}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800/80 dark:bg-slate-800/40">
              <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Plane Project ID</span>
              <div className="mt-1 flex items-center justify-between font-mono text-slate-700 dark:text-slate-300">
                <span className="truncate">{mapping.planeProjectId.slice(0, 14)}...</span>
                <button
                  onClick={() => handleCopy(mapping.planeProjectId)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 ml-1"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 pt-1">
            <span className="font-mono">Server: {mapping.apiBaseUrl}</span>
            <span>
              Last Tested: {mapping.lastTestedAt ? new Date(mapping.lastTestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
            </span>
          </div>

          {testResult && (
            <div
              className={`rounded-xl border p-3 text-xs ${
                testResult.status === 'CONNECTED'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300'
              }`}
            >
              <p className="font-bold">
                {testResult.status === 'CONNECTED' ? `✓ Connected to ${testResult.project?.name || mapping.workspaceSlug}` : `✗ Error: ${testResult.errorCode || testResult.message}`}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <a
              href={planeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open in Plane
            </a>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={isTesting}
                className="h-8 text-xs flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400"
              >
                <Sparkles className={`h-3.5 w-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                {isTesting ? 'Testing...' : 'Test Connection'}
              </Button>

              {onOpenManagementModal && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onOpenManagementModal}
                  className="h-8 text-xs flex items-center gap-1.5 text-slate-700 dark:text-slate-300"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Configure
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center dark:border-slate-800">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            No Plane workspace mapped to this project yet.
          </p>
          {onOpenManagementModal && (
            <Button
              size="sm"
              onClick={onOpenManagementModal}
              className="mt-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
            >
              Connect to Plane
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
