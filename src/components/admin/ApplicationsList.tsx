/**
 * Component for displaying a list of Global Partner applications
 */

import { useApplications } from '@/hooks/useApplications';
import type { Application } from '@/types/application';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
// Badge component is defined inline in StatusBadge
import { Eye, CheckCircle, XCircle, Calendar, Clock, Link as LinkIcon, Pencil, Mail } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';

interface ApplicationsListProps {
  onApprove?: (application: Application) => void;
  onReject?: (application: Application) => void;
  onEditMeeting?: (application: Application) => void;
  onResendEmail?: (application: Application) => void;
  statusFilter?: 'pending' | 'approved' | 'approved_for_meeting' | 'approved_for_contract' | 'rejected';
  refreshKey?: number;
}

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
  refreshKey,
}: ApplicationsListProps) {
  const { applications, loading, error, refetch } = useApplications({
    status: statusFilter,
    orderBy: 'created_at',
    orderDirection: 'desc',
  });

  // Refetch when refreshKey changes
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0) {
      refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-medium mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading applications...</p>
        </div>
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
    <div className="space-y-4">
      {applications.map((application) => (
        <Card key={application.id} className="hover:shadow-md transition-shadow bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg text-white">{application.full_name}</CardTitle>
                <p className="text-sm text-gray-400 mt-1">{application.email}</p>
              </div>
              <StatusBadge status={application.status} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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

            <div className="flex gap-2 flex-wrap">
              <Link to={`/dashboard/applications/${application.id}`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30 hover:text-gold-light"
                >
                  <Eye className="w-4 h-4" />
                  View Details
                </Button>
              </Link>
              {application.status === 'pending' && (
                <>
                  {onApprove && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => onApprove(application)}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve
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
    </div>
  );
}

