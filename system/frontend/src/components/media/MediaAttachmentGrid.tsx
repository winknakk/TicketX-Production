import React, { useState } from 'react';
import { Expand, FileText, Sparkles } from 'lucide-react';
import { ImagePreviewModal } from './ImagePreviewModal';
import { API_BASE_URL } from '../../lib/apiBaseUrl';

export interface AttachmentItem {
  id?: number | string;
  fileUrl: string;
  thumbnailUrl?: string;
  fileName: string;
  fileType: string;
  fileSize?: number;
}

interface MediaAttachmentGridProps {
  attachments: AttachmentItem[];
  onAnalyzeImage?: (attachment: AttachmentItem) => void;
}

export const MediaAttachmentGrid: React.FC<MediaAttachmentGridProps> = ({ attachments, onAnalyzeImage }) => {
  const [selectedImage, setSelectedImage] = useState<{ url: string; name: string } | null>(null);

  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="mt-2 grid max-w-sm grid-cols-1 gap-2 min-[420px]:grid-cols-2">
      {attachments.map((att: any, index) => {
        const rawUrl = att.fileUrl || att.file_url || att.url || att.file_path || att.filePath || '';
        const apiHost = API_BASE_URL;
        const fullUrl = rawUrl.startsWith('/api') || rawUrl.startsWith('/uploads')
          ? `${apiHost}${rawUrl}`
          : rawUrl;

        const fileName = att.fileName || att.file_name || 'attachment';
        const fileType = att.fileType || att.file_type || 'image/jpeg';
        const isImage = fileType.startsWith('image/')
          || /\.(avif|gif|jpe?g|png|webp)(?:$|[?#])/i.test(fullUrl)
          || rawUrl.includes('/media/file')
          || rawUrl.includes('line_img_');

        return (
          <div
            key={att.id || index}
            className="group overflow-hidden rounded-xl border border-border bg-card shadow-sm"
          >
            {isImage ? (
              <div className="relative">
                <button
                  type="button"
                  className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset cursor-pointer"
                  onClick={() => setSelectedImage({ url: fullUrl, name: fileName })}
                  aria-label={`Preview ${fileName}`}
                >
                  <img
                    src={fullUrl}
                    alt={fileName}
                    onError={(e) => {
                      // Fallback if image fails to load
                      const target = e.currentTarget;
                      if (!target.dataset.fallbackTried) {
                        target.dataset.fallbackTried = 'true';
                        target.src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600';
                      }
                    }}
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                  />
                  <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/65 px-2 py-1.5 text-[11px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <Expand className="h-3.5 w-3.5" aria-hidden="true" />
                    Preview
                  </span>
                </button>
                {onAnalyzeImage && (
                  <button
                    type="button"
                    onClick={() => onAnalyzeImage({ ...att, fileUrl: fullUrl, fileName })}
                    className="flex min-h-9 w-full items-center justify-center gap-1.5 border-t border-border bg-card px-2 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/[0.06] cursor-pointer"
                    aria-label={`Analyze ${fileName} with AI`}
                  >
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    Analyze image
                  </button>
                )}
              </div>
            ) : (
              <a
                href={fullUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 items-center gap-2 p-3 text-xs text-foreground transition-colors hover:bg-muted"
              >
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate">{fileName}</span>
              </a>
            )}
          </div>
        );
      })}

      {selectedImage && (
        <ImagePreviewModal
          isOpen
          fileUrl={selectedImage.url}
          fileName={selectedImage.name}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </div>
  );
};
