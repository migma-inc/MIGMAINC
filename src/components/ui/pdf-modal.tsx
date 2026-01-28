import { Download, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { getSecureUrl } from '@/lib/storage';

interface PdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string;
  title?: string;
  showDownload?: boolean;
}

export function PdfModal({ isOpen, onClose, pdfUrl, title = 'Contract PDF', showDownload = true }: PdfModalProps) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && pdfUrl) {
      setLoading(true);
      getSecureUrl(pdfUrl).then(url => {
        setDisplayUrl(url);
        setLoading(false);
      }).catch(err => {
        console.error('Error loading secure PDF URL:', err);
        setLoading(false);
      });
    }
  }, [isOpen, pdfUrl]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!displayUrl) return;
    const link = document.createElement('a');
    link.href = displayUrl;
    link.download = title.replace(/\s+/g, '-') + '.pdf';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gold-medium/30">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <div className="flex gap-2">
            {showDownload && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={!displayUrl}
                className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium"
            >
              <X className="w-4 h-4 mr-2" />
              Close
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
          {loading || !displayUrl ? (
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-8 h-8 text-gold-light animate-spin" />
              <p className="text-gray-400 text-sm">Loading secure PDF...</p>
            </div>
          ) : (
            <iframe
              src={displayUrl}
              className="w-full h-full min-h-[600px] border-0"
              title={title}
            />
          )}
        </div>
      </div>
    </div>
  );
}

