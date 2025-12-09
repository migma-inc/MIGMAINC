import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title?: string;
}

export function ImageModal({ isOpen, onClose, imageUrl, title = 'Image' }: ImageModalProps) {
  if (!isOpen) return null;

  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(imageUrl);
  const isPdf = /\.pdf$/i.test(imageUrl);

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
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
          {isPdf ? (
            <iframe
              src={imageUrl}
              className="w-full h-full min-h-[600px] border-0"
              title={title}
            />
          ) : isImage ? (
            <img
              src={imageUrl}
              alt={title}
              className="max-w-full max-h-[70vh] object-contain rounded-md"
            />
          ) : (
            <div className="text-center text-gray-400">
              <p>Unsupported file type</p>
              <a
                href={imageUrl}
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

