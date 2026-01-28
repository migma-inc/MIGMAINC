import { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSecureUrl } from '@/lib/storage';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title?: string;
}

export function ImageModal({ isOpen, onClose, imageUrl, title = 'Image' }: ImageModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finalUrl, setFinalUrl] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!isOpen || !imageUrl) {
      setLoading(false);
      setError(null);
      setFinalUrl(null);
      setRetryCount(0);
      return;
    }

    // Reset states when modal opens
    setLoading(true);
    setError(null);
    setFinalUrl(null);

    const loadImageUrl = async () => {
      try {
        const secureUrl = await getSecureUrl(imageUrl);
        setFinalUrl(secureUrl);
      } catch (err) {
        console.error('[ImageModal] Error loading image URL:', err);
        setError(err instanceof Error ? err.message : 'Failed to load image');
        setFinalUrl(imageUrl);
      } finally {
        setLoading(false);
      }
    };

    loadImageUrl();
  }, [isOpen, imageUrl, retryCount]);

  const handleImageLoad = () => {
    setLoading(false);
    setError(null);
  };

  const handleImageError = () => {
    setLoading(false);
    setError('Failed to load image. The file may be corrupted or inaccessible.');
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setError(null);
    setLoading(true);
  };

  if (!isOpen) return null;

  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(imageUrl);
  const isPdf = /\.pdf$/i.test(imageUrl);
  const displayUrl = finalUrl || imageUrl;

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
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-8 h-8 text-gold-light animate-spin" />
              <p className="text-gray-400 text-sm">Loading image...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <AlertCircle className="w-12 h-12 text-red-400" />
              <p className="text-red-400 font-medium">{error}</p>
              <Button
                onClick={handleRetry}
                variant="outline"
                className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium"
              >
                Retry
              </Button>
              <a
                href={displayUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold-light hover:text-gold-medium text-sm underline"
              >
                Try opening in new tab
              </a>
            </div>
          ) : isPdf ? (
            <iframe
              src={displayUrl}
              className="w-full h-full min-h-[600px] border-0"
              title={title}
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
          ) : isImage ? (
            <img
              src={displayUrl}
              alt={title}
              className="max-w-full max-h-[70vh] object-contain rounded-md"
              onLoad={handleImageLoad}
              onError={handleImageError}
              loading="eager"
            />
          ) : (
            <div className="text-center text-gray-400">
              <p>Unsupported file type</p>
              <a
                href={displayUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold-light hover:text-gold-medium mt-2 inline-block"
              >
                Open in new tab
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

