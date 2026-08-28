import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  UserCheck, 
  Plus, 
  RefreshCw, 
  Shield, 
  Search, 
  Users, 
  CheckCircle2, 
  Loader2, 
  AlertCircle,
  Briefcase,
  User,
  Crown,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  UserPlus,
  KeyRound,
  ExternalLink,
  Settings,
  HelpCircle,
  Layers,
  Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { API_BASE_URL } from '../../lib/apiBaseUrl';



export interface CenterOrg {
  id: string;
  org_name?: string;
  description?: string;
  app_id?: string;
  organization_id?: string;
  org_department_code?: string;
  created_by?: string;
  created_date?: string;
}

export interface CenterUserRole {
  email: string;
  firstname: string;
  iam2_id: string;
  id: string;
  lastname: string;
  username: string;
  type: string;
  head?: string;
  position_name?: string;
}

interface CenterIamManagementProps {
  defaultOpenCreateModal?: boolean;
}

export function CenterIamManagement({ defaultOpenCreateModal = false }: CenterIamManagementProps) {
  const [centerToken, setCenterToken] = useState<string>('');
  const [orgs, setOrgs] = useState<CenterOrg[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [roles, setRoles] = useState<CenterUserRole[]>([]);
  const [myRole, setMyRole] = useState<CenterUserRole | null>(null);
  
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isAuthError, setIsAuthError] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  const [orgSearchTerm, setOrgSearchTerm] = useState('');
  const [roleSearchTerm, setRoleSearchTerm] = useState('');
  const [roleTypeFilter, setRoleTypeFilter] = useState<'all' | 'manager' | 'user'>('all');
  const [copiedOrgId, setCopiedOrgId] = useState<string | null>(null);
  const [copiedIamId, setCopiedIamId] = useState<string | null>(null);

  // Add Role Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [addForm, setAddForm] = useState({
    orgId: '',
    email: '',
    firstname: '',
    lastname: '',
    type: 'user',
    position_name: 'Developer',
    head: '',
  });

  // Create Org Modal state
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(defaultOpenCreateModal);
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [createOrgForm, setCreateOrgForm] = useState({
    org_name: '',
    org_department_code: '',
    description: '',
    app_id: '',
    autoAssignManager: true,
    manager_email: '',
    manager_firstname: '',
    manager_lastname: '',
    manager_position: 'Organization Lead',
  });

  // Token & Connection Settings Modal state
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenInput, setTokenInput] = useState('');

  // Copy helpers
  const handleCopyOrgId = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedOrgId(id);
    setTimeout(() => setCopiedOrgId(null), 2000);
  };

  const handleCopyIamId = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedIamId(id);
    setTimeout(() => setCopiedIamId(null), 2000);
  };

  // Load Center Token & prefill user info
  useEffect(() => {
    const token = localStorage.getItem('center_token') || '';
    setCenterToken(token);
    setTokenInput(token);
    
    const storedEmail = localStorage.getItem('active_operator_email') || '';
    const storedName = localStorage.getItem('active_operator_profile') || '';
    const nameParts = storedName.split(' ');

    if (storedEmail) {
      setCreateOrgForm((prev) => ({
        ...prev,
        manager_email: storedEmail,
        manager_firstname: nameParts[0] || '',
        manager_lastname: nameParts.slice(1).join(' ') || '',
      }));
    }

    if (token) {
      fetchOrgs(token);
    }
  }, []);

  // 1. Fetch Center Orgs
  const fetchOrgs = async (tokenOverride?: string) => {
    const token = tokenOverride || centerToken;
    if (!token) {
      setIsAuthError(true);
      setErrorMsg('No Center token found. Please login or update your token.');
      return;
    }

    setLoadingOrgs(true);
    setErrorMsg(null);
    setIsAuthError(false);

    try {
      const res = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/api/v1/auth/center/find-orgs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      }).then((r) => r.json());

      if (res.success && Array.isArray(res.orgs)) {
        setOrgs(res.orgs);
        setIsAuthError(false);
        if (res.orgs.length > 0 && !selectedOrgId) {
          const firstOrgId = res.orgs[0].id;
          setSelectedOrgId(firstOrgId);
          fetchRolesForOrg(token, firstOrgId);
        }
      } else {
        const authErr = res.isAuthError || res.error?.includes('401') || res.error?.includes('expired');
        setIsAuthError(!!authErr);
        setErrorMsg(res.error || 'Failed to load organizations from Center CM Service.');
      }
    } catch (err: any) {
      setErrorMsg('Network error fetching Center organizations: ' + (err.message || ''));
    } finally {
      setLoadingOrgs(false);
    }
  };

  // 2. Fetch User Roles for Org
  const fetchRolesForOrg = async (tokenOverride?: string, orgIdOverride?: string) => {
    const token = tokenOverride || centerToken;
    const orgId = orgIdOverride || selectedOrgId;
    if (!token || !orgId) return;

    setLoadingRoles(true);
    setErrorMsg(null);
    try {
      const rolesRes = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/api/v1/auth/center/get-user-roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, orgId }),
      }).then((r) => r.json());

      if (rolesRes.success && Array.isArray(rolesRes.roles)) {
        setRoles(rolesRes.roles);
      } else if (rolesRes.isAuthError) {
        setIsAuthError(true);
      }

      const myRoleRes = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/api/v1/auth/center/get-my-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, orgId }),
      }).then((r) => r.json()).catch(() => null);

      if (myRoleRes?.success && myRoleRes.role) {
        setMyRole(myRoleRes.role);
      }
    } catch (err: any) {
      setErrorMsg('Error loading roles from Center: ' + (err.message || ''));
    } finally {
      setLoadingRoles(false);
    }
  };

  // Handle Org switch
  const handleSelectOrg = (orgId: string) => {
    setSelectedOrgId(orgId);
    setAddForm((prev) => ({ ...prev, orgId }));
    fetchRolesForOrg(centerToken, orgId);
  };

  // Handle manual token save
  const handleSaveToken = () => {
    const cleanToken = tokenInput.trim();
    if (!cleanToken) {
      setErrorMsg('Please enter a valid token string.');
      return;
    }
    localStorage.setItem('center_token', cleanToken);
    setCenterToken(cleanToken);
    setShowTokenModal(false);
    setSuccessMsg('Center Token updated successfully!');
    setIsAuthError(false);
    fetchOrgs(cleanToken);
  };

  // Handle Add Role submit
  const handleAddRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!centerToken) {
      setErrorMsg('Please login with Center or provide a valid token.');
      return;
    }

    const targetOrgId = addForm.orgId || selectedOrgId;
    if (!targetOrgId) {
      setErrorMsg('Please select an Organization first.');
      return;
    }

    if (!addForm.email || !addForm.firstname) {
      setErrorMsg('Please fill in required fields (Email and First Name).');
      return;
    }

    setIsAddingRole(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/api/v1/auth/center/add-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: centerToken,
          orgId: targetOrgId,
          email: addForm.email.trim(),
          firstname: addForm.firstname.trim(),
          lastname: addForm.lastname.trim(),
          type: addForm.type,
          position_name: addForm.position_name.trim(),
          head: addForm.head.trim(),
        }),
      }).then((r) => r.json());

      setIsAddingRole(false);

      if (res.success) {
        setSuccessMsg(`Successfully added role for ${addForm.firstname} ${addForm.lastname} on Center!`);
        setShowAddModal(false);
        setAddForm({
          orgId: selectedOrgId,
          email: '',
          firstname: '',
          lastname: '',
          type: 'user',
          position_name: 'Developer',
          head: '',
        });
        fetchRolesForOrg(centerToken, targetOrgId);
      } else {
        setErrorMsg(res.error || 'Failed to add role on Center CM Service.');
      }
    } catch (err: any) {
      setIsAddingRole(false);
      setErrorMsg('Network error adding role to Center: ' + (err.message || ''));
    }
  };

  // Handle Create Org submit
  const handleCreateOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!centerToken) {
      setErrorMsg('Please login with Center first to obtain active session token.');
      return;
    }

    if (!createOrgForm.org_name.trim()) {
      setErrorMsg('Please enter Organization Name.');
      return;
    }

    setIsCreatingOrg(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const bodyPayload: any = {
      token: centerToken,
      org_name: createOrgForm.org_name.trim(),
      org_department_code: createOrgForm.org_department_code.trim(),
      description: createOrgForm.description.trim(),
      app_id: createOrgForm.app_id.trim(),
    };

    if (createOrgForm.autoAssignManager && createOrgForm.manager_email.trim()) {
      bodyPayload.initialManager = {
        email: createOrgForm.manager_email.trim(),
        firstname: createOrgForm.manager_firstname.trim(),
        lastname: createOrgForm.manager_lastname.trim(),
        position_name: createOrgForm.manager_position.trim(),
      };
    }

    try {
      const res = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/api/v1/auth/center/create-org`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      }).then((r) => r.json());

      setIsCreatingOrg(false);

      if (res.success) {
        const newOrgId = res.org?.id || res.data?.id || res.org?.orgId;
        setSuccessMsg(`Successfully created Organization '${createOrgForm.org_name}' on Center CM Service!`);
        setShowCreateOrgModal(false);
        setCreateOrgForm((prev) => ({
          ...prev,
          org_name: '',
          org_department_code: '',
          description: '',
          app_id: '',
        }));
        
        await fetchOrgs();
        if (newOrgId) {
          handleSelectOrg(newOrgId);
        }
      } else {
        setErrorMsg(res.error || 'Failed to create organization on Center CM Service.');
      }
    } catch (err: any) {
      setIsCreatingOrg(false);
      setErrorMsg('Network error creating organization: ' + (err.message || ''));
    }
  };

  // Filtered lists
  const filteredOrgs = useMemo(() => {
    if (!orgSearchTerm.trim()) return orgs;
    const term = orgSearchTerm.toLowerCase();
    return orgs.filter(
      (o) =>
        o.org_name?.toLowerCase().includes(term) ||
        o.id.toLowerCase().includes(term) ||
        o.description?.toLowerCase().includes(term) ||
        o.created_by?.toLowerCase().includes(term)
    );
  }, [orgs, orgSearchTerm]);

  const filteredRoles = useMemo(() => {
    return roles.filter((r) => {
      const matchesSearch =
        !roleSearchTerm.trim() ||
        r.email?.toLowerCase().includes(roleSearchTerm.toLowerCase()) ||
        r.firstname?.toLowerCase().includes(roleSearchTerm.toLowerCase()) ||
        r.lastname?.toLowerCase().includes(roleSearchTerm.toLowerCase()) ||
        r.position_name?.toLowerCase().includes(roleSearchTerm.toLowerCase()) ||
        r.iam2_id?.includes(roleSearchTerm);

      const matchesType =
        roleTypeFilter === 'all' ||
        (roleTypeFilter === 'manager' && r.type === 'manager') ||
        (roleTypeFilter === 'user' && r.type !== 'manager');

      return matchesSearch && matchesType;
    });
  }, [roles, roleSearchTerm, roleTypeFilter]);

  const selectedOrg = orgs.find((o) => o.id === selectedOrgId);
  const managerCount = roles.filter((r) => r.type === 'manager').length;
  const userCount = roles.length - managerCount;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Header Toolbar Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 bg-card border border-border rounded-2xl shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl border border-purple-500/20">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-foreground">Center IAM & Organization Hub</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                IdP Connected
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                centerapp.io (Production)
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage Center IAM Organizations, query user roles, and provision new orgId on Center CM Service.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchOrgs();
              if (selectedOrgId) fetchRolesForOrg();
            }}
            disabled={loadingOrgs || loadingRoles}
            className="gap-2 cursor-pointer text-xs"
            title="Refresh organizations and roles from Center"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingOrgs || loadingRoles ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTokenModal(true)}
            className="gap-2 cursor-pointer text-xs border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40"
            title="Update token or switch CM Service environment"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Token Settings</span>
          </Button>

          {/* Prominent Superadmin Button */}
          <Button
            size="sm"
            onClick={() => setShowCreateOrgModal(true)}
            className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md font-semibold cursor-pointer border-0 text-xs"
          >
            <Building2 className="w-4 h-4" />
            <span>+ Create New Organization</span>
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono uppercase tracking-wider">
              Superadmin
            </span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAddForm((prev) => ({ ...prev, orgId: selectedOrgId }));
              setShowAddModal(true);
            }}
            disabled={!selectedOrgId}
            className="gap-2 cursor-pointer shadow-xs text-xs border-border hover:border-primary"
          >
            <UserPlus className="w-3.5 h-3.5 text-primary" />
            <span>Add Role on Center</span>
          </Button>
        </div>
      </div>

      {/* 2. Intelligent Diagnostic Card (Auth / Token Notice) */}
      {isAuthError && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm">Center Session Token Notice (401 Unauthorized)</div>
              <p className="text-amber-800 dark:text-amber-300/80 mt-0.5 leading-relaxed">
                Token เซสชันหมดอายุ หรือ Token ไม่ถูกต้อง กรุณา Login ที่ Postman ใหม่และ copy token มาวางอีกครั้ง
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => setShowTokenModal(true)}
              className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-xs cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>ใส่ Token ใหม่ / เชื่อมต่อ</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchOrgs()}
              className="text-xs border-amber-500/30 text-amber-900 dark:text-amber-200 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>ลองใหม่</span>
            </Button>
          </div>
        </div>
      )}

      {/* Notifications */}
      {errorMsg && !isAuthError && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-xs font-bold hover:underline cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-sm font-medium flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-xs font-bold hover:underline cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* 3. Main Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Organization Navigator */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <h3 className="font-bold text-sm text-foreground">Center Organizations</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400">
                {orgs.length}
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCreateOrgModal(true)}
              className="h-7 px-2.5 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 border-purple-500/30 gap-1 font-semibold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Org</span>
            </Button>
          </div>

          {/* Org Search */}
          {orgs.length > 0 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search organizations..."
                value={orgSearchTerm}
                onChange={(e) => setOrgSearchTerm(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          )}

          {/* Org Cards List */}
          <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
            {orgs.length === 0 && !loadingOrgs ? (
              <div className="p-6 text-center border border-dashed border-border rounded-2xl bg-card space-y-4 shadow-2xs">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 mx-auto flex items-center justify-center">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">No Organizations Available</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    ยังไม่พบรายการองค์กรจาก Center CM Service หรือไม่ได้ล็อกอินด้วยโทเคนขององค์กร
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    onClick={() => setShowCreateOrgModal(true)}
                    className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Create First Organization</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowTokenModal(true)}
                    className="text-xs cursor-pointer border-border"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Update Token / Settings</span>
                  </Button>
                </div>
              </div>
            ) : (
              filteredOrgs.map((org) => (
                <div
                  key={org.id}
                  onClick={() => handleSelectOrg(org.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer relative group ${
                    selectedOrgId === org.id
                      ? 'border-purple-500 bg-purple-500/5 shadow-xs ring-1 ring-purple-500/20'
                      : 'border-border bg-card hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-sm text-foreground truncate">
                      {org.org_name || org.id}
                    </span>
                    {selectedOrgId === org.id && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-600 text-white">
                        Active
                      </span>
                    )}
                  </div>

                  {/* orgId with copy button */}
                  <div className="flex items-center justify-between gap-2 p-1.5 rounded bg-muted/50 border border-border/50 text-[11px] font-mono text-muted-foreground mb-2">
                    <span className="truncate">ID: {org.id}</span>
                    <button
                      type="button"
                      onClick={(e) => handleCopyOrgId(org.id, e)}
                      title="Copy Org ID"
                      className="p-1 hover:text-foreground text-muted-foreground rounded transition shrink-0 cursor-pointer"
                    >
                      {copiedOrgId === org.id ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>

                  {org.description && (
                    <p className="text-[11px] text-muted-foreground line-clamp-1 mb-2">
                      {org.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1.5 text-[10px] text-muted-foreground border-t border-border/40">
                    <span>{org.created_by ? `By: ${org.created_by}` : 'Center CM'}</span>
                    {selectedOrgId === org.id && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAddForm((prev) => ({ ...prev, orgId: org.id }));
                          setShowAddModal(true);
                        }}
                        className="text-purple-600 dark:text-purple-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <UserPlus className="w-3 h-3" />
                        <span>Add Member</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Roles Table & Active Organization Hub */}
        <div className="lg:col-span-2 space-y-4">
          {/* Active Org Header Banner */}
          {selectedOrg && (
            <div className="p-4 rounded-xl bg-card border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-foreground">
                    {selectedOrg.org_name || selectedOrg.id}
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                    Selected Org
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">orgId: {selectedOrg.id}</span>
                  <button
                    onClick={(e) => handleCopyOrgId(selectedOrg.id, e)}
                    className="text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedOrgId === selectedOrg.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedOrgId === selectedOrg.id ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setAddForm((prev) => ({ ...prev, orgId: selectedOrg.id }));
                    setShowAddModal(true);
                  }}
                  className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs shadow-xs cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add Member</span>
                </Button>
              </div>
            </div>
          )}

          {/* My Role Hero Banner */}
          {myRole && (
            <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold shrink-0">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">
                      {myRole.firstname} {myRole.lastname}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-700 dark:text-purple-300 font-semibold">
                      My Role ({myRole.type})
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {myRole.position_name || 'Member'} · IAM2 ID: {myRole.iam2_id} · {myRole.email}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Search, Filter & Member Statistics */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search members by name, email..."
                  value={roleSearchTerm}
                  onChange={(e) => setRoleSearchTerm(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center p-0.5 rounded-lg bg-muted border border-border text-xs">
                <button
                  onClick={() => setRoleTypeFilter('all')}
                  className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                    roleTypeFilter === 'all'
                      ? 'bg-card text-foreground shadow-2xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  All ({roles.length})
                </button>
                <button
                  onClick={() => setRoleTypeFilter('manager')}
                  className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                    roleTypeFilter === 'manager'
                      ? 'bg-card text-purple-600 dark:text-purple-400 shadow-2xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Managers ({managerCount})
                </button>
                <button
                  onClick={() => setRoleTypeFilter('user')}
                  className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                    roleTypeFilter === 'user'
                      ? 'bg-card text-foreground shadow-2xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Users ({userCount})
                </button>
              </div>
            </div>

            <span className="text-xs text-muted-foreground font-medium shrink-0">
              Showing {filteredRoles.length} of {roles.length} members
            </span>
          </div>

          {/* Members Table */}
          <div className="border border-border rounded-xl overflow-hidden bg-card shadow-xs">
            {loadingRoles ? (
              <div className="p-12 text-center text-muted-foreground text-xs flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>Loading member roles from Center CM Service...</span>
              </div>
            ) : filteredRoles.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-muted text-muted-foreground mx-auto flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">No Member Roles Found</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {selectedOrgId
                      ? 'No members matching current filters in this organization.'
                      : 'Select an organization from the left to view member roles.'}
                  </p>
                </div>
                {selectedOrgId && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setAddForm((prev) => ({ ...prev, orgId: selectedOrgId }));
                      setShowAddModal(true);
                    }}
                    className="gap-1.5 bg-primary text-primary-foreground text-xs cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Member to this Organization</span>
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    <tr>
                      <th className="px-4 py-3">Member Name & Email</th>
                      <th className="px-4 py-3">IAM2 ID</th>
                      <th className="px-4 py-3">Role Type</th>
                      <th className="px-4 py-3">Position</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredRoles.map((role) => {
                      const isManager = role.type === 'manager';
                      return (
                        <tr key={role.id || role.email} className="hover:bg-muted/30 transition">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                isManager ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400' : 'bg-primary/10 text-primary'
                              }`}>
                                {role.firstname?.[0] || 'U'}
                              </div>
                              <div>
                                <div className="font-semibold text-foreground flex items-center gap-1.5">
                                  <span>{role.firstname} {role.lastname}</span>
                                  {role.username && (
                                    <span className="text-[10px] text-muted-foreground font-normal">(@{role.username})</span>
                                  )}
                                </div>
                                <div className="text-muted-foreground text-[11px]">{role.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <span>{role.iam2_id || '-'}</span>
                              {role.iam2_id && (
                                <button
                                  type="button"
                                  onClick={(e) => handleCopyIamId(role.iam2_id, e)}
                                  title="Copy IAM2 ID"
                                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                                >
                                  {copiedIamId === role.iam2_id ? (
                                    <Check className="w-3 h-3 text-emerald-500" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isManager
                                ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/20'
                                : 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/20'
                            }`}>
                              {isManager ? <Crown className="w-3 h-3" /> : <User className="w-3 h-3" />}
                              <span>{role.type || 'user'}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-foreground font-medium">
                            {role.position_name || '-'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setAddForm({
                                  orgId: selectedOrgId,
                                  email: role.email,
                                  firstname: role.firstname,
                                  lastname: role.lastname,
                                  type: role.type,
                                  position_name: role.position_name || 'Member',
                                  head: role.head || '',
                                });
                                setShowAddModal(true);
                              }}
                              className="h-7 px-2 text-[11px] text-primary cursor-pointer hover:bg-primary/10"
                            >
                              Edit Role
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Token & Connection Settings Modal */}
      {showTokenModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5 text-foreground relative">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">Center Token & Connection Settings</h3>
                  <p className="text-[11px] text-muted-foreground">Update active session token or switch CM Service environment.</p>
                </div>
              </div>
              <button
                onClick={() => setShowTokenModal(false)}
                className="text-muted-foreground hover:text-foreground font-bold text-sm p-1 rounded hover:bg-muted transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/20 text-muted-foreground space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-foreground">
                  <Globe className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  <span>Target CM Service URL</span>
                </div>
                <div className="font-mono text-[11px] text-purple-600 dark:text-purple-400">
                  https://centerapp.io/cm-service/api/v1 (Production)
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="center_token_input" className="text-xs font-semibold flex items-center justify-between">
                  <span>Bearer Session Token</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Pastes from Postman or Center</span>
                </Label>
                <textarea
                  id="center_token_input"
                  rows={4}
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full p-2.5 rounded-xl border border-border bg-background text-foreground font-mono text-[11px] focus:ring-1 focus:ring-purple-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTokenModal(false)}
                  className="cursor-pointer text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveToken}
                  className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold cursor-pointer shadow-md text-xs border-0"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save & Connect</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Create Org Modal */}
      {showCreateOrgModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5 text-foreground relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-foreground">
                      Create New Organization
                    </h3>
                    <span className="text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded font-mono uppercase tracking-wider font-semibold">
                      Center CM
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Create a new orgId on Center CM Service with optional 1-Click Manager assignment.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateOrgModal(false)}
                className="text-muted-foreground hover:text-foreground font-bold text-sm p-1 rounded hover:bg-muted transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrgSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <Label htmlFor="org_name" className="text-xs font-semibold flex items-center justify-between">
                  <span>Organization Name *</span>
                  <span className="text-[10px] text-muted-foreground font-normal">e.g. Avalant Innovation Division</span>
                </Label>
                <Input
                  id="org_name"
                  value={createOrgForm.org_name}
                  onChange={(e) => setCreateOrgForm({ ...createOrgForm, org_name: e.target.value })}
                  placeholder="e.g. Avalant Innovation Division"
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="org_department_code" className="text-xs font-semibold">
                    Department Code
                  </Label>
                  <Input
                    id="org_department_code"
                    value={createOrgForm.org_department_code}
                    onChange={(e) => setCreateOrgForm({ ...createOrgForm, org_department_code: e.target.value })}
                    placeholder="DEPT-ENG-01"
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="app_id" className="text-xs font-semibold">
                    App ID
                  </Label>
                  <Input
                    id="app_id"
                    value={createOrgForm.app_id}
                    onChange={(e) => setCreateOrgForm({ ...createOrgForm, app_id: e.target.value })}
                    placeholder="ticketx-app-01"
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description" className="text-xs font-semibold">
                  Description
                </Label>
                <Input
                  id="description"
                  value={createOrgForm.description}
                  onChange={(e) => setCreateOrgForm({ ...createOrgForm, description: e.target.value })}
                  placeholder="Engineering and Customer Support Organization"
                  className="h-9 text-xs"
                />
              </div>

              {/* 1-Click Initial Manager Onboarding Section */}
              <div className="p-3.5 rounded-xl border border-purple-500/20 bg-purple-500/5 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={createOrgForm.autoAssignManager}
                    onChange={(e) =>
                      setCreateOrgForm({ ...createOrgForm, autoAssignManager: e.target.checked })
                    }
                    className="rounded border-border text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                  />
                  <div className="flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <span className="text-xs font-bold text-foreground">
                      1-Click Onboard Initial Manager
                    </span>
                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold bg-purple-500/15 px-1.5 py-0.2 rounded">
                      Recommended
                    </span>
                  </div>
                </label>

                {createOrgForm.autoAssignManager && (
                  <div className="space-y-2.5 pt-1">
                    <div className="space-y-1">
                      <Label htmlFor="mgr_email" className="text-[11px] font-semibold text-foreground">
                        Manager Email *
                      </Label>
                      <Input
                        id="mgr_email"
                        type="email"
                        value={createOrgForm.manager_email}
                        onChange={(e) =>
                          setCreateOrgForm({ ...createOrgForm, manager_email: e.target.value })
                        }
                        placeholder="warinthon.p@avlgb.com"
                        className="h-8 text-xs"
                        required={createOrgForm.autoAssignManager}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="mgr_first" className="text-[11px] font-semibold text-foreground">
                          First Name
                        </Label>
                        <Input
                          id="mgr_first"
                          value={createOrgForm.manager_firstname}
                          onChange={(e) =>
                            setCreateOrgForm({ ...createOrgForm, manager_firstname: e.target.value })
                          }
                          placeholder="Warinthon"
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="mgr_last" className="text-[11px] font-semibold text-foreground">
                          Last Name
                        </Label>
                        <Input
                          id="mgr_last"
                          value={createOrgForm.manager_lastname}
                          onChange={(e) =>
                            setCreateOrgForm({ ...createOrgForm, manager_lastname: e.target.value })
                          }
                          placeholder="Phiokhao"
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="mgr_pos" className="text-[11px] font-semibold text-foreground">
                        Position Title
                      </Label>
                      <Input
                        id="mgr_pos"
                        value={createOrgForm.manager_position}
                        onChange={(e) =>
                          setCreateOrgForm({ ...createOrgForm, manager_position: e.target.value })
                        }
                        placeholder="Organization Lead / Admin"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateOrgModal(false)}
                  className="cursor-pointer text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isCreatingOrg}
                  className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold cursor-pointer shadow-md text-xs border-0"
                >
                  {isCreatingOrg ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating & Assigning on Center...</span>
                    </>
                  ) : (
                    <>
                      <Building2 className="w-4 h-4" />
                      <span>Create Organization</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Add Role Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 text-foreground relative">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-base flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-primary" />
                <span>Add Member Role to Center Org</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-muted-foreground hover:text-foreground font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddRoleSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <Label htmlFor="target_orgId" className="text-xs font-semibold">
                  Organization ID (orgId) *
                </Label>
                <Input
                  id="target_orgId"
                  value={addForm.orgId || selectedOrgId}
                  onChange={(e) => setAddForm({ ...addForm, orgId: e.target.value })}
                  placeholder="abcaeb2c-1b12-4fdd-9fe8-3413db634133"
                  className="h-9 text-xs font-mono"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold">
                  User Email *
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  placeholder="kniiagmb@hldrive.com"
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="firstname" className="text-xs font-semibold">
                    First Name *
                  </Label>
                  <Input
                    id="firstname"
                    value={addForm.firstname}
                    onChange={(e) => setAddForm({ ...addForm, firstname: e.target.value })}
                    placeholder="Sanpheth"
                    className="h-9 text-xs"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastname" className="text-xs font-semibold">
                    Last Name
                  </Label>
                  <Input
                    id="lastname"
                    value={addForm.lastname}
                    onChange={(e) => setAddForm({ ...addForm, lastname: e.target.value })}
                    placeholder="W."
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="type" className="text-xs font-semibold">
                    Role Type
                  </Label>
                  <select
                    id="type"
                    value={addForm.type}
                    onChange={(e) => setAddForm({ ...addForm, type: e.target.value })}
                    className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground"
                  >
                    <option value="user">User</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="position_name" className="text-xs font-semibold">
                    Position Name
                  </Label>
                  <Input
                    id="position_name"
                    value={addForm.position_name}
                    onChange={(e) => setAddForm({ ...addForm, position_name: e.target.value })}
                    placeholder="Developer / Lead Engineer"
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="head" className="text-xs font-semibold">
                  Head / Manager Email (Optional)
                </Label>
                <Input
                  id="head"
                  value={addForm.head}
                  onChange={(e) => setAddForm({ ...addForm, head: e.target.value })}
                  placeholder="kniiagmb@hldrive.com"
                  className="h-9 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddModal(false)}
                  className="cursor-pointer text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isAddingRole}
                  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-sm text-xs"
                >
                  {isAddingRole ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Adding to Center...</span>
                    </>
                  ) : (
                    <span>Add Role</span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
