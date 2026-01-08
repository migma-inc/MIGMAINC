/**
 * Component for displaying a list of scheduled meetings
 */

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Mail, Pencil, Trash2, ExternalLink, User, AtSign } from 'lucide-react';
import type { ScheduledMeeting } from '@/lib/meetings';
import { getScheduledMeetings, deleteScheduledMeeting, resendMeetingEmail } from '@/lib/meetings';
import { AlertModal } from '@/components/ui/alert-modal';
import { ConfirmModal } from '@/components/ui/confirm-modal';

interface ScheduledMeetingsListProps {
  onEdit?: (meeting: ScheduledMeeting) => void;
  refreshKey?: number;
  filterDate?: 'upcoming' | 'past' | 'all';
}

export function ScheduledMeetingsList({
  onEdit,
  refreshKey,
  filterDate = 'all',
}: ScheduledMeetingsListProps) {
  const [meetings, setMeetings] = useState<ScheduledMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  const [alertData, setAlertData] = useState<{ title: string; message: string; variant: 'success' | 'error' | 'warning' | 'info' } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [meetingToDelete, setMeetingToDelete] = useState<{ id: string; date: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadMeetings = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getScheduledMeetings({
        orderBy: 'meeting_date',
        orderDirection: 'asc',
        filterDate: filterDate,
      });

      if (result.success && result.data) {
        setMeetings(result.data);
      } else {
        setError(result.error || 'Failed to load meetings');
      }
    } catch (err) {
      console.error('[ScheduledMeetingsList] Error loading meetings:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeetings();
  }, [filterDate]);

  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0) {
      loadMeetings();
    }
  }, [refreshKey]);

  const handleDelete = (meetingId: string, meetingDate: string) => {
    setMeetingToDelete({ id: meetingId, date: meetingDate });
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!meetingToDelete) return;

    setIsDeleting(true);
    try {
      const result = await deleteScheduledMeeting(meetingToDelete.id);
      if (result.success) {
        setAlertData({
          title: 'Success',
          message: 'Meeting deleted successfully',
          variant: 'success',
        });
        setShowAlert(true);
        setShowDeleteConfirm(false);
        setMeetingToDelete(null);
        loadMeetings();
      } else {
        setAlertData({
          title: 'Error',
          message: result.error || 'Failed to delete meeting',
          variant: 'error',
        });
        setShowAlert(true);
      }
    } catch (err) {
      console.error('[ScheduledMeetingsList] Error deleting meeting:', err);
      setAlertData({
        title: 'Error',
        message: 'An unexpected error occurred',
        variant: 'error',
      });
      setShowAlert(true);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResendEmail = async (meeting: ScheduledMeeting) => {
    try {
      const result = await resendMeetingEmail(meeting.id);
      if (result.success) {
        setAlertData({
          title: 'Success',
          message: 'Meeting invitation email sent successfully',
          variant: 'success',
        });
        setShowAlert(true);
      } else {
        setAlertData({
          title: 'Error',
          message: result.error || 'Failed to send email',
          variant: 'error',
        });
        setShowAlert(true);
      }
    } catch (err) {
      console.error('[ScheduledMeetingsList] Error resending email:', err);
      setAlertData({
        title: 'Error',
        message: 'An unexpected error occurred',
        variant: 'error',
      });
      setShowAlert(true);
    }
  };

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const isUpcoming = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const meetingDate = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return meetingDate >= today;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-medium mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading meetings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-500/50 text-red-300 px-4 py-3 rounded-md">
        <p className="font-semibold">Error loading meetings</p>
        <p className="text-sm mt-1">{error}</p>
        <Button
          onClick={loadMeetings}
          variant="outline"
          className="mt-2 border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30 hover:text-gold-light"
        >
          Retry
        </Button>
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="w-16 h-16 text-gray-500 mx-auto mb-4" />
        <p className="text-gray-400 text-lg">No meetings found</p>
        {filterDate && filterDate !== 'all' && (
          <p className="text-gray-500 text-sm mt-2">
            No {filterDate === 'upcoming' ? 'upcoming' : 'past'} meetings
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {meetings.map((meeting) => {
          const upcoming = isUpcoming(meeting.meeting_date);
          return (
            <Card
              key={meeting.id}
              className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30"
            >
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-gold-medium/20 rounded-lg">
                        <Calendar className="w-5 h-5 text-gold-light" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-white">{meeting.full_name}</h3>
                          {upcoming ? (
                            <Badge className="bg-green-500/20 text-green-300 border-green-500/50">
                              Upcoming
                            </Badge>
                          ) : (
                            <Badge className="bg-gray-500/20 text-gray-300 border-gray-500/50">
                              Past
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-gray-300">
                            <AtSign className="w-4 h-4 text-gray-400" />
                            <span>{meeting.email}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-300">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span>{formatDate(meeting.meeting_date)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-300">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span>{meeting.meeting_time}</span>
                          </div>
                          {meeting.meeting_link && (
                            <div className="flex items-center gap-2">
                              <ExternalLink className="w-4 h-4 text-gray-400" />
                              <a
                                href={meeting.meeting_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gold-light hover:text-gold-medium transition-colors break-all"
                              >
                                {meeting.meeting_link}
                              </a>
                            </div>
                          )}
                          {meeting.scheduled_by && (
                            <div className="flex items-center gap-2 text-gray-400 text-xs">
                              <User className="w-3 h-3" />
                              <span>Scheduled by: {meeting.scheduled_by}</span>
                            </div>
                          )}
                          {meeting.notes && (
                            <div className="mt-2 pt-2 border-t border-gold-medium/20">
                              <p className="text-xs text-gray-400 mb-1">Notes:</p>
                              <p className="text-sm text-gray-300">{meeting.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {onEdit && (
                      <Button
                        onClick={() => onEdit(meeting)}
                        variant="outline"
                        size="sm"
                        className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-gold-medium/20"
                      >
                        <Pencil className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    )}
                    <Button
                      onClick={() => handleResendEmail(meeting)}
                      variant="outline"
                      size="sm"
                      className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-gold-medium/20"
                    >
                      <Mail className="w-4 h-4 mr-1" />
                      Resend Email
                    </Button>
                    <Button
                      onClick={() => handleDelete(meeting.id, meeting.meeting_date)}
                      variant="outline"
                      size="sm"
                      className="border-red-500/50 bg-black/50 text-red-300 hover:bg-red-500/20"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

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

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setMeetingToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Meeting"
        message={meetingToDelete ? `Are you sure you want to delete the meeting scheduled for ${formatDate(meetingToDelete.date)}? This action cannot be undone.` : ''}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
      />
    </>
  );
}
