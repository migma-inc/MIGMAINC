/**
 * Application Detail Page
 * Shows complete information about a Global Partner application
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { approveApplication, rejectApplication } from '@/lib/admin';
import type { Application } from '@/types/application';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Download, CheckCircle, XCircle, ExternalLink, X } from 'lucide-react';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { PromptModal } from '@/components/ui/prompt-modal';
import { AlertModal } from '@/components/ui/alert-modal';

function StatusBadge({ status }: { status: Application['status'] }) {
  const variants = {
    pending: 'bg-gold-medium/30 text-white border-gold-medium/50',
    approved: 'bg-green-900/30 text-green-300 border-green-500/50',
    rejected: 'bg-red-900/30 text-red-300 border-red-500/50',
  };

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${variants[status]}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function ApplicationDetailContent() {
  const { id } = useParams<{ id: string }>();
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cvUrl, setCvUrl] = useState<string | null>(null);
  const [showCVModal, setShowCVModal] = useState(false);
  
  // Modal states
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showRejectPrompt, setShowRejectPrompt] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertData, setAlertData] = useState<{ title: string; message: string; variant: 'success' | 'error' | 'warning' | 'info' } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    async function loadApplication() {
      if (!id) {
        setError('Application ID is required');
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('global_partner_applications')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError) {
          throw fetchError;
        }

        if (!data) {
          setError('Application not found');
          setLoading(false);
          return;
        }

        setApplication(data as Application);

        // Get CV URL if available
        if (data.cv_file_path) {
          try {
            // Try public URL first
            const { data: urlData } = supabase.storage
              .from('cv-files')
              .getPublicUrl(data.cv_file_path);
            
            if (urlData?.publicUrl) {
              setCvUrl(urlData.publicUrl);
            } else {
              // Fallback: try signed URL (valid for 1 hour)
              const { data: signedData, error: signedError } = await supabase.storage
                .from('cv-files')
                .createSignedUrl(data.cv_file_path, 3600); // 1 hour
              
              if (!signedError && signedData?.signedUrl) {
                setCvUrl(signedData.signedUrl);
              } else {
                console.error('[ApplicationDetail] Error getting CV URL:', signedError);
              }
            }
          } catch (urlError) {
            console.error('[ApplicationDetail] Error generating CV URL:', urlError);
          }
        }
      } catch (err) {
        console.error('[ApplicationDetail] Error loading application:', err);
        setError(err instanceof Error ? err.message : 'Failed to load application');
      } finally {
        setLoading(false);
      }
    }

    loadApplication();
  }, [id]);

  const handleApprove = async () => {
    if (!application) return;
    setShowApproveConfirm(true);
  };

  const confirmApprove = async () => {
    if (!application) return;
    
    setShowApproveConfirm(false);
    setIsProcessing(true);
    try {
      const result = await approveApplication(application.id);
      if (result.success) {
        setAlertData({
          title: 'Success',
          message: 'Application approved successfully! Email sent.',
          variant: 'success',
        });
        setShowAlert(true);
        // Reload application to get updated status after alert is closed
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setAlertData({
          title: 'Error',
          message: result.error || 'Failed to approve application',
          variant: 'error',
        });
        setShowAlert(true);
      }
    } catch (error) {
      setAlertData({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'error',
      });
      setShowAlert(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!application) return;
    setRejectionReason('');
    setShowRejectPrompt(true);
  };

  const handleRejectReasonSubmit = (reason: string) => {
    setShowRejectPrompt(false);
    setRejectionReason(reason);
    setShowRejectConfirm(true);
  };

  const confirmReject = async () => {
    if (!application) return;
    
    setShowRejectConfirm(false);
    setIsProcessing(true);
    try {
      const result = await rejectApplication(application.id, rejectionReason || undefined);
      if (result.success) {
        setAlertData({
          title: 'Success',
          message: 'Application rejected successfully.',
          variant: 'success',
        });
        setShowAlert(true);
        // Reload application to get updated status after alert is closed
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setAlertData({
          title: 'Error',
          message: result.error || 'Failed to reject application',
          variant: 'error',
        });
        setShowAlert(true);
      }
    } catch (error) {
      setAlertData({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'error',
      });
      setShowAlert(true);
    } finally {
      setIsProcessing(false);
      setRejectionReason('');
    }
  };

  const handleViewCV = async () => {
    if (!application?.cv_file_path) {
      alert('CV file not available');
      return;
    }

    try {
      // Ensure we have a valid URL
      let urlToUse = cvUrl;
      
      if (!urlToUse) {
        const { data: signedData, error: signedError } = await supabase.storage
          .from('cv-files')
          .createSignedUrl(application.cv_file_path, 3600);
        
        if (signedError || !signedData?.signedUrl) {
          alert('Error accessing CV file. Please try again later.');
          console.error('[ApplicationDetail] Error creating signed URL:', signedError);
          return;
        }
        
        urlToUse = signedData.signedUrl;
        setCvUrl(urlToUse);
      }
      
      setShowCVModal(true);
    } catch (error) {
      console.error('[ApplicationDetail] Error loading CV:', error);
      alert('Error accessing CV file. Please try again later.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-medium mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading application...</p>
        </div>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="p-6">
        <Card className="w-full max-w-md mx-auto bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
          <CardContent className="p-6 text-center">
            <p className="text-red-300 mb-4">{error || 'Application not found'}</p>
            <Link to="/dashboard">
              <Button variant="outline" className="border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30 hover:text-gold-light">Back to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon" className="text-white hover:text-white hover:bg-transparent">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold migma-gold-text">Application Details</h1>
            <p className="text-sm text-gray-400">ID: {application.id.substring(0, 8)}...</p>
          </div>
          <StatusBadge status={application.status} />
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
          {/* Personal Information */}
          <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardHeader>
              <CardTitle className="text-white">Personal Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Full Name</p>
                  <p className="font-medium text-lg text-gray-200">{application.full_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Email</p>
                  <p className="font-medium text-gray-200">{application.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Phone</p>
                  <p className="font-medium text-gray-200">{application.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Country</p>
                  <p className="font-medium text-gray-200">{application.country}</p>
                </div>
                {application.city && (
                  <div>
                    <p className="text-sm text-gray-400 mb-1">City</p>
                    <p className="font-medium text-gray-200">{application.city}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-400 mb-1">Submitted</p>
                  <p className="font-medium text-gray-200">
                    {new Date(application.created_at).toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Business Information */}
          <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardHeader>
              <CardTitle className="text-white">Business Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Has Business Registration</p>
                  <p className="font-medium text-gray-200">{application.has_business_registration}</p>
                </div>
                {application.business_name && (
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Business Name</p>
                    <p className="font-medium text-gray-200">{application.business_name}</p>
                  </div>
                )}
                {application.business_id && (
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Business ID (CNPJ/NIF)</p>
                    <p className="font-medium text-gray-200">{application.business_id}</p>
                  </div>
                )}
                {application.tax_id && (
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Tax ID</p>
                    <p className="font-medium text-gray-200">{application.tax_id}</p>
                  </div>
                )}
                {application.registration_type && (
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Registration Type</p>
                    <p className="font-medium text-gray-200">{application.registration_type}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Professional Information */}
          <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardHeader>
              <CardTitle className="text-white">Professional Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {application.current_occupation && (
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Current Occupation</p>
                    <p className="font-medium text-gray-200">{application.current_occupation}</p>
                  </div>
                )}
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-400 mb-2">Area of Expertise</p>
                  <div className="flex flex-wrap gap-2">
                    {application.area_of_expertise.map((area, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-gold-medium/30 text-white border border-gold-medium/50 rounded-full text-sm font-medium"
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
                {application.interested_roles && application.interested_roles.length > 0 && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-gray-400 mb-2">Interested Roles</p>
                    <div className="flex flex-wrap gap-2">
                      {application.interested_roles.map((role, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-purple-500/30 text-white border border-purple-500/50 rounded-full text-sm font-medium"
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-400 mb-1">Years of Experience</p>
                  <p className="font-medium text-gray-200">{application.years_of_experience}</p>
                </div>
                {application.visa_experience && (
                  <div>
                    <p className="text-sm text-gray-400 mb-1">U.S. Visa Experience</p>
                    <p className="font-medium text-gray-200">{application.visa_experience}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-400 mb-1">English Level</p>
                  <p className="font-medium text-gray-200">{application.english_level}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Client Experience</p>
                  <p className="font-medium text-gray-200">{application.client_experience}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Weekly Availability</p>
                  <p className="font-medium text-gray-200">{application.weekly_availability}</p>
                </div>
                {application.client_experience_description && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-gray-400 mb-1">Client Experience Description</p>
                    <p className="font-medium text-gray-200 whitespace-pre-wrap">{application.client_experience_description}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Additional Information */}
          <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardHeader>
              <CardTitle className="text-white">Additional Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <p className="text-sm text-gray-400 mb-2">Why MIGMA?</p>
                  <p className="font-medium whitespace-pre-wrap bg-black/30 border border-gold-medium/30 p-4 rounded-lg text-gray-200">
                    {application.why_migma}
                  </p>
                </div>
                {application.linkedin_url && (
                  <div>
                    <p className="text-sm text-gray-400 mb-1">LinkedIn</p>
                    <a
                      href={application.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gold-light hover:text-white hover:underline flex items-center gap-2"
                    >
                      {application.linkedin_url}
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                )}
                {application.other_links && (
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Other Links</p>
                    <a
                      href={application.other_links}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gold-light hover:text-white hover:underline flex items-center gap-2"
                    >
                      {application.other_links}
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                )}
                {application.cv_file_name && (
                  <div>
                    <p className="text-sm text-gray-400 mb-2">CV File</p>
                    <Button
                      variant="outline"
                      onClick={handleViewCV}
                      className="flex items-center gap-2 border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30 hover:text-gold-light"
                    >
                      <Download className="w-4 h-4" />
                      View CV: {application.cv_file_name}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Consent Information */}
          <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardHeader>
              <CardTitle className="text-white">Consent & Verification</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Information Accurate</p>
                  <p className="font-medium text-gray-200">{application.info_accurate ? '✓ Confirmed' : '✗ Not confirmed'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Marketing Consent</p>
                  <p className="font-medium text-gray-200">{application.marketing_consent ? '✓ Agreed' : '✗ Not agreed'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Comfortable with Model</p>
                  <p className="font-medium text-gray-200">{application.comfortable_model ? '✓ Yes' : '✗ No'}</p>
                </div>
                {application.ip_address && (
                  <div>
                    <p className="text-sm text-gray-400 mb-1">IP Address</p>
                    <p className="font-medium font-mono text-sm text-gray-200">{application.ip_address}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Timestamps */}
          <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardHeader>
              <CardTitle className="text-white">Timestamps</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Created At</p>
                  <p className="font-medium text-gray-200">
                    {new Date(application.created_at).toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Last Updated</p>
                  <p className="font-medium text-gray-200">
                    {new Date(application.updated_at).toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          {application.status === 'pending' && (
            <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
              <CardHeader>
                <CardTitle className="text-white">Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <Button
                    onClick={handleApprove}
                    disabled={isProcessing}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve Application
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleReject}
                    disabled={isProcessing}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject Application
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

      {/* CV Modal */}
      {showCVModal && cvUrl && application && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCVModal(false)}
        >
          <div 
            className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b border-gold-medium/30">
              <div>
                <h3 className="text-lg font-semibold text-white">CV - {application?.full_name || 'Unknown'}</h3>
                <p className="text-sm text-gray-400">{application?.cv_file_name || 'CV'}</p>
              </div>
              <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30 hover:text-gold-light"
                    onClick={async () => {
                    if (!cvUrl || !application?.cv_file_name) return;
                    
                    try {
                      // Fetch the file as blob
                      const response = await fetch(cvUrl);
                      const blob = await response.blob();
                      
                      // Create a blob URL
                      const blobUrl = window.URL.createObjectURL(blob);
                      
                      // Create a temporary anchor element to trigger download
                      const link = document.createElement('a');
                      link.href = blobUrl;
                      link.download = application.cv_file_name;
                      document.body.appendChild(link);
                      link.click();
                      
                      // Clean up
                      document.body.removeChild(link);
                      window.URL.revokeObjectURL(blobUrl);
                    } catch (error) {
                      console.error('[ApplicationDetail] Error downloading CV:', error);
                      alert('Error downloading CV file. Please try again.');
                    }
                  }}
                >
                  <Download className="w-4 h-4" />
                  Download
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowCVModal(false)}
                  className="text-white hover:text-white hover:bg-transparent"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>
            
            {/* PDF Viewer */}
            <div className="flex-1 overflow-hidden">
              <iframe
                src={cvUrl || undefined}
                className="w-full h-full border-0"
                title="CV Preview"
              />
            </div>
          </div>
        </div>
      )}

      {/* Approve Confirmation Modal */}
      <ConfirmModal
        isOpen={showApproveConfirm}
        onClose={() => setShowApproveConfirm(false)}
        onConfirm={confirmApprove}
        title="Approve Application"
        message={`Are you sure you want to approve ${application?.full_name}? This will send them an email with terms link.`}
        confirmText="Approve"
        cancelText="Cancel"
        variant="default"
        isLoading={isProcessing}
      />

      {/* Reject Reason Prompt Modal */}
      <PromptModal
        isOpen={showRejectPrompt}
        onClose={() => {
          setShowRejectPrompt(false);
        }}
        onConfirm={handleRejectReasonSubmit}
        title="Reject Application"
        message={`Enter rejection reason for ${application?.full_name} (optional):`}
        placeholder="Enter rejection reason (optional)..."
        confirmText="Continue"
        cancelText="Cancel"
        variant="default"
      />

      {/* Reject Confirmation Modal */}
      <ConfirmModal
        isOpen={showRejectConfirm}
        onClose={() => {
          setShowRejectConfirm(false);
          setRejectionReason('');
        }}
        onConfirm={confirmReject}
        title="Confirm Rejection"
        message={`Are you sure you want to reject ${application?.full_name}?`}
        confirmText="Reject"
        cancelText="Cancel"
        variant="danger"
        isLoading={isProcessing}
      />

      {/* Alert Modal */}
      {alertData && (
        <AlertModal
          isOpen={showAlert}
          onClose={() => {
            setShowAlert(false);
            setAlertData(null);
          }}
          title={alertData.title}
          message={alertData.message}
          variant={alertData.variant}
        />
      )}

      {/* Processing Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Processing...</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function ApplicationDetailPage() {
  // No longer needs AdminRoute since it's inside Dashboard which already checks auth
  return <ApplicationDetailContent />;
}

