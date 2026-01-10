import { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

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
        // Check if URL is already a full HTTP URL (most common case)
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
          // Pre-validate the URL by trying to fetch it
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
          
          try {
            const response = await fetch(imageUrl, {
              method: 'HEAD',
              signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
              setFinalUrl(imageUrl);
              return;
            } else {
              // If HEAD fails, try to extract path and get signed URL
              throw new Error('Public URL not accessible');
            }
          } catch (fetchError) {
            clearTimeout(timeoutId);
            
            // If it's a Supabase Storage URL, try to extract path and get signed URL
            if (imageUrl.includes('/storage/v1/object/public/zelle_comprovantes/')) {
              const pathMatch = imageUrl.match(/\/zelle_comprovantes\/(.+)$/);
              if (pathMatch && pathMatch[1]) {
                const storagePath = pathMatch[1];
                
                // Try signed URL as fallback
                const { data: signedData, error: signedError } = await supabase.storage
                  .from('zelle_comprovantes')
                  .createSignedUrl(storagePath, 3600); // 1 hour

                if (!signedError && signedData?.signedUrl) {
                  setFinalUrl(signedData.signedUrl);
                  return;
                }
              }
            }
            
            // If all else fails, still try to use the original URL
            // Sometimes the image loads even if HEAD fails
            setFinalUrl(imageUrl);
            return;
          }
        }

        // If it's a storage path (not a full URL), convert it
        if (imageUrl.includes('zelle-payments/') || imageUrl.includes('zelle_comprovantes')) {
          let storagePath = imageUrl;
          
          // If it's a full storage URL, extract just the path
          if (imageUrl.includes('/storage/v1/object/public/')) {
            const parts = imageUrl.split('/storage/v1/object/public/');
            if (parts.length > 1) {
              storagePath = parts[1].split('/').slice(1).join('/'); // Remove bucket name
            }
          } else if (imageUrl.startsWith('zelle-payments/')) {
            storagePath = imageUrl;
          }

          // Try public URL first (faster)
          const { data: publicUrlData } = supabase.storage
            .from('zelle_comprovantes')
            .getPublicUrl(storagePath);

          if (publicUrlData?.publicUrl) {
            setFinalUrl(publicUrlData.publicUrl);
            return;
          }

          // Fallback: try signed URL (slower but more reliable)
          const { data: signedData, error: signedError } = await supabase.storage
            .from('zelle_comprovantes')
            .createSignedUrl(storagePath, 3600); // 1 hour

          if (!signedError && signedData?.signedUrl) {
            setFinalUrl(signedData.signedUrl);
            return;
          }

          throw new Error('Failed to generate image URL');
        }

        // If it's already a valid URL, use it
        setFinalUrl(imageUrl);
      } catch (err) {
        console.error('[ImageModal] Error loading image URL:', err);
        setError(err instanceof Error ? err.message : 'Failed to load image');
        // Still try to use the original URL as last resort
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

