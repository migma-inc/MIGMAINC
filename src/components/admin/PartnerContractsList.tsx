/**
 * Component for displaying a list of Global Partner contracts pending verification
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, CheckCircle, XCircle, Clock, FileText, User, Mail, Phone } from 'lucide-react';

interface PartnerContract {
  id: string;
  application_id: string;
  accepted_at: string;
  verification_status: 'pending' | 'approved' | 'rejected';
  identity_photo_path: string | null;
  document_front_url: string | null;
  document_back_url: string | null;
  signature_name: string | null;
  full_legal_name: string | null;
  email: string | null;
  global_partner_applications: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    status: string;
  } | null;
}

interface PartnerContractsListProps {
  onApprove?: (contract: PartnerContract) => void;
  onReject?: (contract: PartnerContract) => void;
  refreshKey?: number;
}

function VerificationStatusBadge({ status }: { status: string }) {
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

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variants[status] || variants.pending}`}
    >
      {displayText[status] || status}
    </span>
  );
}

export function PartnerContractsList({
  onApprove,
  onReject,
  refreshKey,
}: PartnerContractsListProps) {
  const [contracts, setContracts] = useState<PartnerContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadContracts = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('partner_terms_acceptances')
        .select(`
          *,
          global_partner_applications (
            id,
            full_name,
            email,
            phone,
            status
          )
        `)
        .eq('verification_status', 'pending')
        .not('accepted_at', 'is', null)
        .order('accepted_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setContracts((data as PartnerContract[]) || []);
    } catch (err) {
      console.error('Error loading partner contracts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load contracts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContracts();
  }, []);

  // Refetch when refreshKey changes
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0) {
      loadContracts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-medium mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading contracts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-500/50 text-red-300 px-4 py-3 rounded-md">
        <p className="font-semibold">Error loading contracts</p>
        <p className="text-sm mt-1">{error}</p>
        <Button onClick={loadContracts} variant="outline" className="mt-2 border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30 hover:text-gold-light">
          Retry
        </Button>
      </div>
    );
  }

  if (contracts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-lg">No contracts pending verification</p>
        <p className="text-gray-500 text-sm mt-2">
          All contracts have been reviewed or no contracts have been submitted yet.
        </p>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-4">
      {contracts.map((contract) => {
        const application = contract.global_partner_applications;
        const hasDocuments = contract.document_front_url && contract.document_back_url && contract.identity_photo_path;

        return (
          <Card key={contract.id} className="bg-gradient-to-br from-gold-light/5 via-gold-medium/5 to-gold-dark/5 border-gold-medium/30">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base sm:text-lg text-white mb-2 break-words">
                    {application?.full_name || contract.full_legal_name || 'Unknown Partner'}
                  </CardTitle>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
                    <VerificationStatusBadge status={contract.verification_status} />
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Accepted: {formatDate(contract.accepted_at)}
                    </span>
                  </div>
                </div>
                <Link to={`/dashboard/applications/${contract.application_id}`} className="w-full sm:w-auto">
                  <Button variant="outline" size="sm" className="w-full sm:w-auto flex items-center justify-center gap-2 border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30 hover:text-gold-light text-xs sm:text-sm">
                    <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">View Details</span>
                    <span className="sm:hidden">View</span>
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Contact Information */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                  {application?.email && (
                    <div className="flex items-center gap-2 text-gray-300">
                      <Mail className="w-3 h-3 sm:w-4 sm:h-4 text-gold-medium shrink-0" />
                      <span className="truncate">{application.email}</span>
                    </div>
                  )}
                  {application?.phone && (
                    <div className="flex items-center gap-2 text-gray-300">
                      <Phone className="w-3 h-3 sm:w-4 sm:h-4 text-gold-medium shrink-0" />
                      <span>{application.phone}</span>
                    </div>
                  )}
                </div>

                {/* Documents Status */}
                <div className="border-t border-gold-medium/20 pt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-gold-medium" />
                    <span className="text-sm font-medium text-white">Documents</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className={`p-2 rounded ${contract.document_front_url ? 'bg-green-900/20 text-green-300' : 'bg-red-900/20 text-red-300'}`}>
                      Front: {contract.document_front_url ? '✓' : '✗'}
                    </div>
                    <div className={`p-2 rounded ${contract.document_back_url ? 'bg-green-900/20 text-green-300' : 'bg-red-900/20 text-red-300'}`}>
                      Back: {contract.document_back_url ? '✓' : '✗'}
                    </div>
                    <div className={`p-2 rounded ${contract.identity_photo_path ? 'bg-green-900/20 text-green-300' : 'bg-red-900/20 text-red-300'}`}>
                      Selfie: {contract.identity_photo_path ? '✓' : '✗'}
                    </div>
                  </div>
                  {contract.signature_name && (
                    <div className="mt-2 text-xs text-gray-400">
                      <User className="w-3 h-3 inline mr-1" />
                      Signature: {contract.signature_name}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                {hasDocuments && (
                  <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-gold-medium/20">
                    {onApprove && (
                      <Button
                        onClick={() => onApprove(contract)}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm"
                        size="sm"
                      >
                        <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                        Approve
                      </Button>
                    )}
                    {onReject && (
                      <Button
                        onClick={() => onReject(contract)}
                        variant="destructive"
                        className="flex-1 text-xs sm:text-sm"
                        size="sm"
                      >
                        <XCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                        Reject
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

