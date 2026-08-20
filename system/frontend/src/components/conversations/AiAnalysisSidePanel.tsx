import React from 'react';
import { ExternalLink, Image as ImageIcon, Sparkles, X } from 'lucide-react';

interface AiAnalysisSidePanelProps {
  isOpen: boolean;
  attachment: {
    id?: number | string;
    fileUrl: string;
    fileName: string;
    fileType?: string;
  } | null;
  conversationId?: string;
  onClose: () => void;
}

export const AiAnalysisSidePanel: React.FC<AiAnalysisSidePanelProps> = ({
  isOpen,
  attachment,
  conversationId,
  onClose
}) => {
  if (!isOpen || !attachment) return null;

  return (
    <aside
      className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-card shadow-2xl sm:max-w-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-analysis-title"
    >
      <div className="flex items-center justify-between border-b border-border bg-muted/40 p-4">
        <div className="flex min-w-0 items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 id="image-analysis-title" className="text-sm font-bold text-foreground">AI image analysis</h3>
            <p className="truncate text-[10px] text-muted-foreground">Conversation #{conversationId}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-9 min-w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Close image analysis"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4 text-xs">
        <div className="overflow-hidden rounded-lg border border-border bg-muted/30">
          <img
            src={attachment.fileUrl}
            alt={attachment.fileName}
            className="max-h-[45vh] w-full object-contain"
          />
          <div className="flex items-center gap-3 border-t border-border p-3">
            <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground">{attachment.fileName}</p>
              <p className="truncate text-[10px] text-muted-foreground">
                {attachment.fileType || 'Image attachment'}{attachment.id ? ` · ID #${attachment.id}` : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-primary/20 bg-primary/[0.05] p-3">
          <p className="font-semibold text-foreground">Image selected for analysis</p>
          <p className="mt-1 leading-relaxed text-muted-foreground">
            The attachment is ready in the chat context. Automated OCR and vision results will appear here after an analysis endpoint is connected.
          </p>
        </div>

        <a
          href={attachment.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-3 font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          Open full-size image
        </a>
      </div>

      <div className="flex items-center justify-between border-t border-border bg-muted/30 p-4">
        <span className="text-[10px] text-muted-foreground">AutomationX media context</span>
        <button
          type="button"
          onClick={onClose}
          className="min-h-9 rounded-md border border-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Done
        </button>
      </div>
    </aside>
  );
};
