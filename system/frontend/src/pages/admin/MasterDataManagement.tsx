import { apiFetch } from '../../lib/apiFetch';
import React, { useEffect, useState } from 'react';
import {
  Building2,
  Users,
  Smartphone,
  ShieldCheck,
  Plus,
  RefreshCw,
  Trash2,
  Layers,
  Server,
  Shield,
  Send,
} from 'lucide-react';
import { CenterIamManagement } from '../../components/admin/CenterIamManagement';
import { PlaneIntegrationsManagement } from '../../components/admin/PlaneIntegrationsManagement';
import { ProjectDetailPlaneCard } from '../../components/admin/ProjectDetailPlaneCard';
import { API_BASE_URL } from '../../lib/apiBaseUrl';
import {
  Button,
  DataState,
  InlineAlert,
  PageHeader,
  SearchField,
  StatusBadge,
} from '../../components/ui/Primitives';

interface Project {
  id: number;
  company_id: number;
  name: string;
  project_type: string;
  environment: string;
  created_at?: string;
}

interface Customer {
  id: number;
  project_id: number;
  project_name?: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
}

interface LineIdentity {
  id: number;
  line_user_id: string;
  customer_id: number;
  project_id: number;
  is_verified: boolean;
  company_name?: string;
  contact_name?: string;
  project_name?: string;
}

