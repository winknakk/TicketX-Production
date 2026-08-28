import React, { useState, useEffect, useMemo } from 'react';
import {
  Send,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  Settings,
  Shield,
  Layers,
  Globe,
  Sliders,
  Trash2,
  Eye,
  EyeOff,
  Power,
  Server,
  KeyRound,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '../../lib/apiFetch';
import { API_BASE_URL } from '../../lib/apiBaseUrl';



export interface PlaneMappingItem {
  id: number;
  projectId: number;
  projectName: string;
  orgId: string;
  workspaceSlug: string;
  planeProjectId: string;
  apiBaseUrl: string;
  credentialStatus: 'configured' | 'not_configured';
  connectionStatus: 'CONNECTED' | 'FAILED' | 'DISABLED';
  lastTestedAt: string | null;
  lastErrorCode: string | null;
  lastSuccessfulSyncAt: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectOption {
  id: number;
  name: string;
  org_id?: string;
  company_id?: number;
}

export function PlaneIntegrationsManagement() {
  const [mappings, setMappings] = useState<PlaneMappingItem[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<PlaneMappingItem | null>(null);

  // Form State
  const [formProjectId, setFormProjectId] = useState<number | ''>('');
  const [formServerType, setFormServerType] = useState<'cloud' | 'self_hosted'>('self_hosted');
  const [formApiBaseUrl, setFormApiBaseUrl] = useState('https://projects.oneweb.tech');
  const [formWorkspaceSlug, setFormWorkspaceSlug] = useState('');
  const [formPlaneProjectId, setFormPlaneProjectId] = useState('');
  const [formSecret, setFormSecret] = useState('');
  const [isReplacingSecret, setIsReplacingSecret] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  // Test Connection State
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: 'CONNECTED' | 'FAILED';
    message?: string;
    project?: { id: string; name: string; identifier?: string };
    capabilities?: { read: boolean; create_issue: boolean; update_issue: boolean };
    statesCount?: number;
    testedAt?: string;
    errorCode?: string;
  } | null>(null);

  // Status Action Loading
  const [testingRowId, setTestingRowId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Fetch all mappings and available projects
  const fetchData = async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      const [mappingsRes, projectsRes] = await Promise.all([
        apiFetch(`${API_BASE_URL}/api/v1/admin/plane-integrations`).then(r => r.json()),
        apiFetch(`${API_BASE_URL}/api/v1/admin/master-data/projects`).then(r => r.json()).catch(() => ({ success: true, projects: [] }))
      ]);

      if (mappingsRes && mappingsRes.mappings) {
        setMappings(mappingsRes.mappings);
      }
      if (projectsRes && projectsRes.projects) {
        setProjects(projectsRes.projects);
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to fetch Plane integrations');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Stats calculation
  const stats = useMemo(() => {
    const connected = mappings.filter(m => m.enabled && m.connectionStatus === 'CONNECTED').length;
    const failed = mappings.filter(m => m.enabled && m.connectionStatus === 'FAILED').length;
    const disabled = mappings.filter(m => !m.enabled || m.connectionStatus === 'DISABLED').length;
    const total = mappings.length;
    return { connected, failed, disabled, total };
  }, [mappings]);

  // Filtered mappings
  const filteredMappings = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return mappings;
    return mappings.filter(m =>
      m.projectName.toLowerCase().includes(q) ||
      m.workspaceSlug.toLowerCase().includes(q) ||
      m.planeProjectId.toLowerCase().includes(q) ||
      String(m.projectId).includes(q) ||
      m.orgId.toLowerCase().includes(q)
    );
  }, [mappings, search]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openCreateModal = () => {
    setEditingMapping(null);
    setFormProjectId(projects[0]?.id || '');
    setFormServerType('self_hosted');
    setFormApiBaseUrl('https://projects.oneweb.tech');
    setFormWorkspaceSlug('');
    setFormPlaneProjectId('');
    setFormSecret('');
    setIsReplacingSecret(false);
    setShowSecret(false);
    setTestResult(null);
    setIsModalOpen(true);
  };

  const openEditModal = (mapping: PlaneMappingItem) => {
    setEditingMapping(mapping);
    setFormProjectId(mapping.projectId);
    const isCloud = mapping.apiBaseUrl.includes('api.plane.so');
    setFormServerType(isCloud ? 'cloud' : 'self_hosted');
    setFormApiBaseUrl(mapping.apiBaseUrl);
    setFormWorkspaceSlug(mapping.workspaceSlug);
    setFormPlaneProjectId(mapping.planeProjectId);
    setFormSecret('');
    setIsReplacingSecret(false);
    setShowSecret(false);
    setTestResult(null);
    setIsModalOpen(true);
  };

  // Run Non-destructive Test in Modal
  const handleTestInModal = async () => {
    if (!formWorkspaceSlug || !formPlaneProjectId) {
      setTestResult({
        status: 'FAILED',
        message: 'Please fill Workspace Slug and Plane Project ID first'
      });
      return;
    }
    if (!editingMapping && !formSecret) {
      setTestResult({
        status: 'FAILED',
        message: 'Please provide a Plane API Key to test'
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    try {
      const payload: any = {
        workspaceSlug: formWorkspaceSlug,
        planeProjectId: formPlaneProjectId,
        apiBaseUrl: formApiBaseUrl,
      };
      if (formSecret) {
        payload.credential = { type: 'plane_api_key', secret: formSecret };
      }

      const res = await apiFetch(`${API_BASE_URL}/api/v1/admin/projects/${formProjectId || 0}/plane-integration/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(r => r.json());

      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        status: 'FAILED',
        errorCode: 'NETWORK_ERROR',
        message: err.message || 'Connection test failed'
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Run Inline Test for Table Row
  const handleTestRow = async (mapping: PlaneMappingItem) => {
    setTestingRowId(mapping.id);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/v1/admin/projects/${mapping.projectId}/plane-integration/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      }).then(r => r.json());

      if (res.status === 'CONNECTED') {
        setActionSuccess(`Project ${mapping.projectName}: Connected to Plane (${res.project?.name || res.workspace})`);
      } else {
        setActionError(`Project ${mapping.projectName}: Connection failed (${res.errorCode || res.message})`);
      }
      fetchData();
    } catch (err: any) {
      setActionError(`Test failed for ${mapping.projectName}: ${err.message}`);
    } finally {
      setTestingRowId(null);
    }
  };

  // Toggle Enable / Disable
  const handleToggleStatus = async (mapping: PlaneMappingItem) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      await apiFetch(`${API_BASE_URL}/api/v1/admin/projects/${mapping.projectId}/plane-integration/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !mapping.enabled })
      }).then(r => r.json());
      setActionSuccess(`Plane integration ${mapping.enabled ? 'disabled' : 'enabled'} for ${mapping.projectName}`);
      fetchData();
    } catch (err: any) {
      setActionError(`Failed to update status: ${err.message}`);
    }
  };

  // Archive Mapping (Soft Delete)
  const handleArchive = async (mapping: PlaneMappingItem) => {
    if (!window.confirm(`Are you sure you want to archive the Plane integration for "${mapping.projectName}"? Historical tickets will remain preserved.`)) {
      return;
    }
    setActionError(null);
    setActionSuccess(null);
    try {
      await apiFetch(`${API_BASE_URL}/api/v1/admin/projects/${mapping.projectId}/plane-integration`, {
        method: 'DELETE'
      }).then(r => r.json());
      setActionSuccess(`Plane integration archived for ${mapping.projectName}`);
      fetchData();
    } catch (err: any) {
      setActionError(`Failed to archive: ${err.message}`);
    }
  };

  // Save Mapping (Create or Update)
  const handleSaveMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProjectId) {
      alert('Please select a project');
      return;
    }

    try {
      const payload: any = {
        workspaceSlug: formWorkspaceSlug,
        planeProjectId: formPlaneProjectId,
        apiBaseUrl: formApiBaseUrl,
      };

      if (formSecret && (isReplacingSecret || !editingMapping)) {
        payload.credential = {
          type: 'plane_api_key',
          secret: formSecret,
        };
      }

      if (editingMapping) {
        await apiFetch(`${API_BASE_URL}/api/v1/admin/projects/${editingMapping.projectId}/plane-integration`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).then(r => r.json());
        setActionSuccess(`Plane integration updated for Project #${formProjectId}`);
      } else {
        await apiFetch(`${API_BASE_URL}/api/v1/admin/projects/${formProjectId}/plane-integration`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).then(r => r.json());
        setActionSuccess(`Plane integration connected for Project #${formProjectId}`);
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Title */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
              <Send className="h-5 w-5 rotate-[-20deg]" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                Plane.so Integrations Center
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
                Project-centric workspace routing and bidirectional ticket synchronization (ADR-019)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Connect Plane Project
          </Button>
        </div>
      </div>

      {/* Alert Notifications */}
      {actionSuccess && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="flex-1 font-medium">{actionSuccess}</p>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-600 hover:text-emerald-900 dark:text-emerald-400">×</button>
        </div>
      )}

      {actionError && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <p className="flex-1 font-medium">{actionError}</p>
          <button onClick={() => setActionError(null)} className="text-rose-600 hover:text-rose-900 dark:text-rose-400">×</button>
        </div>
      )}

      {/* Overview KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Connected
            </span>
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{stats.connected}</p>
          <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">Active & Resolving</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Disconnected / Failed
            </span>
            <span className="flex h-2 w-2 rounded-full bg-rose-500 ring-4 ring-rose-500/20" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{stats.failed}</p>
          <p className="mt-0.5 text-xs text-rose-600 dark:text-rose-400">Requires Attention</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Disabled
            </span>
            <span className="flex h-2 w-2 rounded-full bg-slate-400 ring-4 ring-slate-400/20" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{stats.disabled}</p>
          <p className="mt-0.5 text-xs text-slate-500">Temporarily Paused</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Mappings
            </span>
            <Layers className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
          <p className="mt-0.5 text-xs text-indigo-600 dark:text-indigo-400">Project Scopes</p>
        </div>
      </div>

      {/* Filter and Table Container */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-200/80 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by project or workspace..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Showing {filteredMappings.length} of {mappings.length} project integrations
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="border-b border-slate-200/80 bg-slate-50/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3.5">TicketX Project</th>
                <th className="px-4 py-3.5">Tenant / Org</th>
                <th className="px-4 py-3.5">Plane Workspace</th>
                <th className="px-4 py-3.5">Plane Project ID</th>
                <th className="px-4 py-3.5">Server URL</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Last Tested</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {filteredMappings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Send className="mx-auto mb-2 h-8 w-8 text-slate-300 dark:text-slate-600" />
                    <p className="font-semibold">No Plane integrations found</p>
                    <p className="text-xs mt-1">Connect your first project mapping using the button above.</p>
                  </td>
                </tr>
              ) : (
                filteredMappings.map((m) => {
                  const isConnected = m.enabled && m.connectionStatus === 'CONNECTED';
                  const isFailed = m.enabled && m.connectionStatus === 'FAILED';
                  const isDisabled = !m.enabled || m.connectionStatus === 'DISABLED';
                  const isTestingThis = testingRowId === m.id;

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            #{m.projectId} {m.projectName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {m.orgId}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-indigo-600 dark:text-indigo-400">
                        {m.workspaceSlug}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 font-mono text-xs text-slate-500">
                          <span>{m.planeProjectId.slice(0, 8)}...{m.planeProjectId.slice(-4)}</span>
                          <button
                            onClick={() => handleCopy(m.planeProjectId, `proj-${m.id}`)}
                            title="Copy UUID"
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          >
                            {copiedId === `proj-${m.id}` ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500">
                        <span className="truncate max-w-[160px] inline-block" title={m.apiBaseUrl}>
                          {m.apiBaseUrl.replace('https://', '')}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {isConnected && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Connected
                          </span>
                        )}
                        {isFailed && (
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                            title={m.lastErrorCode || 'Authentication failed'}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            Failed ({m.lastErrorCode || 'ERR'})
                          </span>
                        )}
                        {isDisabled && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                            Disabled
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-400">
                        {m.lastTestedAt ? new Date(m.lastTestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTestRow(m)}
                            disabled={isTestingThis}
                            title="Test Connection"
                            className="h-8 px-2 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/50"
                          >
                            <Sparkles className={`h-3.5 w-3.5 ${isTestingThis ? 'animate-spin' : ''}`} />
                            <span className="ml-1 text-xs">Test</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(m)}
                            title="Configure Mapping"
                            className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                          >
                            <Settings className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(m)}
                            title={m.enabled ? 'Disable Mapping' : 'Enable Mapping'}
                            className={`h-8 w-8 p-0 ${m.enabled ? 'text-emerald-600 hover:text-rose-600' : 'text-slate-400 hover:text-emerald-600'}`}
                          >
                            <Power className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleArchive(m)}
                            title="Archive Mapping"
                            className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Mapping Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Send className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editingMapping ? `Configure Plane for ${editingMapping.projectName}` : 'Connect New Plane Project'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveMapping} className="mt-5 space-y-4">
              {/* Project Selector */}
              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  TicketX Project
                </Label>
                {editingMapping ? (
                  <Input
                    value={`#${editingMapping.projectId} - ${editingMapping.projectName} (${editingMapping.orgId})`}
                    disabled
                    className="mt-1.5 bg-slate-50 font-semibold dark:bg-slate-800 text-sm"
                  />
                ) : (
                  <select
                    value={formProjectId}
                    onChange={(e) => setFormProjectId(Number(e.target.value))}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                    required
                  >
                    <option value="" disabled>Select a TicketX Project</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        #{p.id} - {p.name} ({p.org_id || 'org_default'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Server Type & Base URL */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Server Type
                  </Label>
                  <select
                    value={formServerType}
                    onChange={(e) => {
                      const st = e.target.value as 'cloud' | 'self_hosted';
                      setFormServerType(st);
                      setFormApiBaseUrl(st === 'cloud' ? 'https://api.plane.so' : 'https://projects.oneweb.tech');
                    }}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  >
                    <option value="self_hosted">Self-hosted</option>
                    <option value="cloud">Plane Cloud</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Base URL
                  </Label>
                  <Input
                    value={formApiBaseUrl}
                    onChange={(e) => setFormApiBaseUrl(e.target.value)}
                    placeholder="https://api.plane.so"
                    className="mt-1.5 text-sm font-mono"
                    required
                  />
                </div>
              </div>

              {/* Workspace Slug & Project ID */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Plane Workspace Slug
                  </Label>
                  <Input
                    value={formWorkspaceSlug}
                    onChange={(e) => setFormWorkspaceSlug(e.target.value)}
                    placeholder="e.g. cs-team"
                    className="mt-1.5 text-sm"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Plane Project ID (UUID)
                  </Label>
                  <Input
                    value={formPlaneProjectId}
                    onChange={(e) => setFormPlaneProjectId(e.target.value)}
                    placeholder="e.g. e3454524-961a..."
                    className="mt-1.5 text-sm font-mono"
                    required
                  />
                </div>
              </div>

              {/* Credential Key Field */}
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Plane API Key (Secret)
                  </Label>
                  {editingMapping && !isReplacingSecret && (
                    <button
                      type="button"
                      onClick={() => setIsReplacingSecret(true)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                    >
                      Replace Key
                    </button>
                  )}
                </div>

                {editingMapping && !isReplacingSecret ? (
                  <div className="mt-1.5 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
                    <span className="font-mono">●●●●●●●●●●●●●●●●●●●●</span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      <Shield className="h-3 w-3" /> Configured
                    </span>
                  </div>
                ) : (
                  <div className="relative mt-1.5">
                    <Input
                      type={showSecret ? 'text' : 'password'}
                      value={formSecret}
                      onChange={(e) => setFormSecret(e.target.value)}
                      placeholder="plane_api_xxxxxxxx..."
                      className="pr-10 text-sm font-mono"
                      required={!editingMapping || isReplacingSecret}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                )}
              </div>

              {/* Test Connection Output Box */}
              {testResult && (
                <div
                  className={`rounded-xl border p-3.5 text-xs ${
                    testResult.status === 'CONNECTED'
                      ? 'border-emerald-200 bg-emerald-50/80 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'border-rose-200 bg-rose-50/80 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold">
                    {testResult.status === 'CONNECTED' ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Connected to Plane: {testResult.project?.name} ({testResult.project?.identifier || 'OK'})</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                        <span>Connection Failed: {testResult.errorCode || 'ERROR'}</span>
                      </>
                    )}
                  </div>
                  {testResult.message && <p className="mt-1">{testResult.message}</p>}
                  {testResult.capabilities && (
                    <p className="mt-1.5 font-mono text-[11px] opacity-80">
                      Capabilities: Read ({testResult.capabilities.read ? '✓' : '✗'}), Create ({testResult.capabilities.create_issue ? '✓' : '✗'}), Update ({testResult.capabilities.update_issue ? '✓' : '✗'}) · {testResult.statesCount} States
                    </p>
                  )}
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestInModal}
                  disabled={isTesting}
                  className="flex items-center gap-1.5 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/50"
                >
                  <Sparkles className={`h-4 w-4 ${isTesting ? 'animate-spin' : ''}`} />
                  {isTesting ? 'Testing...' : 'Test Connection'}
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    Save Mapping
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
