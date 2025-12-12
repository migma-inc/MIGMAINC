import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Camera, Upload, X } from 'lucide-react';

interface DocumentFile {
  file: File;
  preview: string;
  type: 'document_front' | 'document_back' | 'selfie_doc';
}

interface DocumentUploadProps {
  onComplete: (files: {
    documentFront: { file: File; url: string };
    documentBack: { file: File; url: string };
    selfie: { file: File; url: string };
  }) => void;
  onCancel?: () => void;
}

export const DocumentUpload = ({ onComplete, onCancel }: DocumentUploadProps) => {
  const [documentFront, setDocumentFront] = useState<DocumentFile | null>(null);
  const [documentBack, setDocumentBack] = useState<DocumentFile | null>(null);
  const [selfie, setSelfie] = useState<DocumentFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [documentsUploaded, setDocumentsUploaded] = useState(false);

  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  // Validate file
  const validateFile = (file: File): string | null => {
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return 'File must be JPG, PNG, or PDF';
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return 'File size must be less than 10MB';
    }

    return null;
  };

  // Handle file selection
  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'document_front' | 'document_back' | 'selfie_doc',
    setter: (file: DocumentFile | null) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setter({
          file,
          preview: reader.result as string,
          type,
        });
      };
      reader.readAsDataURL(file);
    } else {
      // For PDF, just set the file without preview
      setter({
        file,
        preview: '',
        type,
      });
    }
  };

  // Remove file
  const removeFile = (
    setter: (file: DocumentFile | null) => void,
    inputRef: React.RefObject<HTMLInputElement | null>
  ) => {
    setter(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    // Reset uploaded state when a file is removed (user wants to change documents)
    setDocumentsUploaded(false);
  };

  // Upload file to Supabase Storage
  const uploadFile = async (file: File, folder: string): Promise<string> => {
    const { supabase } = await import('@/lib/supabase');

    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('visa-documents')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('visa-documents')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  // Handle final submission
  const handleSubmit = async () => {
    if (!documentFront) {
      setError('Please upload the front of your document');
      return;
    }

    if (!documentBack) {
      setError('Please upload the back of your document');
      return;
    }

    if (!selfie) {
      setError('Please upload a selfie with your document');
      return;
    }

    setUploading(true);
    setError('');

    try {
      // Upload all files (all are required now)
      const [documentFrontUrl, documentBackUrl, selfieUrl] = await Promise.all([
        uploadFile(documentFront.file, 'documents/front'),
        uploadFile(documentBack.file, 'documents/back'),
        uploadFile(selfie.file, 'selfies'),
      ]);

      onComplete({
        documentFront: { file: documentFront.file, url: documentFrontUrl },
        documentBack: { file: documentBack.file, url: documentBackUrl },
        selfie: { file: selfie.file, url: selfieUrl },
      });
      
      // Mark documents as uploaded
      setDocumentsUploaded(true);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload documents. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const canProceed = documentFront && documentBack && selfie;

  return (
    <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
      <CardHeader>
        <CardTitle className="text-white">Upload Documents & Selfie</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-300 p-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Document Front (Required) */}
        <div className="space-y-2">
          <Label htmlFor="document-front" className="text-white">
            Document Front (Passport/ID/Driver's License) *
          </Label>
          <div className="border-2 border-dashed border-gold-medium/50 rounded-md p-6 text-center hover:bg-white/5 transition cursor-pointer">
            <input
              ref={frontInputRef}
              type="file"
              id="document-front"
              accept="image/*,.pdf"
              capture="environment"
              onChange={(e) => handleFileSelect(e, 'document_front', setDocumentFront)}
              className="hidden"
            />
            <label htmlFor="document-front" className="cursor-pointer">
              {documentFront ? (
                <div className="space-y-2">
                  {documentFront.preview ? (
                    <img
                      src={documentFront.preview}
                      alt="Document front preview"
                      className="max-h-48 mx-auto rounded-md border border-gold-medium/30"
                    />
                  ) : (
                    <div className="bg-gray-800 p-4 rounded-md">
                      <p className="text-sm text-white">PDF: {documentFront.file.name}</p>
                    </div>
                  )}
                  <p className="text-sm text-gold-light mt-2">✓ {documentFront.file.name}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(setDocumentFront, frontInputRef);
                    }}
                    className="mt-2 border-gold-medium/50 bg-black/50 text-gold-light hover:bg-gold-medium/30 hover:text-gold-light"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Remove
                  </Button>
                </div>
              ) : (
                <div>
                  <Upload className="h-12 w-12 text-gold-light mx-auto mb-2" />
                  <p className="text-sm text-white">Click to upload or take photo</p>
                  <p className="text-xs text-gray-400 mt-1">JPG, PNG or PDF (max 10MB)</p>
                </div>
              )}
            </label>
          </div>
        </div>

        {/* Document Back (Required) */}
        <div className="space-y-2">
          <Label htmlFor="document-back" className="text-white">
            Document Back *
          </Label>
          <div className="border-2 border-dashed border-gold-medium/50 rounded-md p-6 text-center hover:bg-white/5 transition cursor-pointer">
            <input
              ref={backInputRef}
              type="file"
              id="document-back"
              accept="image/*,.pdf"
              capture="environment"
              onChange={(e) => handleFileSelect(e, 'document_back', setDocumentBack)}
              className="hidden"
            />
            <label htmlFor="document-back" className="cursor-pointer">
              {documentBack ? (
                <div className="space-y-2">
                  {documentBack.preview ? (
                    <img
                      src={documentBack.preview}
                      alt="Document back preview"
                      className="max-h-48 mx-auto rounded-md border border-gold-medium/30"
                    />
                  ) : (
                    <div className="bg-gray-800 p-4 rounded-md">
                      <p className="text-sm text-white">PDF: {documentBack.file.name}</p>
                    </div>
                  )}
                  <p className="text-sm text-gold-light mt-2">✓ {documentBack.file.name}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(setDocumentBack, backInputRef);
                    }}
                    className="mt-2 border-gold-medium/50 bg-black/50 text-gold-light hover:bg-gold-medium/30 hover:text-gold-light"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Remove
                  </Button>
                </div>
              ) : (
                <div>
                  <Upload className="h-12 w-12 text-gold-light mx-auto mb-2" />
                  <p className="text-sm text-white">Click to upload or take photo</p>
                  <p className="text-xs text-gray-400 mt-1">JPG, PNG or PDF (max 10MB)</p>
                </div>
              )}
            </label>
          </div>
        </div>

        {/* Selfie with Document (Required) */}
        <div className="space-y-2">
          <Label htmlFor="selfie" className="text-white">
            Selfie with Document *
          </Label>
          <div className="flex gap-4 items-start mb-4">
            <div className="flex-1">
              <p className="text-sm text-gray-400 mb-2">
                Please take a selfie holding your identity document next to your face. Make sure both your face and the document are clearly visible.
              </p>
            </div>
            {/* Example Image - Compact */}
            <div className="flex-shrink-0">
              <p className="text-xs text-gray-500 mb-1 text-center">Example:</p>
              <img
                src="/helpselfie.png"
                alt="Example selfie with document"
                className="w-24 h-24 object-cover rounded-md border border-gold-medium/30"
              />
            </div>
          </div>
          <div className="border-2 border-dashed border-gold-medium/50 rounded-md p-6 text-center hover:bg-white/5 transition cursor-pointer">
            <input
              ref={selfieInputRef}
              type="file"
              id="selfie"
              accept="image/*"
              capture="user"
              onChange={(e) => handleFileSelect(e, 'selfie_doc', setSelfie)}
              className="hidden"
            />
            <label htmlFor="selfie" className="cursor-pointer">
              {selfie ? (
                <div className="space-y-2">
                  <img
                    src={selfie.preview}
                    alt="Selfie preview"
                    className="max-h-48 mx-auto rounded-md border border-gold-medium/30"
                  />
                  <p className="text-sm text-gold-light mt-2">✓ {selfie.file.name}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(setSelfie, selfieInputRef);
                    }}
                    className="mt-2 border-gold-medium/50 bg-black/50 text-gold-light hover:bg-gold-medium/30 hover:text-gold-light"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Retake Photo
                  </Button>
                </div>
              ) : (
                <div>
                  <Camera className="h-12 w-12 text-gold-light mx-auto mb-2" />
                  <p className="text-sm text-white">Click to take or upload selfie</p>
                  <p className="text-xs text-gray-400 mt-1">JPG or PNG (max 10MB)</p>
                </div>
              )}
            </label>
          </div>
        </div>

        {/* Only show upload button if documents haven't been uploaded yet, or if user changed files */}
        {!documentsUploaded && (
          <div className="flex justify-end gap-2">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-gold-medium/30 hover:text-gold-light"
              >
                Cancel
              </Button>
            )}
            <Button
              onClick={handleSubmit}
              disabled={!canProceed || uploading}
              className="bg-gold-medium hover:bg-gold-light text-black"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2" />
                  Uploading Documents...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload & Save Documents
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
















