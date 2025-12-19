import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle, Camera } from 'lucide-react';

interface ContractSigningProps {
  onComplete: (data: {
    documentUrl: string;
    selfieUrl: string;
    accepted: boolean;
  }) => void;
  onCancel?: () => void;
}

export const ContractSigning = ({ onComplete }: ContractSigningProps) => {
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const selfieInputRef = useRef<HTMLInputElement>(null);

  // Handle selfie upload
  const handleSelfieChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type (only images)
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPG, PNG)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setSelfieFile(file);
    setError('');

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setSelfiePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Upload file to Supabase Storage
  const uploadFile = async (): Promise<string> => {
    if (!selfieFile) {
      throw new Error('Selfie file is required');
    }

    const { supabase } = await import('@/lib/supabase');

    // Upload selfie
    const selfieExt = selfieFile.name.split('.').pop();
    const selfieFileName = `contracts/selfies/${Date.now()}-${Math.random().toString(36).substring(7)}.${selfieExt}`;
    
    const { error: selfieError } = await supabase.storage
      .from('visa-documents')
      .upload(selfieFileName, selfieFile);

    if (selfieError) throw selfieError;

    const { data: { publicUrl: selfieUrl } } = supabase.storage
      .from('visa-documents')
      .getPublicUrl(selfieFileName);

    return selfieUrl;
  };

  // Handle final submission
  const handleSubmit = async () => {
    if (!termsAccepted) {
      setError('Please accept the contract terms');
      return;
    }

    if (!selfieFile) {
      setError('Please upload the selfie with document');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const selfieUrl = await uploadFile();
      
      // Use the same selfie URL for document URL since it's all in one photo
      onComplete({
        documentUrl: selfieUrl, // Same as selfie since it's all in one
        selfieUrl,
        accepted: true,
      });
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload document. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
      <CardHeader>
        <CardTitle className="text-white">Electronic Contract Signing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-300 p-3 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Upload Selfie with Document</h3>
            <div className="flex gap-4 items-start mb-4">
              <div className="flex-1">
                <p className="text-sm text-gray-400">
                  Please take a selfie holding your identity document (RG, Passport, or Driver's License) next to your face. Make sure both your face and the document are clearly visible.
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="selfie" className="text-white">
              Selfie with Document *
            </Label>
            <div className="border-2 border-dashed border-gold-medium/50 rounded-md p-6 text-center hover:bg-white/5 transition cursor-pointer">
              <input
                ref={selfieInputRef}
                type="file"
                id="selfie"
                accept="image/*"
                capture="user"
                onChange={handleSelfieChange}
                className="hidden"
              />
              <label htmlFor="selfie" className="cursor-pointer">
                {selfiePreview ? (
                  <div className="space-y-2">
                    <img
                      src={selfiePreview}
                      alt="Selfie preview"
                      className="max-h-48 mx-auto rounded-md border border-gold-medium/30"
                    />
                    <p className="text-sm text-gold-light mt-2">✓ {selfieFile?.name}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelfieFile(null);
                        setSelfiePreview(null);
                        if (selfieInputRef.current) {
                          selfieInputRef.current.value = '';
                        }
                      }}
                      className="mt-2 border-gold-medium/50 text-white hover:bg-gold-medium/20"
                    >
                      Retake Photo
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Camera className="h-12 w-12 text-gold-light mx-auto mb-2" />
                    <p className="text-sm text-white">Click to take or upload selfie</p>
                    <p className="text-xs text-gray-400 mt-1">JPG or PNG (max 5MB)</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Terms Acceptance */}
          <div className="border-t border-gold-medium/30 pt-4">
            <div className="flex items-start space-x-2">
              <Checkbox
                id="contract-terms"
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(checked === true)}
              />
              <Label htmlFor="contract-terms" className="text-white cursor-pointer text-sm">
                I confirm that the document uploaded is authentic and belongs to me. I understand that providing false information may result in cancellation of services and legal action. *
              </Label>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={!termsAccepted || !selfieFile || uploading}
              className="bg-gold-medium hover:bg-gold-light text-black"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2" />
                  Uploading...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Sign Contract
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};





















