import React from 'react';
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Dialog,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { Download, X, ExternalLink, FileText, Loader2 } from "lucide-react";

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string | null;
  title: string;
}

export function DocumentViewerModal({ isOpen, onClose, url, title }: DocumentViewerModalProps) {
  const [loading, setLoading] = React.useState(true);
  const [downloading, setDownloading] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) setLoading(true);
  }, [isOpen, url]);

  const handleDownload = async () => {
    if (!url) return;
    setDownloading(true);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const ext = blob.type.includes('pdf') ? 'pdf'
        : blob.type.includes('png') ? 'png'
        : blob.type.includes('jpeg') || blob.type.includes('jpg') ? 'jpg'
        : url.split('.').pop()?.split('?')[0] ?? 'pdf';
      const filename = `${title.replace(/\s+/g, '_')}.${ext}`;
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank');
    } finally {
      setDownloading(false);
    }
  };

  if (!url) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
            "max-w-5xl w-full h-[90vh] flex flex-col p-0 gap-0 overflow-hidden",
            "bg-[#1f1a14] border-none shadow-2xl rounded-lg",
            "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"
          )}
        >
        <DialogHeader className="p-4 bg-[#14110d] border-b border-[#CE9F48]/20 flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#CE9F48]/10 text-[#CE9F48]">
              <FileText className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-black text-white">
              {title}
            </DialogTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white hover:bg-white/10"
              onClick={() => window.open(url, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir em nova aba
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-400 hover:text-white hover:bg-white/10 h-8 w-8"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 relative bg-neutral-900 overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1f1a14] z-10">
              <Loader2 className="h-10 w-10 text-[#CE9F48] animate-spin mb-4" />
              <p className="text-[#8a7b66] animate-pulse font-medium">Carregando documento...</p>
            </div>
          )}
          
          <iframe
            src={url}
            className="w-full h-full border-none"
            onLoad={() => setLoading(false)}
            title={title}
          />
        </div>

        <div className="p-4 bg-[#14110d] border-t border-[#CE9F48]/10 flex justify-end shrink-0">
          <Button
            className="bg-[#CE9F48] text-black hover:bg-[#b8892f] font-bold"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading
              ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              : <Download className="h-4 w-4 mr-2" />}
            {downloading ? 'Baixando...' : 'Download'}
          </Button>
        </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
