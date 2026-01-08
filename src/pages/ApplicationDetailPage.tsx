/**
 * Application Detail Page
 * Shows complete information about a Global Partner application
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { approveApplication, rejectApplication, approveApplicationForMeeting, approveApplicationAfterMeeting } from '@/lib/admin';
import { resendContractTermsEmail } from '@/lib/partner-terms';
import { approvePartnerContract, rejectPartnerContract } from '@/lib/partner-contracts';
import { getCurrentUser } from '@/lib/auth';
import type { Application } from '@/types/application';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Download, CheckCircle, XCircle, ExternalLink, X, Calendar, Clock, Link as LinkIcon, MapPin, Hash, FileCode, Globe, Shield, Pencil, Mail } from 'lucide-react';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { PromptModal } from '@/components/ui/prompt-modal';
import { AlertModal } from '@/components/ui/alert-modal';
import { MeetingScheduleModal } from '@/components/admin/MeetingScheduleModal';
import { ContractTemplateSelector } from '@/components/admin/ContractTemplateSelector';

function StatusBadge({ status }: { status: Application['status'] }) {
  const variants: Record<string, string> = {
    pending: 'bg-gold-medium/30 text-white border-gold-medium/50',
    approved: 'bg-green-900/30 text-green-300 border-green-500/50',
    approved_for_meeting: 'bg-yellow-900/30 text-yellow-300 border-yellow-500/50',
    approved_for_contract: 'bg-green-900/30 text-green-300 border-green-500/50',
    rejected: 'bg-red-900/30 text-red-300 border-red-500/50',
  };

  const displayText: Record<string, string> = {
    pending: 'Pending',
    approved: 'Approved',
    approved_for_meeting: 'Approved for Meeting',
    approved_for_contract: 'Approved for Contract',
    rejected: 'Rejected',
  };

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${variants[status] || variants.pending}`}
    >
      {displayText[status] || status}
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
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showRejectTemplateSelector, setShowRejectTemplateSelector] = useState(false);
  const [pendingRejection, setPendingRejection] = useState<{ acceptanceId: string; reason?: string } | null>(null);
  const [termsAcceptance, setTermsAcceptance] = useState<any>(null);

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

        // Load terms acceptance data if available
        const { data: acceptanceData } = await supabase
          .from('partner_terms_acceptances')
          .select('*')
          .eq('application_id', id)
          .not('accepted_at', 'is', null)
          .maybeSingle();
        
        if (acceptanceData) {
          setTermsAcceptance(acceptanceData);
        }

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
    
    // If status is pending, open meeting modal
    if (application.status === 'pending') {
      setShowMeetingModal(true);
      return;
    }
    
    // If status is approved_for_meeting, show template selector
    if (application.status === 'approved_for_meeting') {
      setShowTemplateSelector(true);
      return;
    }
    
    // For other statuses, use old flow (backward compatibility)
    setShowApproveConfirm(true);
  };

  const handleMeetingSchedule = async (data: {
    meetingDate: string;
    meetingTime: string;
    meetingLink: string;
    scheduledBy?: string;
  }) => {
    if (!application) return;
    
    setShowMeetingModal(false);
    setIsProcessing(true);
    try {
      const result = await approveApplicationForMeeting(
        application.id,
        data.meetingDate,
        data.meetingTime,
        data.meetingLink,
        data.scheduledBy
      );
      if (result.success) {
        setAlertData({
          title: 'Success',
          message: result.error || 'Meeting scheduled successfully! Email sent.',
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
          message: result.error || 'Failed to schedule meeting',
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

  const handleMeetingUpdate = async (data: {
    meetingDate: string;
    meetingTime: string;
    meetingLink: string;
    scheduledBy?: string;
  }) => {
    if (!application) return;
    
    setShowMeetingModal(false);
    setIsProcessing(true);
    try {
      const { updateMeetingInfo } = await import('@/lib/admin');
      const result = await updateMeetingInfo(
        application.id,
        data.meetingDate,
        data.meetingTime,
        data.meetingLink,
        data.scheduledBy
      );
      if (result.success) {
        setAlertData({
          title: 'Success',
          message: result.error || 'Meeting information updated successfully! Email sent.',
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
          message: result.error || 'Failed to update meeting information',
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

  const handleTemplateSelected = async (templateId: string | null) => {
    if (!application) return;
    
    setShowTemplateSelector(false);
    setIsProcessing(true);
    try {
      const result = await approveApplicationAfterMeeting(application.id, templateId);
      
      if (result.success) {
        setAlertData({
          title: 'Success',
          message: result.error || 'Application approved successfully! Email sent.',
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

  const handleResendEmail = async () => {
    if (!application) return;
    
    setIsProcessing(true);
    try {
      // Forçar uso de URL de produção
      const result = await resendContractTermsEmail(application.id, true);
      
      if (result.success) {
        setAlertData({
          title: 'Success',
          message: 'Contract terms email resent successfully! The email was sent with the production URL.',
          variant: 'success',
        });
        setShowAlert(true);
      } else {
        setAlertData({
          title: 'Error',
          message: result.error || 'Failed to resend email',
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

  const confirmApprove = async () => {
    if (!application) return;
    
    setShowApproveConfirm(false);
    setIsProcessing(true);
    try {
        // For backward compatibility with old 'approved' status
      const result = await approveApplication(application.id);
      
      if (result.success) {
        setAlertData({
          title: 'Success',
          message: result.error || 'Application approved successfully! Email sent.',
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
      <div className="p-4 sm:p-6 lg:p-8">
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
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-2">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link to="/dashboard">
              <Button variant="ghost" size="icon" className="text-white hover:text-white hover:bg-transparent">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold migma-gold-text">Application Details</h1>
              <p className="text-xs sm:text-sm text-gray-400 truncate">ID: {application.id.substring(0, 8)}...</p>
            </div>
          </div>
          <div className="flex justify-start sm:justify-end">
            <StatusBadge status={application.status} />
          </div>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Full Name</p>
                  <p className="font-medium text-base sm:text-lg text-gray-200 break-words">{application.full_name}</p>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
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

          {/* Terms Acceptance & Legal Records */}
          {termsAcceptance && (
            <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-gold-light" />
                  Terms Acceptance & Legal Records
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Terms Accepted:</span>
                    <div className="flex items-center gap-2 text-green-300">
                      <CheckCircle className="w-4 h-4" />
                      <span>Yes</span>
                    </div>
                  </div>
                  
                  {termsAcceptance.accepted_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Accepted At:</span>
                      <span className="text-white">
                        {new Date(termsAcceptance.accepted_at).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  )}

                  {(termsAcceptance.contract_version || termsAcceptance.contract_hash || termsAcceptance.geolocation_country || termsAcceptance.signature_name) && (
                    <div className="mt-4 pt-4 border-t border-gold-medium/20">
                      <h4 className="text-sm font-semibold text-gold-light mb-3">Legal Records</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {termsAcceptance.contract_version && (
                          <div className="flex items-start gap-2">
                            <FileCode className="w-4 h-4 text-gold-medium mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-gray-400">Contract Version</p>
                              <p className="text-white font-mono text-sm">{termsAcceptance.contract_version}</p>
                            </div>
                          </div>
                        )}
                        {termsAcceptance.contract_hash && (
                          <div className="flex items-start gap-2">
                            <Hash className="w-4 h-4 text-gold-medium mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-gray-400">Contract Hash</p>
                              <p className="text-white font-mono text-xs break-all">{termsAcceptance.contract_hash.substring(0, 32)}...</p>
                            </div>
                          </div>
                        )}
                        {(termsAcceptance.geolocation_country || termsAcceptance.geolocation_city) && (
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-gold-medium mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-gray-400">Location</p>
                              <p className="text-white">
                                {[termsAcceptance.geolocation_city, termsAcceptance.geolocation_country].filter(Boolean).join(', ') || 'N/A'}
                              </p>
                            </div>
                          </div>
                        )}
                        {termsAcceptance.signature_name && (
                          <div className="flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 text-gold-medium mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-gray-400">Digital Signature</p>
                              <p className="text-white">{termsAcceptance.signature_name}</p>
                            </div>
                          </div>
                        )}
                        {termsAcceptance.ip_address && (
                          <div className="flex items-start gap-2">
                            <Globe className="w-4 h-4 text-gold-medium mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-gray-400">IP Address</p>
                              <p className="text-white font-mono text-xs">{termsAcceptance.ip_address}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timestamps */}
          <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardHeader>
              <CardTitle className="text-white">Timestamps</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
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

          {/* Meeting Information */}
          {application.meeting_date && (
            <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-white">Meeting Information</CardTitle>
                  {application.status === 'approved_for_meeting' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowMeetingModal(true)}
                      disabled={isProcessing}
                      className="flex items-center justify-center gap-2 border-yellow-500/50 bg-yellow-900/20 text-yellow-300 hover:bg-yellow-800/30 hover:text-yellow-200 text-xs sm:text-sm"
                    >
                      <Pencil className="w-4 h-4" />
                      Edit Meeting
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-gold-medium mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Meeting Date</p>
                      <p className="font-medium text-gray-200">
                        {(() => {
                          // Parse date in local timezone to avoid timezone conversion issues
                          const [year, month, day] = application.meeting_date.split('-').map(Number);
                          const date = new Date(year, month - 1, day);
                          return date.toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          });
                        })()}
                      </p>
                    </div>
                  </div>
                  {application.meeting_time && (
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-gold-medium mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Meeting Time</p>
                        <p className="font-medium text-gray-200">{application.meeting_time}</p>
                      </div>
                    </div>
                  )}
                  {application.meeting_link && (
                    <div className="flex items-start gap-3 md:col-span-2">
                      <LinkIcon className="w-5 h-5 text-gold-medium mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-gray-400 mb-1">Meeting Link</p>
                        <a
                          href={application.meeting_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-gold-medium hover:text-gold-light underline break-all"
                        >
                          {application.meeting_link}
                        </a>
                      </div>
                    </div>
                  )}
                  {application.meeting_scheduled_at && (
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Scheduled At</p>
                      <p className="font-medium text-gray-200">
                        {new Date(application.meeting_scheduled_at).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  )}
                  {application.meeting_scheduled_by && (
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Scheduled By</p>
                      <p className="font-medium text-gray-200">{application.meeting_scheduled_by}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Contract Verification Actions */}
          {termsAcceptance && termsAcceptance.verification_status === 'pending' && (
            <Card className="bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-blue-500/10 border border-blue-500/30">
              <CardHeader>
                <CardTitle className="text-white">Contract Verification</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <p className="text-sm text-gray-300 mb-2">
                    This partner has accepted the contract terms and submitted their documents. 
                    Please review the documents and verify the contract.
                  </p>
                  <div className="flex gap-2 text-xs text-gray-400">
                    {termsAcceptance.document_front_url && (
                      <span className="px-2 py-1 bg-green-900/30 text-green-300 rounded">Front Document ✓</span>
                    )}
                    {termsAcceptance.document_back_url && (
                      <span className="px-2 py-1 bg-green-900/30 text-green-300 rounded">Back Document ✓</span>
                    )}
                    {termsAcceptance.identity_photo_path && (
                      <span className="px-2 py-1 bg-green-900/30 text-green-300 rounded">Selfie ✓</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-4">
                  <Button
                    onClick={async () => {
                      if (!termsAcceptance) return;
                      setIsProcessing(true);
                      try {
                        const user = await getCurrentUser();
                        const reviewedBy = user?.email || user?.id || 'unknown';
                        const result = await approvePartnerContract(termsAcceptance.id, reviewedBy);
                        if (result.success) {
                          setAlertData({
                            title: 'Success',
                            message: 'Contract approved successfully! Partner is now Active.',
                            variant: 'success',
                          });
                          setShowAlert(true);
                          // Reload application and terms acceptance
                          const { data: appData } = await supabase
                            .from('global_partner_applications')
                            .select('*')
                            .eq('id', id)
                            .single();
                          if (appData) setApplication(appData as Application);
                          const { data: acceptanceData } = await supabase
                            .from('partner_terms_acceptances')
                            .select('*')
                            .eq('application_id', id)
                            .not('accepted_at', 'is', null)
                            .maybeSingle();
                          if (acceptanceData) setTermsAcceptance(acceptanceData);
                        } else {
                          setAlertData({
                            title: 'Error',
                            message: result.error || 'Failed to approve contract',
                            variant: 'error',
                          });
                          setShowAlert(true);
                        }
                      } catch (err) {
                        console.error('Error approving contract:', err);
                        setAlertData({
                          title: 'Error',
                          message: 'An error occurred while approving the contract',
                          variant: 'error',
                        });
                        setShowAlert(true);
                      } finally {
                        setIsProcessing(false);
                      }
                    }}
                    disabled={isProcessing}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm"
                  >
                    <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                    Approve Contract
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setRejectionReason('');
                      setShowRejectPrompt(true);
                    }}
                    disabled={isProcessing}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm"
                  >
                    <XCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                    Reject Contract
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          {(application.status === 'pending' || application.status === 'approved_for_meeting') && (
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
                    {application.status === 'pending' 
                      ? 'Approve & Schedule Meeting' 
                      : 'Approve After Meeting'}
                  </Button>
                  {application.status === 'pending' && (
                    <Button
                      variant="destructive"
                      onClick={handleReject}
                      disabled={isProcessing}
                      className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject Application
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {application.status === 'approved_for_contract' && (
            <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
              <CardHeader>
                <CardTitle className="text-white">Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button
                    onClick={handleResendEmail}
                    disabled={isProcessing}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Mail className="w-4 h-4" />
                    Resend Contract Email
                  </Button>
                  <p className="text-sm text-gray-400">
                    Resend the contract terms link email. The email will be sent with the production URL (not localhost).
                  </p>
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

      {/* Meeting Schedule Modal */}
      <MeetingScheduleModal
        isOpen={showMeetingModal}
        onClose={() => setShowMeetingModal(false)}
        onConfirm={(application?.status === 'approved_for_meeting' && application?.meeting_date)
          ? handleMeetingUpdate
          : handleMeetingSchedule}
        initialData={application?.status === 'approved_for_meeting' && application?.meeting_date
          ? {
              meetingDate: application.meeting_date,
              meetingTime: application.meeting_time || '',
              meetingLink: application.meeting_link || '',
              scheduledBy: application.meeting_scheduled_by || '',
            }
          : undefined}
        isEditMode={application?.status === 'approved_for_meeting' && !!application?.meeting_date}
        isLoading={isProcessing}
      />

      {/* Contract Template Selector Modal */}
      <ContractTemplateSelector
        isOpen={showTemplateSelector}
        onClose={() => setShowTemplateSelector(false)}
        onConfirm={handleTemplateSelected}
        isLoading={isProcessing}
      />

      {/* Approve Confirmation Modal */}
      <ConfirmModal
        isOpen={showApproveConfirm}
        onClose={() => setShowApproveConfirm(false)}
        onConfirm={confirmApprove}
        title={application?.status === 'approved_for_meeting' 
          ? 'Approve After Meeting' 
          : 'Approve Application'}
        message={application?.status === 'approved_for_meeting'
          ? `Are you sure you want to approve ${application?.full_name} after the meeting? This will send them an email with the contract terms link.`
          : `Are you sure you want to approve ${application?.full_name}? This will send them an email with terms link.`}
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
          setRejectionReason('');
        }}
        onConfirm={async (reason: string) => {
          if (termsAcceptance && termsAcceptance.verification_status === 'pending') {
            // Rejecting contract - show template selector to optionally resend with new template
            setShowRejectPrompt(false);
            setPendingRejection({
              acceptanceId: termsAcceptance.id,
              reason: reason || undefined,
            });
            setShowRejectTemplateSelector(true);
          } else {
            // Rejecting application
            handleRejectReasonSubmit(reason);
          }
        }}
        title={termsAcceptance && termsAcceptance.verification_status === 'pending' ? "Reject Contract" : "Reject Application"}
        message={
          termsAcceptance && termsAcceptance.verification_status === 'pending'
            ? `Enter rejection reason for contract verification (optional):`
            : `Enter rejection reason for ${application?.full_name} (optional):`
        }
        placeholder="Enter rejection reason (optional)..."
        confirmText="Continue"
        cancelText="Cancel"
        variant="default"
      />

      {/* Template Selector for Rejection (to resend contract with new template) */}
      <ContractTemplateSelector
        isOpen={showRejectTemplateSelector}
        onClose={async () => {
          // If user closes without selecting, just reject without resending
          if (pendingRejection) {
            setIsProcessing(true);
            try {
              const user = await getCurrentUser();
              const reviewedBy = user?.email || user?.id || 'unknown';
              const result = await rejectPartnerContract(
                pendingRejection.acceptanceId,
                reviewedBy,
                pendingRejection.reason,
                null // No template = just reject
              );
              if (result.success) {
                setAlertData({
                  title: 'Success',
                  message: 'Contract rejected successfully.',
                  variant: 'success',
                });
                setShowAlert(true);
                // Reload application and terms acceptance
                const { data: appData } = await supabase
                  .from('global_partner_applications')
                  .select('*')
                  .eq('id', id)
                  .single();
                if (appData) setApplication(appData as Application);
                const { data: acceptanceData } = await supabase
                  .from('partner_terms_acceptances')
                  .select('*')
                  .eq('application_id', id)
                  .not('accepted_at', 'is', null)
                  .maybeSingle();
                if (acceptanceData) setTermsAcceptance(acceptanceData);
              } else {
                setAlertData({
                  title: 'Error',
                  message: result.error || 'Failed to reject contract',
                  variant: 'error',
                });
                setShowAlert(true);
              }
            } catch (err) {
              console.error('Error rejecting contract:', err);
              setAlertData({
                title: 'Error',
                message: 'An error occurred while rejecting the contract',
                variant: 'error',
              });
              setShowAlert(true);
            } finally {
              setIsProcessing(false);
            }
          }
          setShowRejectTemplateSelector(false);
          setPendingRejection(null);
          setRejectionReason('');
        }}
        onConfirm={async (templateId: string | null) => {
          if (!pendingRejection) return;
          
          setShowRejectTemplateSelector(false);
          setIsProcessing(true);
          try {
            const user = await getCurrentUser();
            const reviewedBy = user?.email || user?.id || 'unknown';
            const result = await rejectPartnerContract(
              pendingRejection.acceptanceId,
              reviewedBy,
              pendingRejection.reason,
              templateId
            );
            if (result.success) {
              setAlertData({
                title: 'Success',
                message: templateId 
                  ? 'Contract rejected and new contract link sent successfully.' 
                  : 'Contract rejected successfully.',
                variant: 'success',
              });
              setShowAlert(true);
              // Reload application and terms acceptance
              const { data: appData } = await supabase
                .from('global_partner_applications')
                .select('*')
                .eq('id', id)
                .single();
              if (appData) setApplication(appData as Application);
              const { data: acceptanceData } = await supabase
                .from('partner_terms_acceptances')
                .select('*')
                .eq('application_id', id)
                .not('accepted_at', 'is', null)
                .maybeSingle();
              if (acceptanceData) setTermsAcceptance(acceptanceData);
            } else {
              setAlertData({
                title: 'Error',
                message: result.error || 'Failed to reject contract',
                variant: 'error',
              });
              setShowAlert(true);
            }
          } catch (err) {
            console.error('Error rejecting contract:', err);
            setAlertData({
              title: 'Error',
              message: 'An error occurred while rejecting the contract',
              variant: 'error',
            });
            setShowAlert(true);
          } finally {
            setIsProcessing(false);
            setPendingRejection(null);
            setRejectionReason('');
          }
        }}
        isLoading={isProcessing}
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

