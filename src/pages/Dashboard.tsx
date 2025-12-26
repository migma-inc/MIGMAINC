/**
 * Admin Dashboard - Main page for managing Global Partner applications
 * Includes integrated login - shows login form if not authenticated, dashboard if authenticated
 */

import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { getCurrentUser, signOut, signIn, isAuthenticated as checkIsAuthenticated, checkAdminAccess } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut, Filter, FileText, AlertCircle, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ApplicationsList } from '@/components/admin/ApplicationsList';
import { PartnerContractsList } from '@/components/admin/PartnerContractsList';
import { Sidebar } from '@/components/admin/Sidebar';
import type { Application } from '@/types/application';
import { approveApplication, rejectApplication, getApplicationStats, approveApplicationForMeeting, approveApplicationAfterMeeting } from '@/lib/admin';
import { approvePartnerContract, rejectPartnerContract } from '@/lib/partner-contracts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { PromptModal } from '@/components/ui/prompt-modal';
import { AlertModal } from '@/components/ui/alert-modal';
import { MeetingScheduleModal } from '@/components/admin/MeetingScheduleModal';
import { ContractTemplateSelector } from '@/components/admin/ContractTemplateSelector';

function LoginForm({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await signIn(email, password);

      if (result.success) {
        onLoginSuccess();
      } else {
        setError(result.error || 'Failed to sign in');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-black via-[#1a1a1a] to-black px-4">
      <Card className="w-full max-w-md shadow-xl border border-gold-medium/30 bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center migma-gold-text">Admin Login</CardTitle>
          <CardDescription className="text-center text-gray-300">
            Enter your credentials to access the admin dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-900/30 border border-red-500/50 text-red-300 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-b from-gold-dark via-gold-medium to-gold-dark text-black font-bold hover:opacity-90 transition-opacity"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-400">
            <p>Only authorized administrators can access this area.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardLayout() {
  const [user, setUser] = useState<{ email: string; role: string } | null>(null);

  useEffect(() => {
    async function loadUser() {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
      }
    }
    loadUser();
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setUser(null);
    // Reload to show login form
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-[#1a1a1a] to-black flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-black/95 shadow-sm border-b border-gold-medium/30">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div>
                <h1 className="text-2xl font-bold migma-gold-text">MIGMA Admin Dashboard</h1>
                {user && (
                  <p className="text-sm text-gray-400">Logged in as {user.email}</p>
                )}
              </div>
              <Button
                variant="outline"
                onClick={handleSignOut}
                className="flex items-center gap-2 border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30 hover:text-gold-light"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function DashboardContent() {
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'approved_for_meeting' | 'approved_for_contract' | 'rejected' | undefined>(undefined);
  const [stats, setStats] = useState<{ total: number; pending: number; approved: number; approved_for_meeting: number; approved_for_contract: number; rejected: number } | null>(null);
  const [pendingContractApprovals, setPendingContractApprovals] = useState(0);
  const [pendingPartnerContracts, setPendingPartnerContracts] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [contractsRefreshKey, setContractsRefreshKey] = useState(0);
  
  // Modal states
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showRejectPrompt, setShowRejectPrompt] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertData, setAlertData] = useState<{ title: string; message: string; variant: 'success' | 'error' | 'warning' | 'info' } | null>(null);
  const [pendingApplication, setPendingApplication] = useState<Application | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showRejectTemplateSelector, setShowRejectTemplateSelector] = useState(false);
  const [pendingContract, setPendingContract] = useState<any>(null);
  const [pendingRejection, setPendingRejection] = useState<{ acceptanceId: string; reason?: string } | null>(null);

  useEffect(() => {
    loadStats();
    loadPendingContractApprovals();
    loadPendingPartnerContracts();
  }, []);

  const loadStats = async () => {
    const statistics = await getApplicationStats();
    setStats(statistics);
  };

  const loadPendingContractApprovals = async () => {
    try {
      const { data, error } = await supabase
        .from('visa_orders')
        .select('id')
        .eq('contract_approval_status', 'pending');

      if (!error && data) {
        setPendingContractApprovals(data.length);
      }
    } catch (err) {
      console.error('Error loading pending contract approvals:', err);
    }
  };

  const loadPendingPartnerContracts = async () => {
    try {
      const { data, error } = await supabase
        .from('partner_terms_acceptances')
        .select('id')
        .eq('verification_status', 'pending')
        .not('accepted_at', 'is', null);

      if (!error && data) {
        setPendingPartnerContracts(data.length);
      }
    } catch (err) {
      console.error('Error loading pending partner contracts:', err);
    }
  };

  const handleApprove = async (application: Application) => {
    setPendingApplication(application);
    
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
    if (!pendingApplication) return;
    
    setShowMeetingModal(false);
    setIsProcessing(true);
    try {
      const result = await approveApplicationForMeeting(
        pendingApplication.id,
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
        await loadStats();
        // Trigger list refresh
        setRefreshKey(prev => prev + 1);
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
      setPendingApplication(null);
    }
  };

  const handleEditMeeting = (application: Application) => {
    setPendingApplication(application);
    setShowMeetingModal(true);
  };

  const handleMeetingUpdate = async (data: {
    meetingDate: string;
    meetingTime: string;
    meetingLink: string;
    scheduledBy?: string;
  }) => {
    if (!pendingApplication) return;
    
    setShowMeetingModal(false);
    setIsProcessing(true);
    try {
      const { updateMeetingInfo } = await import('@/lib/admin');
      const result = await updateMeetingInfo(
        pendingApplication.id,
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
        await loadStats();
        // Trigger list refresh
        setRefreshKey(prev => prev + 1);
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
      setPendingApplication(null);
    }
  };

  const handleTemplateSelected = async (templateId: string | null) => {
    if (!pendingApplication) return;
    
    setShowTemplateSelector(false);
    setIsProcessing(true);
    try {
      const result = await approveApplicationAfterMeeting(pendingApplication.id, templateId);
      
      if (result.success) {
        setAlertData({
          title: 'Success',
          message: result.error || 'Application approved successfully! Email sent.',
          variant: 'success',
        });
        setShowAlert(true);
        await loadStats();
        setRefreshKey(prev => prev + 1);
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
      setPendingApplication(null);
    }
  };

  const confirmApprove = async () => {
    if (!pendingApplication) return;
    
    setShowApproveConfirm(false);
    setIsProcessing(true);
    try {
        // For backward compatibility with old 'approved' status
      const result = await approveApplication(pendingApplication.id);
      
      if (result.success) {
        setAlertData({
          title: 'Success',
          message: result.error || 'Application approved successfully! Email sent.',
          variant: 'success',
        });
        setShowAlert(true);
        await loadStats();
        // Trigger list refresh
        setRefreshKey(prev => prev + 1);
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
      setPendingApplication(null);
    }
  };

  const handleReject = async (application: Application) => {
    setPendingApplication(application);
    setRejectionReason('');
    setShowRejectPrompt(true);
  };

  const handleResendEmail = async (application: Application) => {
    setIsProcessing(true);
    try {
      const { resendContractTermsEmail } = await import('@/lib/partner-terms');
      const result = await resendContractTermsEmail(application.id);

      if (result.success) {
        setAlertData({
          title: 'Success',
          message: result.error || 'Contract terms email resent successfully!',
          variant: 'success',
        });
        setShowAlert(true);
      } else {
        setAlertData({
          title: 'Error',
          message: result.error || 'Failed to resend contract terms email',
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

  const handleRejectReasonSubmit = (reason: string) => {
    setShowRejectPrompt(false);
    setRejectionReason(reason);
    setShowRejectConfirm(true);
  };

  const confirmReject = async () => {
    if (!pendingApplication) return;
    
    setShowRejectConfirm(false);
    setIsProcessing(true);
    try {
      const result = await rejectApplication(pendingApplication.id, rejectionReason || undefined);
      if (result.success) {
        setAlertData({
          title: 'Success',
          message: 'Application rejected successfully.',
          variant: 'success',
        });
        setShowAlert(true);
        await loadStats();
        // Trigger list refresh
        setRefreshKey(prev => prev + 1);
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
      setPendingApplication(null);
      setRejectionReason('');
    }
  };

  const handleApprovePartnerContract = async (contract: any) => {
    setPendingContract(contract);
    setShowApproveConfirm(true);
  };

  const handleRejectPartnerContract = async (contract: any) => {
    setPendingContract(contract);
    setShowRejectPrompt(true);
  };

  const confirmApprovePartnerContract = async () => {
    if (!pendingContract) return;

    setIsProcessing(true);
    try {
      const user = await getCurrentUser();
      const reviewedBy = user?.email || user?.id || 'unknown';

      const result = await approvePartnerContract(pendingContract.id, reviewedBy);
      
      if (result.success) {
        setAlertData({
          title: 'Success',
          message: 'Partner contract approved successfully!',
          variant: 'success',
        });
        setShowAlert(true);
        setRefreshKey(prev => prev + 1);
        setContractsRefreshKey(prev => prev + 1);
        loadStats();
        loadPendingPartnerContracts();
      } else {
        setAlertData({
          title: 'Error',
          message: 'Failed to approve contract: ' + (result.error || 'Unknown error'),
          variant: 'error',
        });
        setShowAlert(true);
      }
    } catch (err) {
      console.error('Error approving partner contract:', err);
      setAlertData({
        title: 'Error',
        message: 'An error occurred while approving the contract',
        variant: 'error',
      });
      setShowAlert(true);
    } finally {
      setIsProcessing(false);
      setShowApproveConfirm(false);
      setPendingContract(null);
    }
  };

  const confirmRejectPartnerContract = async () => {
    if (!pendingContract) return;

    setIsProcessing(true);
    try {
      const user = await getCurrentUser();
      const reviewedBy = user?.email || user?.id || 'unknown';

      const result = await rejectPartnerContract(
        pendingContract.id,
        reviewedBy,
        rejectionReason || undefined
      );
      
      if (result.success) {
        setAlertData({
          title: 'Success',
          message: 'Partner contract rejected successfully.',
          variant: 'success',
        });
        setShowAlert(true);
        setRefreshKey(prev => prev + 1);
        setContractsRefreshKey(prev => prev + 1);
        loadStats();
        loadPendingPartnerContracts();
      } else {
        setAlertData({
          title: 'Error',
          message: 'Failed to reject contract: ' + (result.error || 'Unknown error'),
          variant: 'error',
        });
        setShowAlert(true);
      }
    } catch (err) {
      console.error('Error rejecting partner contract:', err);
      setAlertData({
        title: 'Error',
        message: 'An error occurred while rejecting the contract',
        variant: 'error',
      });
      setShowAlert(true);
    } finally {
      setIsProcessing(false);
      setShowRejectConfirm(false);
      setPendingContract(null);
      setRejectionReason('');
    }
  };

  return (
    <div className="p-6">
      {/* Pending Contract Approvals Alert */}
      {pendingContractApprovals > 0 && (
        <Card className="bg-gradient-to-br from-yellow-500/20 via-yellow-500/10 to-yellow-500/20 border-2 border-yellow-500/50 mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-500/20 rounded-lg">
                  <AlertCircle className="w-8 h-8 text-yellow-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-yellow-300 mb-1">
                    {pendingContractApprovals} {pendingContractApprovals === 1 ? 'Contract' : 'Contracts'} Pending Approval
                  </h3>
                  <p className="text-sm text-yellow-200/80">
                    There {pendingContractApprovals === 1 ? 'is' : 'are'} {pendingContractApprovals} visa service {pendingContractApprovals === 1 ? 'contract' : 'contracts'} waiting for review
                  </p>
                </div>
              </div>
              <Link to="/dashboard/visa-orders">
                <Button className="bg-yellow-600 hover:bg-yellow-700 text-white">
                  <FileText className="w-4 h-4 mr-2" />
                  Review Contracts
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Partner Contracts Alert */}
      {pendingPartnerContracts > 0 && (
        <Card className="bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-blue-500/20 border-2 border-blue-500/50 mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/20 rounded-lg">
                  <AlertCircle className="w-8 h-8 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-blue-300 mb-1">
                    {pendingPartnerContracts} {pendingPartnerContracts === 1 ? 'Partner Contract' : 'Partner Contracts'} Pending Verification
                  </h3>
                  <p className="text-sm text-blue-200/80">
                    There {pendingPartnerContracts === 1 ? 'is' : 'are'} {pendingPartnerContracts} Global Partner {pendingPartnerContracts === 1 ? 'contract' : 'contracts'} waiting for document verification
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 rounded-lg shadow p-4 border border-gold-medium/30">
            <p className="text-sm text-gray-300">Total</p>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="bg-gradient-to-br from-gold-light/20 via-gold-medium/10 to-gold-dark/20 rounded-lg shadow p-4 border border-gold-medium/50">
            <p className="text-sm text-gray-300">Pending</p>
            <p className="text-2xl font-bold text-white">{stats.pending}</p>
          </div>
          <div className="bg-gradient-to-br from-green-900/30 via-green-800/20 to-green-900/30 rounded-lg shadow p-4 border border-green-500/50">
            <p className="text-sm text-green-400">Approved</p>
            <p className="text-2xl font-bold text-green-300">{stats.approved}</p>
          </div>
          <div className="bg-gradient-to-br from-red-900/30 via-red-800/20 to-red-900/30 rounded-lg shadow p-4 border border-red-500/50">
            <p className="text-sm text-red-400">Rejected</p>
            <p className="text-2xl font-bold text-red-300">{stats.rejected}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 rounded-lg shadow p-4 mb-6 border border-gold-medium/30">
        <div className="flex items-center gap-4">
          <Filter className="w-5 h-5 text-gold-light" />
          <label className="text-sm font-medium text-white">Filter by Status:</label>
          <Select
            value={statusFilter || 'all'}
            onValueChange={(value) => setStatusFilter(value === 'all' ? undefined : value as 'pending' | 'approved' | 'approved_for_meeting' | 'approved_for_contract' | 'rejected')}
          >
            <SelectTrigger className="w-40 bg-black/50 border-gold-medium/50 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-black border-gold-medium/50">
              <SelectItem value="all" className="text-white focus:bg-gold-medium/20 focus:text-gold-light">All</SelectItem>
              <SelectItem value="pending" className="text-white focus:bg-gold-medium/20 focus:text-gold-light">Pending</SelectItem>
              <SelectItem value="approved_for_meeting" className="text-white focus:bg-gold-medium/20 focus:text-gold-light">Approved for Meeting</SelectItem>
              <SelectItem value="approved_for_contract" className="text-white focus:bg-gold-medium/20 focus:text-gold-light">Approved for Contract</SelectItem>
              <SelectItem value="approved" className="text-white focus:bg-gold-medium/20 focus:text-gold-light">Approved (Legacy)</SelectItem>
              <SelectItem value="rejected" className="text-white focus:bg-gold-medium/20 focus:text-gold-light">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Pending Partner Contracts List */}
      {pendingPartnerContracts > 0 && (
        <div className="bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-blue-500/10 rounded-lg shadow p-6 border border-blue-500/30 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-blue-300">Partner Contracts Pending Verification</h2>
          <PartnerContractsList
            onApprove={handleApprovePartnerContract}
            onReject={handleRejectPartnerContract}
            refreshKey={contractsRefreshKey}
          />
        </div>
      )}

      {/* Applications List */}
      <div className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 rounded-lg shadow p-6 border border-gold-medium/30">
        <h2 className="text-xl font-semibold mb-4 migma-gold-text">Global Partner Applications</h2>
        <ApplicationsList
          onApprove={handleApprove}
          onReject={handleReject}
          onEditMeeting={handleEditMeeting}
          onResendEmail={handleResendEmail}
          statusFilter={statusFilter}
          refreshKey={refreshKey}
        />
      </div>

      {/* Processing Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 rounded-lg p-6 border border-gold-medium/30">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-medium mx-auto"></div>
            <p className="mt-4 text-gold-light">Processing...</p>
          </div>
        </div>
      )}

      {/* Meeting Schedule Modal */}
      <MeetingScheduleModal
        isOpen={showMeetingModal}
        onClose={() => {
          setShowMeetingModal(false);
          setPendingApplication(null);
        }}
        onConfirm={(pendingApplication?.status === 'approved_for_meeting' && pendingApplication?.meeting_date) 
          ? handleMeetingUpdate 
          : handleMeetingSchedule}
        initialData={pendingApplication?.status === 'approved_for_meeting' && pendingApplication?.meeting_date
          ? {
              meetingDate: pendingApplication.meeting_date,
              meetingTime: pendingApplication.meeting_time || '',
              meetingLink: pendingApplication.meeting_link || '',
              scheduledBy: pendingApplication.meeting_scheduled_by || '',
            }
          : undefined}
        isEditMode={pendingApplication?.status === 'approved_for_meeting' && !!pendingApplication?.meeting_date}
        isLoading={isProcessing}
      />

      {/* Contract Template Selector Modal */}
      <ContractTemplateSelector
        isOpen={showTemplateSelector}
        onClose={() => {
          setShowTemplateSelector(false);
          setPendingApplication(null);
        }}
        onConfirm={handleTemplateSelected}
        isLoading={isProcessing}
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
                setRefreshKey(prev => prev + 1);
                setContractsRefreshKey(prev => prev + 1);
                loadStats();
                loadPendingPartnerContracts();
              } else {
                setAlertData({
                  title: 'Error',
                  message: 'Failed to reject contract: ' + (result.error || 'Unknown error'),
                  variant: 'error',
                });
                setShowAlert(true);
              }
            } catch (err) {
              console.error('Error rejecting partner contract:', err);
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
          setPendingContract(null);
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
              setRefreshKey(prev => prev + 1);
              setContractsRefreshKey(prev => prev + 1);
              loadStats();
              loadPendingPartnerContracts();
            } else {
              setAlertData({
                title: 'Error',
                message: 'Failed to reject contract: ' + (result.error || 'Unknown error'),
                variant: 'error',
              });
              setShowAlert(true);
            }
          } catch (err) {
            console.error('Error rejecting partner contract:', err);
            setAlertData({
              title: 'Error',
              message: 'An error occurred while rejecting the contract',
              variant: 'error',
            });
            setShowAlert(true);
          } finally {
            setIsProcessing(false);
            setPendingRejection(null);
            setPendingContract(null);
            setRejectionReason('');
          }
        }}
        isLoading={isProcessing}
      />

      {/* Approve Confirmation Modal */}
      <ConfirmModal
        isOpen={showApproveConfirm}
        onClose={() => {
          setShowApproveConfirm(false);
          setPendingApplication(null);
          setPendingContract(null);
        }}
        onConfirm={() => {
          if (pendingContract) {
            confirmApprovePartnerContract();
          } else if (pendingApplication) {
            confirmApprove();
          }
        }}
        title={
          pendingContract
            ? 'Approve Partner Contract'
            : pendingApplication?.status === 'approved_for_meeting' 
            ? 'Approve After Meeting' 
            : 'Approve Application'
        }
        message={
          pendingContract
            ? `Are you sure you want to approve the contract for ${pendingContract.global_partner_applications?.full_name || 'this partner'}? This will activate them as an Active Partner.`
            : pendingApplication?.status === 'approved_for_meeting'
            ? `Are you sure you want to approve ${pendingApplication?.full_name} after the meeting? This will send them an email with the contract terms link.`
            : `Are you sure you want to approve ${pendingApplication?.full_name}? This will send them an email with terms link.`
        }
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
          setPendingApplication(null);
          setPendingContract(null);
          setRejectionReason('');
        }}
        onConfirm={(reason: string) => {
          if (pendingContract) {
            // Rejecting contract - show template selector to optionally resend with new template
            setShowRejectPrompt(false);
            setPendingRejection({
              acceptanceId: pendingContract.id,
              reason: reason || undefined,
            });
            setShowRejectTemplateSelector(true);
          } else {
            handleRejectReasonSubmit(reason);
          }
        }}
        title={pendingContract ? "Reject Contract" : "Reject Application"}
        message={
          pendingContract
            ? `Enter rejection reason for contract verification (optional):`
            : `Enter rejection reason for ${pendingApplication?.full_name} (optional):`
        }
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
          setPendingApplication(null);
          setPendingContract(null);
          setRejectionReason('');
        }}
        onConfirm={() => {
          if (pendingContract) {
            confirmRejectPartnerContract();
          } else if (pendingApplication) {
            confirmReject();
          }
        }}
        title={pendingContract ? "Confirm Contract Rejection" : "Confirm Rejection"}
        message={
          pendingContract
            ? `Are you sure you want to reject the contract for ${pendingContract.global_partner_applications?.full_name || 'this partner'}? This will mark the application as Verification Failed.`
            : `Are you sure you want to reject ${pendingApplication?.full_name}?`
        }
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
            // Ensure processing state is reset when alert closes
            if (isProcessing) {
              setIsProcessing(false);
            }
          }}
          title={alertData.title}
          message={alertData.message}
          variant={alertData.variant}
        />
      )}
    </div>
  );
}

export function Dashboard() {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const authenticated = await checkIsAuthenticated();
        setIsAuthenticated(authenticated);
        
        if (authenticated) {
          const hasAdminAccess = await checkAdminAccess();
          setIsAdmin(hasAdminAccess);
        }
      } catch (error) {
        console.error('[Dashboard] Error checking auth:', error);
        setIsAuthenticated(false);
        setIsAdmin(false);
      } finally {
        setIsChecking(false);
      }
    }

    checkAuth();
  }, []);

  const handleLoginSuccess = async () => {
    const authenticated = await checkIsAuthenticated();
    setIsAuthenticated(authenticated);
    
    if (authenticated) {
      const hasAdminAccess = await checkAdminAccess();
      setIsAdmin(hasAdminAccess);
    }
  };

  // Show loading state while checking
  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-black via-[#1a1a1a] to-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-medium mx-auto"></div>
          <p className="mt-4 text-gold-light">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login form if not authenticated or not admin
  if (!isAuthenticated || !isAdmin) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  // Show dashboard layout if authenticated and admin
  return <DashboardLayout />;
}
