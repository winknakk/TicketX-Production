import React from 'react';
import { ChevronRight, Folder } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { getTabLabel, type AppTab } from '../../lib/navigation';

export interface BreadcrumbProps {
  activeTab: AppTab;
  className?: string;
}

export function Breadcrumb({ activeTab, className = '' }: BreadcrumbProps) {
  const { activeProjectId, projects } = useProject();
  const currentProject = projects.find((p) => String(p.id) === String(activeProjectId));
  const projectName =
    currentProject?.name ||
    (activeProjectId === 'all'
      ? 'All Projects'
      : activeProjectId === '1'
      ? 'AutomationX Demo'
      : activeProjectId === '8'
      ? 'Workspace Win'
      : `Project ${activeProjectId}`);
  const pageLabel = getTabLabel(activeTab);

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center gap-1.5 text-xs text-muted-foreground ${className}`}>
      <div className="flex items-center gap-1 font-medium text-foreground/80">
        <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span>{projectName}</span>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
      <span className="font-semibold text-foreground">{pageLabel}</span>
    </nav>
  );
}
