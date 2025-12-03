/**
 * Component for uploading identity photo (selfie with document)
 * Required for accepting partner terms
 */

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, CheckCircle, AlertCircle, Upload, Camera, FileImage } from 'lucide-react';

interface IdentityPhotoUploadProps {
  onUploadSuccess: (filePath: string, fileName: string) => void;
  onUploadError?: (error: string) => void;
  required?: boolean;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

export function IdentityPhotoUpload({ 
  onUploadSuccess, 
  onUploadError,
  required = true 
}: IdentityPhotoUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(false);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      // Simulate file input change
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(droppedFile);
      if (fileInputRef.current) {
        fileInputRef.current.files = dataTransfer.files;
        const event = new Event('change', { bubbles: true });
        fileInputRef.current.dispatchEvent(event);
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setError(null);
    setUploaded(false);
    setFile(selectedFile);

    // Validate file type
    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      const errorMsg = 'Only JPG and PNG images are allowed';
      setError(errorMsg);
      setFile(null);
      if (onUploadError) onUploadError(errorMsg);
      return;
    }

    // Validate file size
    if (selectedFile.size > MAX_FILE_SIZE) {
      const errorMsg = 'File size must be less than 5MB';
      setError(errorMsg);
      setFile(null);
      if (onUploadError) onUploadError(errorMsg);
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);

    // Upload automatically after validation
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch(`${SUPABASE_URL}/functions/v1/upload-identity-photo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to upload photo');
      }

      setUploaded(true);
      setUploadedPath(result.filePath);
      onUploadSuccess(result.filePath, result.fileName);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to upload photo';
      setError(errorMsg);
      setFile(null);
      setPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (onUploadError) onUploadError(errorMsg);
    } finally {
      setUploading(false);
    }
  };


  const handleRemove = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    setUploaded(false);
    setUploadedPath(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Example Photo */}
      {!uploaded && !preview && (
        <div className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border-2 border-gold-medium/50 rounded-lg p-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-shrink-0">
              <div className="relative">
                <img
                  src="/helpselfie.png"
                  alt="Example: How to take your identity photo"
                  className="w-48 h-auto rounded-lg shadow-lg border-2 border-gold-medium/50"
                />
                <div className="absolute -top-2 -right-2 bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-xs font-bold shadow-lg">
                  ✓
                </div>
              </div>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-lg font-bold text-gold-light mb-2">📸 Example Photo</h3>
              <p className="text-sm text-gray-300 mb-3">
                This is how your photo should look: <strong className="text-gold-light">your face clearly visible</strong> while holding your <strong className="text-gold-light">ID document</strong> next to it.
              </p>
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                <span className="px-3 py-1 bg-gold-medium/20 text-gold-light border border-gold-medium/50 rounded-full text-xs font-medium">✓ Face visible</span>
                <span className="px-3 py-1 bg-gold-medium/20 text-gold-light border border-gold-medium/50 rounded-full text-xs font-medium">✓ Document clear</span>
                <span className="px-3 py-1 bg-gold-medium/20 text-gold-light border border-gold-medium/50 rounded-full text-xs font-medium">✓ Good lighting</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drag and Drop Area */}
      {!uploaded && !preview && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-all duration-200
            ${isDragging 
              ? 'border-gold-medium bg-gold-medium/20 scale-105' 
              : 'border-gold-medium/50 bg-gold-light/5 hover:border-gold-medium hover:bg-gold-medium/10'
            }
          `}
        >
          <input
            ref={fileInputRef}
            id="identity-photo"
            type="file"
            accept="image/jpeg,image/jpg,image/png"
            onChange={handleFileSelect}
            disabled={uploading}
            className="hidden"
          />

          <div className="flex flex-col items-center gap-4">
            <div className={`
              w-20 h-20 rounded-full flex items-center justify-center
              ${isDragging ? 'bg-gold-medium' : 'bg-gold-medium/20'}
              transition-colors duration-200
            `}>
              {isDragging ? (
                <Upload className="w-10 h-10 text-black" />
              ) : (
                <Camera className="w-10 h-10 text-gold-medium" />
              )}
            </div>
            
            <div>
              <p className="text-xl font-bold text-white mb-2">
                {isDragging ? 'Drop your photo here' : 'Click or drag to upload your photo'}
              </p>
              <p className="text-sm text-gray-300 mb-1">
                Take a photo of yourself holding your ID document
              </p>
              <p className="text-xs text-gray-400">
                Supported formats: JPG, PNG (Max 5MB)
              </p>
            </div>

            <Button
              type="button"
              variant="default"
              size="lg"
              className="mt-2 bg-gradient-to-b from-gold-dark via-gold-medium to-gold-dark hover:opacity-90 text-black px-8 py-6 text-base font-semibold border border-gold-medium/50"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <FileImage className="w-5 h-5 mr-2" />
              Choose Photo
            </Button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 text-red-300 text-sm bg-red-900/30 p-4 rounded-md border border-red-500/50">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {uploaded && uploadedPath && (
        <div className="flex items-center gap-3 text-green-300 text-sm bg-green-900/30 p-4 rounded-md border border-green-500/50">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Photo uploaded successfully!</p>
            <p className="text-xs text-green-200 mt-1">Your identity verification is complete</p>
          </div>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="mt-4 relative inline-block w-full">
          <div className="relative rounded-lg border-2 border-gold-medium/50 overflow-hidden bg-black/30 p-4">
            <img
              src={preview}
              alt="Preview"
              className="max-w-full h-auto max-h-80 mx-auto rounded-lg shadow-md"
            />
            {uploading && (
              <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center rounded-lg">
                <div className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 rounded-lg p-6 shadow-xl text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-gold-medium border-t-transparent mx-auto"></div>
                  <p className="text-base text-gold-light mt-4 font-semibold">Uploading your photo...</p>
                  <p className="text-sm text-gray-400 mt-1">Please wait</p>
                </div>
              </div>
            )}
            {!uploaded && !uploading && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-6 right-6 shadow-lg bg-red-600 hover:bg-red-700"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove();
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

