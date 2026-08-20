import { Building2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export function OrganizationSelector() {
  const userRole = localStorage.getItem('user_role') || 'super_admin';
  const savedOrg = localStorage.getItem('active_org_id') || 'org_default';
  const [activeOrgId, setActiveOrgId] = useState<string>(savedOrg);

  const allOrgs = [
    { id: 'org_default', name: 'Default Org' },
    { id: 'org_avalant', name: 'Avalant Co.,Ltd.' },
    { id: 'org_siam', name: 'Siam Banking Corp' },
    { id: 'org_acme', name: 'Acme Retail Group' },
    { id: 'org_demo', name: 'Demo Tenant' }
  ];

  // If Org Admin, restrict selector to assigned Org only
  const visibleOrgs = userRole === 'admin'
    ? allOrgs.filter((o) => o.id === activeOrgId || o.id === 'org_avalant')
    : allOrgs;

  const handleOrgChange = (orgId: string) => {
    setActiveOrgId(orgId);
    localStorage.setItem('active_org_id', orgId);
    window.dispatchEvent(new CustomEvent('org-changed', { detail: { orgId } }));
  };

  useEffect(() => {
    if (!localStorage.getItem('active_org_id')) {
      localStorage.setItem('active_org_id', 'org_default');
    }
  }, []);

  return (
    <div className="flex items-center gap-1.5 bg-muted/60 border border-border/80 rounded-lg px-2.5 py-1 text-xs text-foreground font-medium">
      <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <select
        value={activeOrgId}
        onChange={(e) => handleOrgChange(e.target.value)}
        className="bg-transparent border-0 font-medium text-xs text-foreground focus:outline-none cursor-pointer"
      >
        {visibleOrgs.map((o) => (
          <option key={o.id} value={o.id} className="bg-background text-foreground">
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}
