import { FolderKanban, RefreshCw } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

export function ProjectSelector() {
  const { activeProjectId, setActiveProjectId, projects } = useProject();

  return (
    <label className="flex h-9 items-center gap-1.5 rounded-lg border border-border/80 bg-background/80 px-2.5 shadow-2xs transition-colors hover:bg-muted/80 cursor-pointer">
      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Workspace</span>
      <FolderKanban className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
      <select
        value={activeProjectId}
        onChange={(event) => setActiveProjectId(event.target.value)}
        className="min-w-0 max-w-36 cursor-pointer border-0 bg-transparent text-xs font-bold text-foreground outline-none sm:max-w-48"
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
    </label>
  );
}
