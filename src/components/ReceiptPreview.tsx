import React from 'react';
import { FileText, Receipt, ExternalLink, X, Image as ImageIcon } from 'lucide-react';

interface ReceiptPreviewProps {
  url: string;
  onRemove?: () => void;
  className?: string;
}

export function ReceiptPreview({ url, onRemove, className = 'h-48' }: ReceiptPreviewProps) {
  if (!url) return null;

  const isGoogleDrive = url.includes('drive.google.com');
  const isImage =
    url.startsWith('data:image') ||
    url.startsWith('blob:') ||
    url.includes('firebasestorage.googleapis.com') ||
    /\.(jpeg|jpg|gif|png|webp|svg)(\?.*)?$/i.test(url);

  return (
    <div className={`relative w-full ${className} rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center`}>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-white text-slate-600 hover:text-red-600 rounded-full shadow-sm z-20 transition-colors cursor-pointer"
          title="Remover comprovante"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {isGoogleDrive ? (
        <div className="flex flex-col items-center justify-center p-4 text-center w-full h-full bg-gradient-to-b from-blue-50/50 to-slate-50">
          <div className="w-12 h-12 rounded-xl bg-blue-100/80 border border-blue-200 flex items-center justify-center text-blue-600 mb-2 shadow-2xs">
            <FileText className="w-6 h-6" />
          </div>
          <span className="text-xs font-bold text-slate-800 mb-0.5">Comprovante no Google Drive</span>
          <span className="text-[11px] text-slate-500 mb-3 max-w-[200px] truncate">Documento sincronizado</span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Abrir no Google Drive
          </a>
        </div>
      ) : isImage ? (
        <div className="relative group w-full h-full flex items-center justify-center p-2">
          <img
            src={url}
            alt="Comprovante"
            className="max-h-full max-w-full object-contain rounded-lg shadow-2xs"
          />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-medium text-xs gap-1.5 rounded-xl backdrop-blur-2xs cursor-pointer"
          >
            <ExternalLink className="w-4 h-4" /> Ver em tela cheia
          </a>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-4 text-center w-full h-full bg-slate-50">
          <div className="w-12 h-12 rounded-xl bg-slate-200/80 border border-slate-300 flex items-center justify-center text-slate-700 mb-2">
            <Receipt className="w-6 h-6" />
          </div>
          <span className="text-xs font-bold text-slate-800 mb-1">Comprovante Anexado</span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Visualizar Arquivo
          </a>
        </div>
      )}
    </div>
  );
}
