import { useState, useEffect } from 'react';
import { FileText, Download, Eye, FileDown, User, MapPin, Hash, FileCode, Globe, Check, X, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchAcceptedContracts, fetchContractStats, getContractPdfUrl, getCvFileUrl, type AcceptedContract } from '@/lib/contracts';
import { Badge } from '@/components/ui/badge';
import { approvePartnerContract, rejectPartnerContract } from '@/lib/partner-contracts';
import { getCurrentUser } from '@/lib/auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ContractTemplateSelector } from '@/components/admin/ContractTemplateSelector';

// Chave para localStorage
const CONTRACTS_TAB_STORAGE_KEY = 'contracts_page_selected_tab';

export function ContractsPage() {
  // Cache de contratos por status para evitar recarregamentos
  const [contractsCache, setContractsCache] = useState<{
    all: AcceptedContract[];
    pending: AcceptedContract[];
    approved: AcceptedContract[];
    rejected: AcceptedContract[];
  }>({
    all: [],
    pending: [],
    approved: [],
    rejected: [],
  });

  const [contracts, setContracts] = useState<AcceptedContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedContract, setSelectedContract] = useState<AcceptedContract | null>(null);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showCvModal, setShowCvModal] = useState(false);

  // Restaurar statusFilter do localStorage na inicialização
  const getInitialStatusFilter = (): 'all' | 'pending' | 'approved' | 'rejected' => {
    try {
      const saved = localStorage.getItem(CONTRACTS_TAB_STORAGE_KEY);
      if (saved && ['all', 'pending', 'approved', 'rejected'].includes(saved)) {
        return saved as 'all' | 'pending' | 'approved' | 'rejected';
      }
    } catch (error) {
      console.warn('[ContractsPage] Error reading from localStorage:', error);
    }
    return 'all';
  };

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>(getInitialStatusFilter());
  const [stats, setStats] = useState<{ total: number; pending: number; approved: number; rejected: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showRejectPrompt, setShowRejectPrompt] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [showRejectTemplateSelector, setShowRejectTemplateSelector] = useState(false);
  const [pendingRejection, setPendingRejection] = useState<{ acceptanceId: string; reason?: string } | null>(null);
  const [pendingContract, setPendingContract] = useState<AcceptedContract | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [alertData, setAlertData] = useState<{ title: string; message: string; variant: 'success' | 'error' } | null>(null);
  const [showAlert, setShowAlert] = useState(false);

  // Carregar todos os contratos uma vez e organizar por status
  const loadAllContracts = async () => {
    try {
      setLoading(true);
      setError(null);

      // Carregar todos os contratos de uma vez
      const allContracts = await fetchAcceptedContracts('all');

      // Organizar por status
      const organized: typeof contractsCache = {
        all: allContracts,
        pending: allContracts.filter(c => c.verification_status === 'pending' || c.verification_status === null),
        approved: allContracts.filter(c => c.verification_status === 'approved'),
        rejected: allContracts.filter(c => c.verification_status === 'rejected'),
      };

      setContractsCache(organized);

      // Atualizar contratos exibidos baseado no filtro atual
      setContracts(organized[statusFilter] || []);

      console.log('[ContractsPage] All contracts loaded and cached');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contracts');
    } finally {
      setLoading(false);
    }
  };

  // Salvar statusFilter no localStorage quando mudar e atualizar exibição (sem recarregar)
  const handleStatusFilterChange = (value: 'all' | 'pending' | 'approved' | 'rejected') => {
    setStatusFilter(value);

    // Atualizar contratos exibidos do cache (sem recarregar do servidor)
    setContracts(contractsCache[value] || []);

    try {
      localStorage.setItem(CONTRACTS_TAB_STORAGE_KEY, value);
      console.log('[ContractsPage] Tab changed, using cached data:', value);
    } catch (error) {
      console.warn('[ContractsPage] Error saving to localStorage:', error);
    }
  };

  // Carregar dados iniciais apenas uma vez
  useEffect(() => {
    loadAllContracts();
    loadStats();
  }, []); // Executar apenas uma vez no mount

  const loadStats = async () => {
    const statistics = await fetchContractStats();
    setStats(statistics);
  };

  const handleViewContract = (contract: AcceptedContract) => {
    setSelectedContract(contract);
    setShowPdfModal(true);
  };

  const handleDownloadContract = async (contract: AcceptedContract) => {
    const pdfUrl = getContractPdfUrl(contract);
    if (!pdfUrl) {
      alert('Contract PDF not available');
      return;
    }

    try {
      const response = await fetch(pdfUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contract_${contract.application?.full_name || contract.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading contract:', err);
      alert('Failed to download contract');
    }
  };

  const handleViewCv = (contract: AcceptedContract) => {
    if (!contract.application?.cv_file_path) {
      alert('CV not available');
      return;
    }
    setSelectedContract(contract);
    setShowCvModal(true);
  };

  const handleDownloadCv = async (contract: AcceptedContract) => {
    if (!contract.application?.cv_file_path) {
      alert('CV not available');
      return;
    }

    const cvUrl = getCvFileUrl(contract.application.cv_file_path);
    if (!cvUrl) {
      alert('CV URL not available');
      return;
    }

    try {
      const response = await fetch(cvUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = contract.application.cv_file_name || 'cv.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading CV:', err);
      alert('Failed to download CV');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Helper component to render contract card
  const renderContractCard = (contract: AcceptedContract) => (
    <Card key={contract.id} className="hover:shadow-lg transition-shadow bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base sm:text-xl mb-2 text-white break-words">
              {contract.application?.full_name || 'Unknown Partner'}
            </CardTitle>
            <div className="flex flex-wrap gap-2 text-xs sm:text-sm text-gray-400">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate">{contract.application?.email}</span>
              </span>
              <span>•</span>
              <span>{contract.application?.country}</span>
              <span>•</span>
              <span>Accepted: {formatDate(contract.accepted_at)}</span>
            </div>
          </div>
          <div className="flex justify-start sm:justify-end">
            <VerificationStatusBadge status={contract.verification_status} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Legal Information Section */}
        {(contract.contract_version || contract.contract_hash || contract.geolocation_country || contract.signature_name) && (
          <div className="mb-4 p-3 bg-black/30 rounded-lg border border-gold-medium/20">
            <h4 className="text-sm font-semibold text-gold-light mb-3 flex items-center gap-2">
              <FileCode className="w-4 h-4" />
              Legal Records
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
              {contract.contract_version && (
                <div className="flex items-start gap-2">
                  <FileCode className="w-4 h-4 text-gold-medium mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-gray-400">Contract Version:</span>
                    <span className="text-white ml-2 font-mono">{contract.contract_version}</span>
                  </div>
                </div>
              )}
              {contract.contract_hash && (
                <div className="flex items-start gap-2">
                  <Hash className="w-4 h-4 text-gold-medium mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-gray-400">Contract Hash:</span>
                    <span className="text-white ml-2 font-mono text-xs break-all">{contract.contract_hash.substring(0, 32)}...</span>
                  </div>
                </div>
              )}
              {(contract.geolocation_country || contract.geolocation_city) && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-gold-medium mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-gray-400">Location:</span>
                    <span className="text-white ml-2">
                      {[contract.geolocation_city, contract.geolocation_country].filter(Boolean).join(', ') || 'N/A'}
                    </span>
                  </div>
                </div>
              )}
              {contract.signature_name && (
                <div className="flex items-start gap-2">
                  <User className="w-4 h-4 text-gold-medium mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-gray-400">Digital Signature:</span>
                    <span className="text-white ml-2">{contract.signature_name}</span>
                  </div>
                </div>
              )}
              {contract.ip_address && (
                <div className="flex items-start gap-2">
                  <Globe className="w-4 h-4 text-gold-medium mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-gray-400">IP Address:</span>
                    <span className="text-white ml-2 font-mono text-xs">{contract.ip_address}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Action buttons for pending contracts (including null status for old contracts) */}
          {(contract.verification_status === 'pending' || contract.verification_status === null) && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleApproveContract(contract)}
                disabled={isProcessing}
                className="flex items-center gap-2 border-green-500/50 bg-green-900/20 text-green-300 hover:bg-green-800/30 hover:text-green-200"
              >
                <Check className="w-4 h-4" />
                Approve
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRejectContract(contract)}
                disabled={isProcessing}
                className="flex items-center gap-2 border-red-500/50 bg-red-900/20 text-red-300 hover:bg-red-800/30 hover:text-red-200"
              >
                <X className="w-4 h-4" />
                Reject
              </Button>
            </>
          )}
          {contract.contract_pdf_url && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleViewContract(contract)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30 hover:text-gold-light text-xs sm:text-sm"
              >
                <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">View Contract</span>
                <span className="sm:hidden">View</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownloadContract(contract)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30 hover:text-gold-light text-xs sm:text-sm"
              >
                <Download className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Download Contract</span>
                <span className="sm:hidden">Download</span>
              </Button>
            </>
          )}
          {contract.application?.cv_file_path && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleViewCv(contract)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30 hover:text-gold-light text-xs sm:text-sm"
              >
                <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">View CV</span>
                <span className="sm:hidden">View CV</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownloadCv(contract)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30 hover:text-gold-light text-xs sm:text-sm"
              >
                <FileDown className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Download CV</span>
                <span className="sm:hidden">Download</span>
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );

  // Helper function to render empty state
  const renderEmptyState = (message: string) => (
    <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
      <CardContent className="pt-6">
        <div className="text-center py-12">
          <FileText className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">{message}</p>
        </div>
      </CardContent>
    </Card>
  );

  // Verification Status Badge Component
  const VerificationStatusBadge = ({ status }: { status: string | null }) => {
    const variants: Record<string, string> = {
      pending: 'bg-yellow-900/30 text-yellow-300 border-yellow-500/50',
      approved: 'bg-green-900/30 text-green-300 border-green-500/50',
      rejected: 'bg-red-900/30 text-red-300 border-red-500/50',
    };

    const displayText: Record<string, string> = {
      pending: 'Pending Verification',
      approved: 'Approved',
      rejected: 'Rejected',
    };

    // Tratar null como 'pending' (contratos antigos antes da implementação do sistema de verificação)
    const effectiveStatus = status || 'pending';

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variants[effectiveStatus] || variants.pending}`}
      >
        {displayText[effectiveStatus] || effectiveStatus}
      </span>
    );
  };

  // Handlers for approval/rejection
  const handleApproveContract = (contract: AcceptedContract) => {
    setPendingContract(contract);
    setShowApproveConfirm(true);
  };

  const confirmApproveContract = async () => {
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
        // Recarregar todos os contratos e atualizar cache
        await loadAllContracts();
        await loadStats();
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

  const handleRejectContract = (contract: AcceptedContract) => {
    setPendingContract(contract);
    setRejectionReason('');
    setShowRejectPrompt(true);
  };

  const handleRejectReasonSubmit = (reason: string) => {
    setShowRejectPrompt(false);
    // Show template selector to optionally resend with new template
    setPendingRejection({
      acceptanceId: pendingContract!.id,
      reason: reason || undefined,
    });
    setShowRejectTemplateSelector(true);
  };

  const confirmRejectContract = async (templateId: string | null = null) => {
    if (!pendingRejection) return;

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
        // Recarregar todos os contratos e atualizar cache
        await loadAllContracts();
        await loadStats();
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
      setShowRejectTemplateSelector(false);
      setPendingContract(null);
      setPendingRejection(null);
      setRejectionReason('');
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in duration-500">
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-96 hidden md:block" />

          <div className="flex flex-wrap gap-4 mt-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-5 w-24" />
            ))}
          </div>
        </div>

        {/* Warning Alert Skeleton */}
        <Skeleton className="h-24 w-full rounded-xl border-2 border-yellow-500/20 bg-yellow-500/5" />

        <div className="space-y-6">
          <div className="flex gap-2 bg-black/50 p-1 rounded-lg border border-white/5 w-full sm:w-fit">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-9 w-24 sm:w-32" />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6">
            {[1, 2, 3].map(i => (
              <Card key={i} className="bg-zinc-900/40 border-white/5 p-6 space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="space-y-3 flex-1">
                    <Skeleton className="h-7 w-64" />
                    <div className="flex gap-3">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-32 rounded-full" />
                </div>

                <div className="p-4 bg-black/20 rounded-lg border border-white/5 space-y-4">
                  <Skeleton className="h-4 w-32" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Skeleton className="h-9 w-28" />
                  <Skeleton className="h-9 w-28" />
                  <Skeleton className="h-9 w-32" />
                  <Skeleton className="h-9 w-32" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-red-300 mb-4">{error}</p>
              <Button onClick={loadAllContracts} variant="outline" className="border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30 hover:text-gold-light">Retry</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold migma-gold-text mb-2">Accepted Contracts</h1>
        <p className="text-sm sm:text-base text-gray-400">View and manage all accepted partner contracts</p>

        {/* Statistics */}
        {stats && (
          <div className="mt-3 sm:mt-4 flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm">
            <span className="text-gray-400">Total: <span className="text-white font-semibold">{stats.total}</span></span>
            <span className="text-gray-400">Pending: <span className="text-yellow-300 font-semibold">{stats.pending}</span></span>
            <span className="text-gray-400">Approved: <span className="text-green-300 font-semibold">{stats.approved}</span></span>
            <span className="text-gray-400">Rejected: <span className="text-red-300 font-semibold">{stats.rejected}</span></span>
          </div>
        )}

        {/* Pending Contracts Alert */}
        {stats && stats.pending > 0 && (
          <Card className="bg-gradient-to-br from-yellow-500/20 via-yellow-500/10 to-yellow-500/20 border-2 border-yellow-500/50 mt-3 sm:mt-4">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400 shrink-0" />
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-yellow-300">
                    {stats.pending} {stats.pending === 1 ? 'Contract' : 'Contracts'} Pending Verification
                  </h3>
                  <p className="text-xs sm:text-sm text-yellow-200/80">
                    There {stats.pending === 1 ? 'is' : 'are'} {stats.pending} contract{stats.pending === 1 ? '' : 's'} waiting for review
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabs for filtering */}
      <Tabs value={statusFilter} onValueChange={(value) => handleStatusFilterChange(value as 'all' | 'pending' | 'approved' | 'rejected')} className="mb-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 bg-black/50 border border-gold-medium/30 text-xs sm:text-sm">
          <TabsTrigger
            value="all"
            className="data-[state=active]:bg-gold-medium data-[state=active]:text-black data-[state=inactive]:text-gray-400 data-[state=inactive]:hover:text-gold-light border-r border-gold-medium/30"
          >
            All
          </TabsTrigger>
          <TabsTrigger
            value="pending"
            className="data-[state=active]:bg-gold-medium data-[state=active]:text-black data-[state=inactive]:text-gray-400 data-[state=inactive]:hover:text-gold-light border-r border-gold-medium/30"
          >
            Pending
            {stats && stats.pending > 0 && (
              <Badge className="ml-2 bg-yellow-600 text-white">{stats.pending}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="approved"
            className="data-[state=active]:bg-gold-medium data-[state=active]:text-black data-[state=inactive]:text-gray-400 data-[state=inactive]:hover:text-gold-light border-r border-gold-medium/30"
          >
            Approved
          </TabsTrigger>
          <TabsTrigger
            value="rejected"
            className="data-[state=active]:bg-gold-medium data-[state=active]:text-black data-[state=inactive]:text-gray-400 data-[state=inactive]:hover:text-gold-light"
          >
            Rejected
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          {contracts.length === 0 ? (
            renderEmptyState('No accepted contracts yet')
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {contracts.map(renderContractCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pending" className="mt-4">
          {contracts.length === 0 ? (
            renderEmptyState('No pending contracts')
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {contracts.map(renderContractCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="approved" className="mt-4">
          {contracts.length === 0 ? (
            renderEmptyState('No approved contracts')
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {contracts.map(renderContractCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="rejected" className="mt-4">
          {contracts.length === 0 ? (
            renderEmptyState('No rejected contracts')
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {contracts.map(renderContractCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Approve Confirmation Modal */}
      <Dialog open={showApproveConfirm} onOpenChange={setShowApproveConfirm}>
        <DialogContent className="bg-black border-gold-medium/30">
          <div className="relative">
            {isProcessing && (
              <div className="absolute inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg">
                <div className="text-center">
                  <div className="loader-gold mx-auto mb-4"></div>
                  <p className="text-gold-light text-lg font-semibold">Processing approval...</p>
                  <p className="text-gray-400 text-sm mt-2">Please wait</p>
                </div>
              </div>
            )}
            <DialogHeader>
              <DialogTitle className="text-white">Approve Contract</DialogTitle>
              <DialogDescription className="text-gray-300">
                Are you sure you want to approve this contract? An approval email will be sent to the partner.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowApproveConfirm(false)}
                disabled={isProcessing}
                className="border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30 flex items-center"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmApproveContract}
                disabled={isProcessing}
                className="bg-green-600 hover:bg-green-700 text-white flex items-center justify-center"
              >
                {isProcessing ? (
                  <>
                    <div className="loader-gold w-5 h-5 border-2 border-t-2 border-t-white border-green-400 rounded-full animate-spin mr-2"></div>
                    Processing...
                  </>
                ) : (
                  'Approve'
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Prompt Modal */}
      <Dialog open={showRejectPrompt} onOpenChange={setShowRejectPrompt}>
        <DialogContent className="bg-black border-gold-medium/30">
          <DialogHeader>
            <DialogTitle className="text-white">Reject Contract</DialogTitle>
            <DialogDescription className="text-gray-300">
              Please provide a reason for rejecting this contract. This reason will be included in the rejection email.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Enter rejection reason (optional)"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="bg-black/50 border-gold-medium/30 text-white placeholder:text-gray-500"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectPrompt(false);
                setRejectionReason('');
              }}
              disabled={isProcessing}
              className="border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30"
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleRejectReasonSubmit(rejectionReason)}
              disabled={isProcessing}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Selector for Rejection (to resend contract with new template) */}
      <ContractTemplateSelector
        isOpen={showRejectTemplateSelector}
        onClose={async () => {
          // If user closes without selecting, just reject without resending
          if (pendingRejection) {
            await confirmRejectContract(null);
          }
          setShowRejectTemplateSelector(false);
          setPendingRejection(null);
        }}
        onConfirm={async (templateId: string | null) => {
          await confirmRejectContract(templateId);
        }}
        isLoading={isProcessing}
      />

      {/* Reject Confirmation Modal */}
      <Dialog open={showRejectConfirm} onOpenChange={setShowRejectConfirm}>
        <DialogContent className="bg-black border-gold-medium/30 relative">
          {isProcessing && (
            <div className="absolute inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg">
              <div className="text-center">
                <div className="loader-gold mx-auto mb-4"></div>
                <p className="text-gold-light text-lg font-semibold">Processing rejection...</p>
                <p className="text-gray-400 text-sm mt-2">Please wait</p>
              </div>
            </div>
          )}
          <DialogHeader>
            <DialogTitle className="text-white">Confirm Rejection</DialogTitle>
            <DialogDescription className="text-gray-300">
              Are you sure you want to reject this contract? A rejection email will be sent to the partner.
            </DialogDescription>
            {rejectionReason && (
              <div className="mt-2 p-2 bg-black/50 rounded border border-gold-medium/30">
                <p className="text-sm text-gold-light font-semibold mb-1">Rejection Reason:</p>
                <p className="text-sm text-gray-300">{rejectionReason}</p>
              </div>
            )}
          </DialogHeader>
          <DialogFooter className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectConfirm(false);
                setRejectionReason('');
              }}
              disabled={isProcessing}
              className="border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30 flex items-center"
            >
              Cancel
            </Button>
            <Button
              onClick={() => confirmRejectContract(null)}
              disabled={isProcessing}
              className="bg-red-600 hover:bg-red-700 text-white flex items-center justify-center"
            >
              {isProcessing ? (
                <>
                  <div className="loader-gold w-5 h-5 border-2 border-t-2 border-t-white border-red-400 rounded-full animate-spin mr-2"></div>
                  Processing...
                </>
              ) : (
                'Confirm Rejection'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert Modal */}
      <Dialog open={showAlert} onOpenChange={setShowAlert}>
        <DialogContent className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border-gold-medium/30">
          <DialogHeader>
            <DialogTitle className={alertData?.variant === 'success' ? 'text-green-300' : 'text-red-300'}>
              {alertData?.title}
            </DialogTitle>
            <DialogDescription className="text-gray-300">
              {alertData?.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setShowAlert(false)}
              className={alertData?.variant === 'success' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF Modal */}
      {showPdfModal && selectedContract && selectedContract.contract_pdf_url && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gold-medium/30">
              <h3 className="text-lg font-semibold text-white">
                Contract - {selectedContract.application?.full_name}
              </h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadContract(selectedContract)}
                  className="border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30 hover:text-gold-light"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowPdfModal(false)} className="border-gold-medium/50 bg-black/50 text-white hover:bg-black/50 hover:text-white">
                  Close
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <iframe
                src={selectedContract.contract_pdf_url}
                className="w-full h-full min-h-[600px] border-0"
                title="Contract PDF"
              />
            </div>
          </div>
        </div>
      )}

      {/* CV Modal */}
      {showCvModal && selectedContract && selectedContract.application?.cv_file_path && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gold-medium/30">
              <h3 className="text-lg font-semibold text-white">
                CV - {selectedContract.application?.full_name}
              </h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadCv(selectedContract)}
                  className="border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30 hover:text-gold-light"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowCvModal(false)} className="border-gold-medium/50 bg-black/50 text-white hover:bg-black/50 hover:text-white">
                  Close
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <iframe
                src={getCvFileUrl(selectedContract.application.cv_file_path) || ''}
                className="w-full h-full min-h-[600px] border-0"
                title="CV PDF"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

