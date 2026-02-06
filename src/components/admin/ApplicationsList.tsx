/**
 * Component for displaying a list of Global Partner applications
 */

import { useApplications } from '@/hooks/useApplications';
import type { Application } from '@/types/application';
import {
  Eye, CheckCircle, XCircle, Calendar, Clock, Link as LinkIcon,
  Pencil, Mail, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getSecureUrl } from '@/lib/storage';
import { Download, Loader2, X } from 'lucide-react';

interface ApplicationsListProps {
  onApprove?: (application: Application) => void;
  onReject?: (application: Application) => void;
  onEditMeeting?: (application: Application) => void;
  onResendEmail?: (application: Application) => void;
  statusFilter?: 'pending' | 'approved' | 'approved_for_meeting' | 'approved_for_contract' | 'active_partner' | 'rejected';
  currentPage?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  refreshKey?: number;
  search?: string;
}

function StatusBadge({ status }: { status: Application['status'] }) {
  const variants: Record<string, string> = {
    pending: 'bg-gold-medium/30 text-white border-gold-medium/50',
    approved: 'bg-green-900/30 text-green-300 border-green-500/50',
    approved_for_meeting: 'bg-yellow-900/30 text-yellow-300 border-yellow-500/50',
    approved_for_contract: 'bg-green-900/30 text-green-300 border-green-500/50',
    active_partner: 'bg-green-900/30 text-green-300 border-green-500/50',
    rejected: 'bg-red-900/30 text-red-300 border-red-500/50',
  };

  const displayText: Record<string, string> = {
    pending: 'New',
    approved: 'Approved (Legacy)',
    approved_for_meeting: 'For Meeting',
    approved_for_contract: 'Awaiting Signature',
    active_partner: 'Active Partner',
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

export function ApplicationsList({
  onApprove,
  onReject,
  onEditMeeting,
  onResendEmail,
  statusFilter,
  currentPage = 1,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  refreshKey,
  search,
}: ApplicationsListProps) {
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [cvUrl, setCvUrl] = useState<string | null>(null);
  const [loadingCV, setLoadingCV] = useState<string | null>(null); // To track which CV is loading
  const [viewingApplication, setViewingApplication] = useState<Application | null>(null);

  const handleViewCV = async (application: Application) => {
    if (!application.cv_file_path) return;

    setLoadingCV(application.id);
    try {
      const secureUrl = await getSecureUrl(application.cv_file_path);
      if (secureUrl) {
        setCvUrl(secureUrl);
        setViewingApplication(application);
        setShowPdfModal(true);
      }
    } catch (error) {
      console.error('Error loading CV:', error);
    } finally {
      setLoadingCV(null);
    }
  };

  const { applications, totalCount, totalPages, loading, error, refetch } = useApplications({
    status: statusFilter,
    limit: pageSize,
    page: currentPage,
    orderBy: 'created_at',
    orderDirection: 'desc',
    search: search,
  });

  // Scroll to top when page changes
  useEffect(() => {
    if (currentPage > 1 || (currentPage === 1 && !loading)) {
      const element = document.getElementById('applications-list-container');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [currentPage]);



  // Refetch when refreshKey changes
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0) {
      refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="space-y-4 animate-in fade-in duration-500">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="bg-zinc-900/40 border-white/5 p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div className="space-y-3 flex-1">
                <Skeleton className="h-6 w-64" />
                <Skeleton className="h-4 w-48" />
              </div>
              <Skeleton className="h-6 w-32 rounded-full" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-9 w-32" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-500/50 text-red-300 px-4 py-3 rounded-md">
        <p className="font-semibold">Error loading applications</p>
        <p className="text-sm mt-1">{error}</p>
        <Button onClick={refetch} variant="outline" className="mt-2 border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30 hover:text-gold-light">
          Retry
        </Button>
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-lg">No applications found</p>
        {statusFilter && (
          <p className="text-gray-500 text-sm mt-2">
            No applications with status: {statusFilter}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4" id="applications-list-container">
      {applications.map((application) => (
        <Card key={application.id} className="hover:shadow-md transition-shadow bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-base sm:text-lg text-white break-words">{application.full_name}</CardTitle>
                <p className="text-xs sm:text-sm text-gray-400 mt-1 break-words">{application.email}</p>
              </div>
              <div className="flex justify-start sm:justify-end">
                <StatusBadge status={application.status} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-4">
              <div>
                <p className="text-xs text-gray-400">Country</p>
                <p className="font-medium text-gray-300">{application.country}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Phone</p>
                <p className="font-medium text-gray-300">{application.phone}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Submitted</p>
                <p className="font-medium text-gray-300">
                  {new Date(application.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>

            {/* Meeting Information */}
            {application.meeting_date && (
              <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-yellow-400" />
                    <div>
                      <p className="text-xs text-gray-400">Meeting Date</p>
                      <p className="font-medium text-yellow-300">
                        {(() => {
                          // Parse date in local timezone to avoid timezone conversion issues
                          const [year, month, day] = application.meeting_date.split('-').map(Number);
                          const date = new Date(year, month - 1, day);
                          return date.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          });
                        })()}
                      </p>
                    </div>
                  </div>
                  {application.meeting_time && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-yellow-400" />
                      <div>
                        <p className="text-xs text-gray-400">Meeting Time</p>
                        <p className="font-medium text-yellow-300">{application.meeting_time}</p>
                      </div>
                    </div>
                  )}
                  {application.meeting_link && (
                    <div className="flex items-center gap-2 md:col-span-2">
                      <LinkIcon className="w-4 h-4 text-yellow-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400">Meeting Link</p>
                        <a
                          href={application.meeting_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-yellow-300 hover:text-yellow-200 underline truncate block"
                          title={application.meeting_link}
                        >
                          {application.meeting_link}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Link to={`/dashboard/applications/${application.id}`} className="flex-1 sm:flex-none">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto flex items-center justify-center gap-2 border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30 hover:text-gold-light text-xs sm:text-sm"
                >
                  <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">View Details</span>
                  <span className="sm:hidden">View</span>
                </Button>
              </Link>

              {application.cv_file_path && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewCV(application)}
                  disabled={loadingCV === application.id}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 border-gold-medium/50 bg-black/50 text-gold-light hover:bg-gold-medium/30 hover:text-gold-light text-xs sm:text-sm"
                >
                  {loadingCV === application.id ? (
                    <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                  ) : (
                    <Download className="w-3 h-3 sm:w-4 sm:h-4" />
                  )}
                  <span>CV</span>
                </Button>
              )}
              {application.status === 'pending' && (
                <>
                  {onApprove && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => onApprove(application)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm"
                    >
                      <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                      Approve
                    </Button>
                  )}
                  {onReject && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onReject(application)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm"
                    >
                      <XCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                      Reject
                    </Button>
                  )}
                </>
              )}
              {application.status === 'approved_for_meeting' && (
                <>
                  {onEditMeeting && application.meeting_date && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEditMeeting(application)}
                      className="flex items-center gap-2 border-yellow-500/50 bg-yellow-900/20 text-yellow-300 hover:bg-yellow-800/30 hover:text-yellow-200"
                    >
                      <Pencil className="w-4 h-4" />
                      Edit Meeting
                    </Button>
                  )}
                  {onApprove && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => onApprove(application)}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve After Meeting
                    </Button>
                  )}
                  {onReject && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onReject(application)}
                      className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject After Meeting
                    </Button>
                  )}
                </>
              )}
              {application.status === 'approved_for_contract' && onResendEmail && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onResendEmail(application)}
                  className="flex items-center gap-2 border-blue-500/50 bg-blue-900/20 text-blue-300 hover:bg-blue-800/30 hover:text-blue-200"
                >
                  <Mail className="w-4 h-4" />
                  Resend Contract Email
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 p-4 bg-zinc-900/40 border border-white/5 rounded-lg">
        <div className="flex items-center gap-4">
          <p className="text-sm text-gray-400">
            Total: <span className="text-white font-medium">{totalCount}</span> applications
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Show:</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => onPageSizeChange?.(Number(value))}
            >
              <SelectTrigger className="w-[70px] h-8 bg-zinc-900/60 border-gold-medium/40 text-white text-xs hover:border-gold-medium/70 transition-colors">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-950 border-gold-medium/30 shadow-2xl shadow-black/80">
                <SelectItem value="10" className="text-white focus:bg-gold-medium/20 focus:text-gold-light cursor-pointer">10</SelectItem>
                <SelectItem value="20" className="text-white focus:bg-gold-medium/20 focus:text-gold-light cursor-pointer">20</SelectItem>
                <SelectItem value="50" className="text-white focus:bg-gold-medium/20 focus:text-gold-light cursor-pointer">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 border-gold-medium/30 bg-black text-white hover:bg-gold-medium/30 disabled:opacity-30"
            onClick={() => onPageChange?.(1)}
            disabled={currentPage === 1}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 border-gold-medium/30 bg-black text-white hover:bg-gold-medium/30 disabled:opacity-30"
            onClick={() => onPageChange?.(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center px-3 h-8 rounded-md bg-gold-medium/20 border border-gold-medium/30 text-white text-sm font-medium">
            Page {currentPage} of {totalPages || 1}
          </div>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 border-gold-medium/30 bg-black text-white hover:bg-gold-medium/30 disabled:opacity-30"
            onClick={() => onPageChange?.(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 border-gold-medium/30 bg-black text-white hover:bg-gold-medium/30 disabled:opacity-30"
            onClick={() => onPageChange?.(totalPages)}
            disabled={currentPage === totalPages || totalPages === 0}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {/* CV Modal - Replicating exactly what working in Detail view */}
      {showPdfModal && cvUrl && viewingApplication && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          onClick={() => setShowPdfModal(false)}
        >
          <div
            className="bg-[#0f0f0f] border border-gold-medium/30 rounded-lg shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b border-gold-medium/20 bg-black/40">
              <div className="flex flex-col">
                <h3 className="text-lg font-semibold text-white">CV - {viewingApplication.full_name}</h3>
                <p className="text-xs text-gray-400">{viewingApplication.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 border-gold-medium/50 bg-gold-medium/10 text-gold-light hover:bg-gold-medium/20"
                  onClick={async () => {
                    if (!cvUrl) return;
                    try {
                      const response = await fetch(cvUrl);
                      const blob = await response.blob();
                      const blobUrl = window.URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = blobUrl;
                      link.download = `CV-${viewingApplication.full_name.replace(/\s+/g, '-')}.pdf`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      window.URL.revokeObjectURL(blobUrl);
                    } catch (err) {
                      console.error('Download error:', err);
                      window.open(cvUrl, '_blank');
                    }
                  }}
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPdfModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* PDF Viewer */}
            <div className="flex-1 bg-zinc-900 overflow-hidden">
              <iframe
                src={cvUrl}
                className="w-full h-full border-0"
                title="CV Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