export function MasterDataManagement() {
  const [activeTab, setActiveTab] = useState<'projects' | 'customers' | 'identities' | 'organizations' | 'roles' | 'center_iam' | 'plane_integrations'>('center_iam');
  const [organizations, setOrganizations] = useState<any[]>([
    { id: 'org_default', name: 'Default Organization', slug: 'default', status: 'active', created_at: '2026-08-01' },
    { id: 'org_avalant', name: 'Avalant Co.,Ltd.', slug: 'avalant', status: 'active', created_at: '2026-08-05' },
    { id: 'org_demo', name: 'Demo Tenant', slug: 'demo', status: 'active', created_at: '2026-08-05' },
  ]);
  const [userRoles, setUserRoles] = useState<any[]>([
    { id: '1', user_email: 'super_admin@ticketx.io', role: 'super_admin', org_id: 'All Orgs (Overseer)', status: 'Active' },
    { id: '2', user_email: 'org_admin@avalant.co.th', role: 'admin', org_id: 'org_avalant', status: 'Active' },
    { id: '3', user_email: 'support_agent@avalant.co.th', role: 'employee', org_id: 'org_avalant', status: 'Active' },
    { id: '4', user_email: 'customer@avalant.co.th', role: 'customer', org_id: 'org_avalant', status: 'Active' },
  ]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [identities, setIdentities] = useState<LineIdentity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);

  // Modals state
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showAddIdentityModal, setShowAddIdentityModal] = useState(false);

  // Form States
  const [newCustomer, setNewCustomer] = useState({
    project_id: 1,
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
  });

  const [newIdentity, setNewIdentity] = useState({
    line_user_id: '',
    customer_id: 1,
    project_id: 1,
  });

  const [gitReposMap, setGitReposMap] = useState<Record<number, any[]>>({});
  const [gitFormProjectId, setGitFormProjectId] = useState<number | null>(null);
  const [newGitRepo, setNewGitRepo] = useState({
    repoUrl: '',
    provider: 'github',
    defaultBranch: 'main',
  });

  const apiBaseUrl = API_BASE_URL;

  const fetchGitRepos = async (projectId: number) => {
    try {
      const res = await apiFetch(`/api/v1/internal/projects/${projectId}/git-repositories`, {
        headers: { 'x-org-id': 'org_default' },
      });
      if (res.ok) {
        const data = await res.json();
        setGitReposMap((prev) => ({ ...prev, [projectId]: data.data || [] }));
      }
    } catch (err: any) {
      console.warn(`[MasterDataManagement] Git repo fetch for project ${projectId} failed:`, err.message);
    }
  };

  const handleConnectGitRepo = async (projectId: number) => {
    if (!newGitRepo.repoUrl.trim()) return;
    try {
      const res = await apiFetch(`/api/v1/internal/projects/${projectId}/git-repositories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': 'org_default',
        },
        body: JSON.stringify(newGitRepo),
      });

      if (!res.ok) {
        const errJson = await res.json();
        alert(`Failed to connect repository: ${errJson.error || 'Invalid URL or permissions'}`);
        return;
      }

      setNewGitRepo({ repoUrl: '', provider: 'github', defaultBranch: 'main' });
      setGitFormProjectId(null);
      await fetchGitRepos(projectId);
    } catch (err: any) {
      alert(`Error connecting repository: ${err.message}`);
    }
  };

  const handleDisconnectGitRepo = async (projectId: number, repoId: string) => {
    if (!confirm('Are you sure you want to disconnect this Git repository?')) return;
    try {
      const res = await apiFetch(`/api/v1/internal/projects/${projectId}/git-repositories/${repoId}`, {
        method: 'DELETE',
        headers: { 'x-org-id': 'org_default' },
      });

      if (res.ok) {
        await fetchGitRepos(projectId);
      }
    } catch (err: any) {
      alert(`Failed to disconnect repository: ${err.message}`);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [projRes, custRes, idenRes] = await Promise.all([
        fetch(`${apiBaseUrl}/api/v1/admin/master-data/projects`).then((r) => r.json()),
        fetch(`${apiBaseUrl}/api/v1/admin/master-data/customers`).then((r) => r.json()),
        fetch(`${apiBaseUrl}/api/v1/admin/master-data/identities`).then((r) => r.json()),
      ]);

      if (projRes.success) setProjects(projRes.projects || []);
      else setError(projRes.error || 'Failed to fetch projects');

      if (custRes.success) setCustomers(custRes.customers || []);

      if (idenRes.success) setIdentities(idenRes.identities || []);
    } catch (err: any) {
      console.error('Failed to fetch master data:', err);
      setError('Could not connect to PostgreSQL master data endpoints');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Add Customer Submit
  const handleAddCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch(`${apiBaseUrl}/api/v1/admin/master-data/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomer),
      }).then((r) => r.json());

      if (res.success && res.customer) {
        const projName = projects.find((p) => p.id === Number(newCustomer.project_id))?.name || 'Project';
        setCustomers((prev) => [...prev, { ...res.customer, project_name: projName }]);
        setShowAddCustomerModal(false);
        setNewCustomer({ project_id: projects[0]?.id || 1, company_name: '', contact_name: '', email: '', phone: '' });
      }
    } catch (err) {
      console.error('Error creating customer:', err);
    }
  };

  // Add Line Identity Mapping Submit
  const handleAddIdentitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch(`${apiBaseUrl}/api/v1/admin/master-data/identities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newIdentity),
      }).then((r) => r.json());

      if (res.success) {
        fetchData();
        setShowAddIdentityModal(false);
        setNewIdentity({ line_user_id: '', customer_id: customers[0]?.id || 1, project_id: projects[0]?.id || 1 });
      }
    } catch (err) {
      console.error('Error mapping identity:', err);
    }
  };

  // Delete Line Identity Mapping
  const handleDeleteIdentity = async (id: number) => {
    try {
      const res = await apiFetch(`${apiBaseUrl}/api/v1/admin/master-data/identities/${id}`, {
        method: 'DELETE',
      }).then((r) => r.json());

      if (res.success) {
        setIdentities((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (err) {
      console.error('Error deleting mapping:', err);
    }
  };

  const filteredProjects = projects.filter((p) =>
    `${p.name} ${p.project_type} ${p.environment}`.toLowerCase().includes(search.toLowerCase())
  );

  const filteredCustomers = customers
    .filter((c) => !selectedProjectId || c.project_id === selectedProjectId)
    .filter((c) =>
      `${c.company_name} ${c.contact_name} ${c.email} ${c.phone}`.toLowerCase().includes(search.toLowerCase())
    );

  const filteredIdentities = identities
    .filter((i) => !selectedProjectId || i.project_id === selectedProjectId)
    .filter((i) => !selectedCustomerId || i.customer_id === selectedCustomerId)
    .filter((i) =>
      `${i.line_user_id} ${i.company_name} ${i.contact_name} ${i.project_name}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );

  return (
    <div className="page-scroll space-y-6">
      {/* Header Bar matching TicketX design system */}
      <PageHeader
        eyebrow="Directory Explorer"
        title="Directory & Project Explorer"
        description="Explore multi-tenant projects, corporate accounts, customer profiles, and channel identities."
        actions={
          <div className="flex items-center gap-3">
            <SearchField
              label="Search records"
              placeholder="Search directory records..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-64"
            />
            <Button variant="secondary" onClick={fetchData} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Sync DB
            </Button>
            {activeTab === 'customers' && (
              <Button onClick={() => setShowAddCustomerModal(true)}>
                <Plus className="h-4 w-4" />
                Add Company
              </Button>
            )}
            {activeTab === 'identities' && (
              <Button onClick={() => setShowAddIdentityModal(true)}>
                <Plus className="h-4 w-4" />
                Bind LINE ID
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => setActiveTab('center_iam')}
              className="gap-2 border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40"
            >
              <Shield className="h-4 w-4" />
              <span>Center IAM Console</span>
            </Button>
          </div>
        }
      />

      <InlineAlert tone="information" title="Multi-Tenant Relational Explorer">
        Explore projects, corporate accounts, and LINE channel identities directly from PostgreSQL database tables.
      </InlineAlert>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('projects')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'projects'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>Projects ({projects.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('customers')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'customers'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Companies ({filteredCustomers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('organizations')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'organizations'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Building2 className="h-4 w-4 text-blue-400" />
          <span>Organizations ({organizations.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('roles')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'roles'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>User Roles & RBAC ({userRoles.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('identities')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'identities'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Smartphone className="h-4 w-4" />
          <span>Identities & Bindings ({filteredIdentities.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('center_iam')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'center_iam'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Shield className="h-4 w-4 text-purple-400" />
          <span>Center IAM Management</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('plane_integrations')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'plane_integrations'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Send className="h-4 w-4 text-indigo-400 rotate-[-20deg]" />
          <span>Plane Integrations</span>
        </button>
      </div>

      {/* Breadcrumb Filter Chips */}
      {(selectedProjectId !== null || selectedCustomerId !== null) && (
        <div className="flex items-center gap-2 bg-muted/40 p-2.5 rounded-lg border border-border text-xs">
          <span className="text-muted-foreground font-medium">Drill-down filter:</span>
          {selectedProjectId !== null && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-semibold">
              Project: {projects.find((p) => p.id === selectedProjectId)?.name || `#${selectedProjectId}`}
              <button
                type="button"
                onClick={() => {
                  setSelectedProjectId(null);
                  setSelectedCustomerId(null);
                }}
                className="hover:text-destructive text-primary/70 transition cursor-pointer font-bold ml-1"
                title="Clear project & deeper filters"
              >
                âœ•
              </button>
            </span>
          )}
          {selectedCustomerId !== null && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-semibold">
              Customer: {customers.find((c) => c.id === selectedCustomerId)?.contact_name || `#${selectedCustomerId}`}
              <button
                type="button"
                onClick={() => setSelectedCustomerId(null)}
                className="hover:text-destructive text-primary/70 transition cursor-pointer font-bold ml-1"
                title="Clear customer filter"
              >
                âœ•
              </button>
            </span>
          )}
        </div>
      )}

      {/* TAB 1: Real Projects from PostgreSQL DB */}
      {activeTab === 'projects' && (
        <>
          {isLoading && projects.length === 0 ? (
            <DataState kind="loading" title="Loading project workspaces" />
          ) : error && projects.length === 0 ? (
            <DataState kind="error" title="Projects unavailable" description={error} />
          ) : filteredProjects.length === 0 ? (
            <DataState
              kind="empty"
              title={search ? 'No matching projects' : 'No projects found'}
              description="No project workspace records exist in PostgreSQL database."
            />
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredProjects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => {
                    setSelectedProjectId(project.id);
                    setSelectedCustomerId(null);
                    setActiveTab('customers');
                  }}
                  className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-xs flex flex-col justify-between hover:border-primary/60 hover:shadow-md cursor-pointer transition-all"
                  title="Click to view project customers"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-muted text-primary border border-border">
                        Project #{project.id}
                      </span>

                      <StatusBadge
                        tone={
                          project.project_type?.includes('Demo')
                            ? 'information'
                            : 'success'
                        }
                      >
                        {project.project_type || 'Support Project'}
                      </StatusBadge>
                    </div>

                    <h3 className="text-base font-bold text-foreground">{project.name}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                      <Server className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="truncate">{project.environment || 'Production'}</span>
                    </div>

                    {/* Git Repository Foundation Section */}
                    <div
                      className="mt-4 pt-3 border-t border-border/80 space-y-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground flex items-center gap-1">
                          <Layers className="h-3.5 w-3.5 text-primary" /> Git Repository Mapping
                        </span>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            fetchGitRepos(project.id);
                            setGitFormProjectId(gitFormProjectId === project.id ? null : project.id);
                          }}
                        >
                          {gitFormProjectId === project.id ? 'Close' : 'Manage Git'}
                        </Button>
                      </div>

                      {gitReposMap[project.id]?.length > 0 ? (
                        <div className="space-y-1.5 text-xs">
                          {gitReposMap[project.id].map((repo) => (
                            <div
                              key={repo.id}
                              className="flex items-center justify-between p-2 rounded-md bg-muted/50 border border-border"
                            >
                              <div className="truncate pr-2">
                                <span className="font-mono font-semibold text-primary">{repo.provider}:</span>{' '}
                                <span className="font-mono text-muted-foreground truncate">{repo.repoUrl}</span>{' '}
                                <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded font-mono">
                                  ({repo.defaultBranch})
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                onClick={() => handleDisconnectGitRepo(project.id, repo.id)}
                                title="Disconnect Repository"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic">No Git repository connected</p>
                      )}

                      {gitFormProjectId === project.id && (
                        <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-2 text-xs">
                          <div>
                            <label className="block text-[11px] font-semibold text-foreground mb-1">
                              Repository URL (HTTPS or SSH)
                            </label>
                            <input
                              type="text"
                              placeholder="https://github.com/org/repo.git"
                              value={newGitRepo.repoUrl}
                              onChange={(e) => setNewGitRepo({ ...newGitRepo, repoUrl: e.target.value })}
                              className="w-full px-2.5 py-1.5 rounded border border-border bg-background text-foreground font-mono text-xs"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] font-semibold text-foreground mb-1">Provider</label>
                              <select
                                value={newGitRepo.provider}
                                onChange={(e) => setNewGitRepo({ ...newGitRepo, provider: e.target.value })}
                                className="w-full px-2 py-1.5 rounded border border-border bg-background text-foreground text-xs"
                              >
                                <option value="github">GitHub</option>
                                <option value="gitlab">GitLab</option>
                                <option value="bitbucket">Bitbucket</option>
                                <option value="gitea">Gitea</option>
                                <option value="custom">Custom</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-foreground mb-1">Default Branch</label>
                              <input
                                type="text"
                                value={newGitRepo.defaultBranch}
                                onChange={(e) => setNewGitRepo({ ...newGitRepo, defaultBranch: e.target.value })}
                                className="w-full px-2.5 py-1.5 rounded border border-border bg-background text-foreground font-mono text-xs"
                              />
                            </div>
                          </div>
                          <Button onClick={() => handleConnectGitRepo(project.id)} className="w-full mt-1">
                            Connect Repository
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Plane Integration Contextual Card */}
                    <div
                      className="mt-3 pt-3 border-t border-border/80"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ProjectDetailPlaneCard
                        projectId={project.id}
                        projectName={project.name}
                        onOpenManagementModal={() => setActiveTab('plane_integrations')}
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <span>Company ID: #{project.company_id}</span>
                    <span className="font-semibold text-primary">Active Workspace</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB 2: Customers */}
      {activeTab === 'customers' && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {isLoading && customers.length === 0 ? (
            <DataState kind="loading" title="Loading customers" />
          ) : filteredCustomers.length === 0 ? (
            <DataState
              kind="empty"
              title={search ? 'No matching customers' : 'No customers found'}
              description="No customer organization records exist in PostgreSQL."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Company Name</th>
                    <th className="px-4 py-3">Contact Person</th>
                    <th className="px-4 py-3">Email / Phone</th>
                    <th className="px-4 py-3">Enrolled Project</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCustomers.map((customer) => (
                    <tr
                      key={customer.id}
                      onClick={() => {
                        setSelectedCustomerId(customer.id);
                        if (customer.project_id) {
                          setSelectedProjectId(customer.project_id);
                        }
                        setActiveTab('identities');
                      }}
                      className="hover:bg-muted/50 cursor-pointer transition-colors"
                      title="Click to view customer LINE ID mappings"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-bold text-primary">#{customer.id}</td>
                      <td className="px-4 py-3 font-semibold text-foreground">{customer.company_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{customer.contact_name}</td>
                      <td className="px-4 py-3">
                        <p className="text-foreground text-xs">{customer.email || '-'}</p>
                        <p className="text-muted-foreground text-[11px]">{customer.phone || '-'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone="information">
                          {customer.project_name || `Project #${customer.project_id}`}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: LINE ID Mappings */}
      {activeTab === 'identities' && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {isLoading && identities.length === 0 ? (
            <DataState kind="loading" title="Loading LINE identity mappings" />
          ) : filteredIdentities.length === 0 ? (
            <DataState
              kind="empty"
              title={search ? 'No matching LINE mappings' : 'No LINE ID mappings'}
              description="No LINE Official Account identity mappings recorded in customer_identities table."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">LINE User ID</th>
                    <th className="px-4 py-3">Customer Company</th>
                    <th className="px-4 py-3">Contact Person</th>
                    <th className="px-4 py-3">Mapped Project</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredIdentities.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs text-primary font-medium">{item.line_user_id}</td>
                      <td className="px-4 py-3 font-semibold text-foreground">{item.company_name || 'Customer'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.contact_name || '-'}</td>
                      <td className="px-4 py-3">
                        <StatusBadge tone="information">
                          {item.project_name || `Project #${item.project_id}`}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone="success">Verified</StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteIdentity(item.id);
                          }}
                          className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                          title="Unbind Mapping"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Organizations */}
      {activeTab === 'organizations' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-foreground">Center CM Service Organizations</h4>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400">
                    Live IdP
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Create new organizations with orgId or query user roles directly on Center IAM CM Service.
                </p>
              </div>
            </div>
            <Button
              onClick={() => setActiveTab('center_iam')}
              className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold text-xs shadow-xs shrink-0 cursor-pointer border-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Create Org on Center CM</span>
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 border-b border-border text-xs uppercase font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Org ID</th>
                    <th className="px-4 py-3">Organization Name</th>
                    <th className="px-4 py-3">Slug</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {organizations.map((org) => (
                    <tr key={org.id} className="hover:bg-muted/30 transition">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-primary">{org.id}</td>
                      <td className="px-4 py-3 font-semibold text-foreground">{org.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{org.slug}</td>
                      <td className="px-4 py-3">
                        <StatusBadge tone="success">{org.status}</StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{org.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: User Roles & RBAC */}
      {activeTab === 'roles' && (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b border-border text-xs uppercase font-semibold text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">User Email</th>
                  <th className="px-4 py-3">RBAC Role</th>
                  <th className="px-4 py-3">Scope / Organization</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {userRoles.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/30 transition">
                    <td className="px-4 py-3 font-semibold text-foreground">{user.user_email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        user.role === 'super_admin' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20' :
                        user.role === 'admin' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' :
                        user.role === 'employee' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                        'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{user.org_id}</td>
                    <td className="px-4 py-3">
                      <StatusBadge tone="success">{user.status}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 6: Center IAM & Roles */}
      {activeTab === 'center_iam' && (
        <CenterIamManagement />
      )}

      {/* Tab 7: Plane.so Multi-Project Integrations Center */}
      {activeTab === 'plane_integrations' && (
        <PlaneIntegrationsManagement />
      )}

      {/* Modal 1: Add Customer Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-xl space-y-4">
            <h2 className="text-lg font-bold text-foreground">Add New Customer</h2>
            <form onSubmit={handleAddCustomerSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1">Company Name</label>
                <input
                  type="text"
                  required
                  value={newCustomer.company_name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, company_name: e.target.value })}
                  className="field-control w-full"
                  placeholder="e.g. Avalant Co., Ltd."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1">Contact Name</label>
                <input
                  type="text"
                  required
                  value={newCustomer.contact_name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, contact_name: e.target.value })}
                  className="field-control w-full"
                  placeholder="e.g. Natapohn"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1">Email</label>
                <input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  className="field-control w-full"
                  placeholder="natapohn@gmail.com"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1">Phone</label>
                <input
                  type="text"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  className="field-control w-full"
                  placeholder="0942415642"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1">Project</label>
                <select
                  value={newCustomer.project_id}
                  onChange={(e) => setNewCustomer({ ...newCustomer, project_id: Number(e.target.value) })}
                  className="field-control w-full"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.project_type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowAddCustomerModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save Customer</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Add LINE Identity Mapping Modal */}
      {showAddIdentityModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-xl space-y-4">
            <h2 className="text-lg font-bold text-foreground">Map LINE User ID to Customer</h2>
            <form onSubmit={handleAddIdentitySubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1">LINE User ID</label>
                <input
                  type="text"
                  required
                  value={newIdentity.line_user_id}
                  onChange={(e) => setNewIdentity({ ...newIdentity, line_user_id: e.target.value })}
                  className="field-control w-full font-mono text-xs"
                  placeholder="Uad28c1eabbcbe1608e038d4d162f4944"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1">Select Customer</label>
                <select
                  value={newIdentity.customer_id}
                  onChange={(e) => setNewIdentity({ ...newIdentity, customer_id: Number(e.target.value) })}
                  className="field-control w-full"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name} ({c.contact_name})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1">Select Project</label>
                <select
                  value={newIdentity.project_id}
                  onChange={(e) => setNewIdentity({ ...newIdentity, project_id: Number(e.target.value) })}
                  className="field-control w-full"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.environment})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowAddIdentityModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save Mapping</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MasterDataManagement;
