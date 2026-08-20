export interface OperatorProfile {
  name: string;
  initials: string;
  phone: string;
  projectLabel: string;
  roleDescription: string;
}

function getInitials(name: string): string {
  if (!name) return 'US';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

export function getOperatorProfile(activeProjectId?: string): OperatorProfile {
  const storedName = localStorage.getItem('active_operator_profile') || 'Admin Good';
  const storedPhone = localStorage.getItem('active_operator_phone');
  const storedEmail = localStorage.getItem('active_operator_email');
  const userRole = localStorage.getItem('user_role') || 'admin';
  const activeOrg = localStorage.getItem('active_org_id') || 'org_avalant';

  const currentProjectTag = activeProjectId ? `Project ${activeProjectId}` : '';
  const displayContact = storedEmail || (storedPhone && storedPhone !== '0942415642' ? storedPhone : 'admin@ticketx.io');
  const initials = getInitials(storedName);

  if (storedName === 'Super Admin Overseer' || userRole === 'super_admin') {
    return {
      name: storedName === 'superadmin' ? 'Super Admin Overseer' : storedName,
      initials: 'SA',
      phone: displayContact,
      projectLabel: currentProjectTag || 'All Workspaces',
      roleDescription: 'Super Admin Overseer (Full Access)',
    };
  }

  if (userRole === 'admin') {
    return {
      name: storedName,
      initials,
      phone: displayContact,
      projectLabel: currentProjectTag || activeOrg,
      roleDescription: `${activeOrg} Organization Administrator`,
    };
  }

  if (userRole === 'employee' || storedName === 'Admin Win') {
    return {
      name: storedName === 'agent' ? 'Avalant Support Agent' : storedName,
      initials: storedName === 'Admin Win' ? 'AW' : initials,
      phone: displayContact,
      projectLabel: currentProjectTag || 'Project 8',
      roleDescription: 'Tier-2 Support Agent',
    };
  }

  if (userRole === 'customer') {
    return {
      name: storedName === 'customer' ? 'Avalant Client User' : storedName,
      initials,
      phone: displayContact,
      projectLabel: 'Customer Portal',
      roleDescription: 'Verified Client Customer',
    };
  }

  return {
    name: storedName || 'Admin Good',
    initials,
    phone: displayContact,
    projectLabel: currentProjectTag || 'Project 1',
    roleDescription: 'AutomationX Operator',
  };
}
