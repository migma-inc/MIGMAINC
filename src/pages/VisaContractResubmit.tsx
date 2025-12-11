import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { DocumentUpload } from '@/components/checkout/DocumentUpload';
import { validateResubmissionToken, resubmitContractDocuments } from '@/lib/visa-contracts';
import { AlertCircle, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';

export const VisaContractResubmit = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const hasValidatedRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [order, setOrder] = useState<any>(null);
  const [serviceRequestId, setServiceRequestId] = useState<string | null>(null);

  // Document upload state
  const [documentsUploaded, setDocumentsUploaded] = useState(false);
  const [documentFiles, setDocumentFiles] = useState<{
    documentFront: { file: File; url: string } | null;
    documentBack: { file: File; url: string } | null;
    selfie: { file: File; url: string } | null;
  } | null>(null);

  // Terms acceptance
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [dataAuthorization, setDataAuthorization] = useState(false);

  // Validate token on mount (only once)
  useEffect(() => {
    // Prevent multiple validations in React StrictMode
    if (hasValidatedRef.current) {
      console.log('[VisaContractResubmit] Already validated, skipping...');
      // But still set loading to false if we already have a result
      if (tokenValid !== null || order) {
        setLoading(false);
      }
      return;
    }
    hasValidatedRef.current = true;

    const validateToken = async () => {
      console.log('[VisaContractResubmit] Starting validation for token:', token);
      
      if (!token) {
        console.log('[VisaContractResubmit] No token provided');
        setError('No token provided. Please check the link and try again.');
        setTokenValid(false);
        setLoading(false);
        return;
      }

      // Safety timeout - if validation takes more than 30 seconds, show error
      const timeoutId = setTimeout(() => {
        console.error('[VisaContractResubmit] Validation timeout');
        setError('Validation is taking too long. Please refresh the page and try again.');
        setTokenValid(false);
        setLoading(false);
      }, 30000);

      try {
        console.log('[VisaContractResubmit] Calling validateResubmissionToken...');
        const validation = await validateResubmissionToken(token);
        clearTimeout(timeoutId);
        console.log('[VisaContractResubmit] Validation result:', validation);

        if (!validation.valid) {
          console.log('[VisaContractResubmit] Token invalid:', validation.error);
          setError(validation.error || 'Invalid token');
          setTokenValid(false);
          setLoading(false);
        } else {
          console.log('[VisaContractResubmit] Token valid, setting order:', validation.order);
          setTokenValid(true);
          setOrder(validation.order);
          if (validation.order?.service_request_id) {
            setServiceRequestId(validation.order.service_request_id);
          }
          setLoading(false);
        }
      } catch (err) {
        clearTimeout(timeoutId);
        console.error('[VisaContractResubmit] Error validating token:', err);
        setError('Failed to validate token. Please try again.');
        setTokenValid(false);
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  // Handle document upload completion
  const handleDocumentsComplete = (files: {
    documentFront: { file: File; url: string };
    documentBack: { file: File; url: string };
    selfie: { file: File; url: string };
  }) => {
    // Prevent multiple calls
    if (documentsUploaded) return;
    
    setDocumentFiles(files);
    setDocumentsUploaded(true);
    setError(null);
  };

  // Handle resubmission
  const handleResubmit = async () => {
    if (!termsAccepted || !dataAuthorization) {
      setError('Please accept both terms and conditions');
      return;
    }

    if (!documentsUploaded || !documentFiles) {
      setError('Please upload all required documents (front, back, and selfie)');
      return;
    }

    if (!documentFiles.documentFront || !documentFiles.documentBack || !documentFiles.selfie) {
      setError('Please upload all required documents (front, back, and selfie)');
      return;
    }

    if (!serviceRequestId) {
      setError('Service request not found. Please contact support.');
      return;
    }

    if (!token) {
      setError('Token not found. Please check the link and try again.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await resubmitContractDocuments(
        token,
        {
          documentFront: documentFiles.documentFront,
          documentBack: documentFiles.documentBack,
          selfie: documentFiles.selfie,
        },
        serviceRequestId
      );

      if (result.success) {
        setSuccess(true);
        // Don't redirect - show success message on this page
      } else {
        setError(result.error || 'Failed to resubmit documents. Please try again.');
      }
    } catch (err) {
      console.error('Error resubmitting documents:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-medium mx-auto"></div>
          <p className="mt-4 text-gray-400">Validating your link...</p>
        </div>
      </div>
    );
  }

  if (!tokenValid || !order) {
    // Check if error message indicates token was already used
    const isAlreadyUsed = error?.includes('already resubmitted');
    
    return (
      <div className="min-h-screen bg-black py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                {isAlreadyUsed ? (
                  <>
                    <CheckCircle2 className="w-6 h-6 text-yellow-400" />
                    <h2 className="text-xl font-bold text-yellow-300">Documents Already Resubmitted</h2>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-6 h-6 text-red-300" />
                    <h2 className="text-xl font-bold text-red-300">Invalid Link</h2>
                  </>
                )}
              </div>
              <p className="text-gray-300 mb-4">{error || 'This link is invalid.'}</p>
              {isAlreadyUsed ? (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
                  <p className="text-yellow-200 text-sm">
                    Your documents have already been resubmitted using this link. Our team is reviewing your submission.
                  </p>
                </div>
              ) : (
                <p className="text-gray-400 text-sm mb-6">
                  If you need to resubmit your documents, please contact our support team for a new link.
                </p>
              )}
              <Button
                onClick={() => navigate('/')}
                className="bg-gold-medium hover:bg-gold-light text-black"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go to Homepage
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-black py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardContent className="p-8 text-center">
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-green-500/20 rounded-full">
                  <CheckCircle2 className="w-20 h-20 text-green-400" />
                </div>
              </div>
              <h2 className="text-3xl font-bold migma-gold-text mb-4">
                Documents Resubmitted Successfully!
              </h2>
              <p className="text-gray-300 mb-6 text-lg">
                Your documents have been received and your contract is being reviewed again.
              </p>
              
              {order && (
                <div className="bg-black/50 rounded-lg p-6 mb-6 text-left">
                  <h3 className="text-white font-semibold mb-4">Order Information</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Order Number:</span>
                      <span className="text-white font-mono">{order.order_number}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
                <p className="text-blue-300 text-sm">
                  <strong>What happens next?</strong>
                </p>
                <p className="text-gray-300 text-sm mt-2">
                  Our team will review your resubmitted documents. Please check your order status regularly for updates.
                </p>
              </div>

              <div className="flex gap-4 justify-center">
                <Button
                  onClick={() => navigate('/')}
                  className="bg-gold-medium hover:bg-gold-light text-black"
                >
                  Go to Homepage
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold migma-gold-text mb-2">Resubmit Documents</h1>
          <p className="text-gray-400">
            Order #{order.order_number} - {order.client_name}
          </p>
        </div>

        {/* Order Information */}
        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 mb-6">
          <CardHeader>
            <CardTitle className="text-white">Order Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Order Number:</span>
              <span className="text-white font-mono">{order.order_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Status:</span>
              <span className="text-yellow-400 font-semibold">Documents Resubmission Required</span>
            </div>
          </CardContent>
        </Card>

        {/* Error Message */}
        {error && (
          <Card className="bg-red-900/30 border border-red-500/50 mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-300">
                <AlertCircle className="w-5 h-5" />
                <p>{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Document Upload */}
        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 mb-6">
          <CardHeader>
            <CardTitle className="text-white">Upload Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400 mb-4 text-sm">
              Please upload clear photos of your identity documents. All three documents are required.
            </p>
            {tokenValid && order && (
              <DocumentUpload
                key={`doc-upload-${order.id}`}
                onComplete={handleDocumentsComplete}
                onCancel={() => {
                  setDocumentsUploaded(false);
                  setDocumentFiles(null);
                }}
              />
            )}
          </CardContent>
        </Card>

        {/* Terms Acceptance */}
        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 mb-6">
          <CardHeader>
            <CardTitle className="text-white">Terms & Conditions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="terms"
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                className="mt-1"
              />
              <Label htmlFor="terms" className="text-gray-300 cursor-pointer">
                I accept the <a href="/legal/visa-service-terms" target="_blank" className="text-gold-light hover:underline">Visa Service Terms & Conditions</a>
              </Label>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                id="data-auth"
                checked={dataAuthorization}
                onCheckedChange={(checked) => setDataAuthorization(checked === true)}
                className="mt-1"
              />
              <Label htmlFor="data-auth" className="text-gray-300 cursor-pointer">
                I authorize MIGMA to process my personal data as described in the Privacy Policy
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button
            variant="outline"
            onClick={() => navigate('/')}
            className="border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30"
          >
            Cancel
          </Button>
          <Button
            onClick={handleResubmit}
            disabled={submitting || !documentsUploaded || !termsAccepted || !dataAuthorization}
            className="bg-gradient-to-b from-gold-dark via-gold-medium to-gold-dark hover:opacity-90 text-black px-8 py-6 text-base font-semibold border border-gold-medium/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Resubmit Documents'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};



