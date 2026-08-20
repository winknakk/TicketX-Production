import React, { useState, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCw, Download, ExternalLink, X } from 'lucide-react';

interface ImagePreviewModalProps {
  isOpen: boolean;
  fileUrl: string;
  fileName: string;
  onClose: () => void;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  isOpen,
  fileUrl,
  fileName,
  onClose
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
    }
  }, [isOpen, fileUrl]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z + 0.25, 3));
      if (e.key === '-') setZoom(z => Math.max(z - 0.25, 0.5));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col items-center bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        {/* Header Toolbar */}
        <div className="w-full flex justify-between items-center px-5 py-3 bg-slate-950/80 border-b border-slate-800 text-white shrink-0">
          <div className="flex items-center gap-2 max-w-md">
            <span className="text-sm font-semibold truncate text-slate-200">{fileName}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setZoom(z => Math.min(z + 0.25, 3))}
              className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
              title="Zoom In (+)"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))}
              className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
              title="Zoom Out (-)"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              onClick={() => setRotation(r => (r + 90) % 360)}
              className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
              title="Rotate"
            >
              <RotateCw className="h-4 w-4" />
            </button>

            <div className="h-4 w-px bg-slate-800 mx-1" />

            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
              title="Open in new tab"
            >
              <ExternalLink className="h-4 w-4" />
            </a>

            <a
              href={fileUrl}
              download={fileName}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition"
            >
              <Download className="h-3.5 w-3.5" /> Download
            </a>

            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition ml-2"
              title="Close (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Image Preview Canvas */}
        <div className="flex-1 w-full flex items-center justify-center p-6 overflow-auto min-h-[50vh] max-h-[80vh] select-none bg-slate-950/40">
          <img
            src={fileUrl}
            alt={fileName}
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            className="max-w-full max-h-[72vh] object-contain rounded-lg shadow-lg cursor-grab active:cursor-grabbing"
          />
        </div>
      </div>
    </div>
  );
};
