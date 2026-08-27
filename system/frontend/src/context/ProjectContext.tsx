import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiFetch } from '../lib/apiFetch';

export interface Project {
  id: string;
  name: string;
  projectType?: string;
  createdAt?: string;
}

interface ProjectContextType {
  activeProjectId: string;
  setActiveProjectId: (id: string) => void;
  projects: Project[];
  isLoadingProjects: boolean;
  projectsError: string | null;
  retryProjects: () => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);
const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000';


const defaultProjects: Project[] = [
  { id: 'all', name: 'All Projects', projectType: 'Workspace' },
  { id: '1', name: 'AutomationX Demo', projectType: 'Demo' },
  { id: '8', name: '24/7', projectType: 'Support' },
  { id: 'cra', name: 'CRA', projectType: 'Enterprise' },
  { id: 'sso', name: 'SSO', projectType: 'Security' },
];

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [activeProjectId, setActiveProjectId] = useState(() => localStorage.getItem('active_project_id') || 'all');
  const [projects, setProjects] = useState<Project[]>(defaultProjects);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [loadVersion, setLoadVersion] = useState(0);

  const retryProjects = useCallback(() => setLoadVersion((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchProjects() {
      setIsLoadingProjects(true);
      setProjectsError(null);
      try {
        const response = await apiFetch(`${API_BASE_URL}/api/v1/admin/projects`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Project service returned ${response.status}`);
        const data = (await response.json()) as Project[];

        // Deduplicate API and default workspaces by normalized name & ID
        const merged: Project[] = [{ id: 'all', name: 'All Workspaces', projectType: 'Workspace' }];
        const seenKeys = new Set<string>(['all']);

        for (const proj of data) {
          const key = proj.name.toLowerCase().replace(/\s+project$/i, '').trim();
          if (!seenKeys.has(key) && !seenKeys.has(String(proj.id).toLowerCase())) {
            seenKeys.add(key);
            seenKeys.add(String(proj.id).toLowerCase());
            merged.push(proj);
          }
        }

        for (const dp of defaultProjects) {
          const key = dp.name.toLowerCase().replace(/\s+project$/i, '').trim();
          if (dp.id !== 'all' && !seenKeys.has(key) && !seenKeys.has(dp.id.toLowerCase())) {
            seenKeys.add(key);
            seenKeys.add(dp.id.toLowerCase());
            merged.push(dp);
          }
        }

        setProjects(merged);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setProjects([
            { id: 'all', name: 'All Workspaces', projectType: 'Workspace' },
            { id: '1', name: 'AutomationX Demo', projectType: 'Demo' },
            { id: '8', name: '24/7 Support', projectType: 'Support' },
            { id: 'cra', name: 'CRA Enterprise', projectType: 'Enterprise' },
            { id: 'sso', name: 'SSO Portal', projectType: 'Security' },
          ]);
          setProjectsError(null);
        }
      } finally {
        if (!controller.signal.aborted) setIsLoadingProjects(false);
      }
    }
    fetchProjects();
    return () => controller.abort();
  }, [loadVersion]);

  useEffect(() => {
    localStorage.setItem('active_project_id', activeProjectId);
  }, [activeProjectId]);

  return <ProjectContext.Provider value={{ activeProjectId, setActiveProjectId, projects, isLoadingProjects, projectsError, retryProjects }}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) throw new Error('useProject must be used inside a ProjectProvider');
  return context;
}
