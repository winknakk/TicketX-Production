import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, FolderKanban, MessageSquare, Ticket, User, ArrowRight, X, Command } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import type { AppTab } from '../../lib/navigation';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: AppTab) => void;
}

export function CommandPalette({ isOpen, onClose, onNavigateTab }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const { projects, activeProjectId, setActiveProjectId } = useProject();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Trigger open via custom event or props
          window.dispatchEvent(new CustomEvent('toggle-command-palette'));
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleAction = useCallback(
    (action: () => void) => {
      action();
      onClose();
    },
    [onClose]
  );

  if (!isOpen) return null;

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-20 p-4 animate-in fade-in duration-150">
      <div className="bg-card border border-border rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border bg-muted/30">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search (e.g. Inbox, Tickets, 24/7)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm font-medium text-foreground placeholder-muted-foreground outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted border border-border rounded-md">
            <span>ESC</span>
          </kbd>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Action List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4 text-xs">
          {/* Quick Actions */}
          <div>
            <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Navigation & Actions
            </p>
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => handleAction(() => onNavigateTab('conversations'))}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-muted/80 text-foreground transition text-left cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-semibold text-sm">Open Inbox</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </button>

              <button
                type="button"
                onClick={() => handleAction(() => onNavigateTab('tickets'))}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-muted/80 text-foreground transition text-left cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Ticket className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-semibold text-sm">Open Tickets Queue</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </button>

              <button
                type="button"
                onClick={() => handleAction(() => onNavigateTab('directory'))}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-muted/80 text-foreground transition text-left cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <User className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-semibold text-sm">Open Directory & Master Data</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Switch Workspaces */}
          <div>
            <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Switch Workspace Context
            </p>
            <div className="space-y-0.5">
              {filteredProjects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    handleAction(() => {
                      setActiveProjectId(p.id);
                    })
                  }
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition cursor-pointer ${
                    activeProjectId === p.id
                      ? 'bg-primary/10 text-primary font-bold'
                      : 'hover:bg-muted text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <FolderKanban className="h-3.5 w-3.5 shrink-0" />
                    <span>{p.name}</span>
                  </div>
                  {activeProjectId === p.id && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                      Active
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/20 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Command className="h-3 w-3" />
            <span>Search target &lt; 500ms</span>
          </div>
          <span>Use ⌘K or Ctrl+K anytime</span>
        </div>
      </div>
    </div>
  );
}
