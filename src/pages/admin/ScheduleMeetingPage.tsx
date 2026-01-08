/**
 * Schedule Meeting Page - Admin can schedule meetings and send emails directly to users
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScheduledMeetingsList } from '@/components/admin/ScheduledMeetingsList';
import { AlertModal } from '@/components/ui/alert-modal';
import { Calendar, Plus, Loader2 } from 'lucide-react';
import { scheduleMeeting, updateScheduledMeeting, type ScheduledMeeting } from '@/lib/meetings';
import { getCurrentUser } from '@/lib/auth';

export function ScheduleMeetingPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [notes, setNotes] = useState('');
  const [scheduledBy, setScheduledBy] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filterDate, setFilterDate] = useState<'upcoming' | 'past' | 'all'>('all');
  const [showAlert, setShowAlert] = useState(false);
  const [alertData, setAlertData] = useState<{ title: string; message: string; variant: 'success' | 'error' | 'warning' | 'info' } | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<ScheduledMeeting | null>(null);

  // Load current user for scheduled_by field
  useEffect(() => {
    const loadUser = async () => {
      const user = await getCurrentUser();
      if (user) {
        setScheduledBy(user.email || '');
      }
    };
    loadUser();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !email.trim() || !meetingDate || !meetingTime || !meetingLink.trim()) {
      setAlertData({
        title: 'Validation Error',
        message: 'Please fill in all required fields',
        variant: 'error',
      });
      setShowAlert(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await scheduleMeeting({
        email: email.trim(),
        full_name: fullName.trim(),
        meeting_date: meetingDate,
        meeting_time: meetingTime.trim(),
        meeting_link: meetingLink.trim(),
        scheduled_by: scheduledBy.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (result.success) {
        setAlertData({
          title: 'Success',
          message: result.error || 'Meeting scheduled successfully! Email sent.',
          variant: 'success',
        });
        setShowAlert(true);
        // Reset form
        setFullName('');
        setEmail('');
        setMeetingDate('');
        setMeetingTime('');
        setMeetingLink('');
        setNotes('');
        // Refresh list
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
      setIsSubmitting(false);
    }
  };

  const handleEdit = (meeting: ScheduledMeeting) => {
    setEditingMeeting(meeting);
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMeeting) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData(e.target as HTMLFormElement);
      const result = await updateScheduledMeeting(editingMeeting.id, {
        email: formData.get('email') as string,
        full_name: formData.get('full_name') as string,
        meeting_date: formData.get('meeting_date') as string,
        meeting_time: formData.get('meeting_time') as string,
        meeting_link: formData.get('meeting_link') as string,
        scheduled_by: formData.get('scheduled_by') as string || undefined,
        notes: formData.get('notes') as string || undefined,
      });

      if (result.success) {
        setAlertData({
          title: 'Success',
          message: 'Meeting updated successfully! Email sent.',
          variant: 'success',
        });
        setShowAlert(true);
        setShowEditModal(false);
        setEditingMeeting(null);
        setRefreshKey(prev => prev + 1);
      } else {
        setAlertData({
          title: 'Error',
          message: result.error || 'Failed to update meeting',
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
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold migma-gold-text flex items-center gap-2">
              <Calendar className="w-6 h-6 sm:w-8 sm:h-8" />
              Schedule Meeting
            </h1>
            <p className="text-gray-400 mt-1 text-sm sm:text-base">
              Schedule meetings and send invitation emails directly to users
            </p>
          </div>
        </div>

        {/* Schedule Form */}
        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Plus className="w-5 h-5" />
              New Meeting
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Full Name */}
                <div>
                  <Label htmlFor="full-name" className="text-white mb-2 block">
                    Full Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="full-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="bg-white text-black"
                    disabled={isSubmitting}
                    required
                  />
                </div>

                {/* Email */}
                <div>
                  <Label htmlFor="email" className="text-white mb-2 block">
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-white text-black"
                    disabled={isSubmitting}
                    required
                  />
                </div>

                {/* Meeting Date */}
                <div>
                  <Label htmlFor="meeting-date" className="text-white mb-2 block">
                    Meeting Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="meeting-date"
                    type="date"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    className="bg-white text-black"
                    disabled={isSubmitting}
                    required
                  />
                </div>

                {/* Meeting Time */}
                <div>
                  <Label htmlFor="meeting-time" className="text-white mb-2 block">
                    Meeting Time <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="meeting-time"
                    type="text"
                    value={meetingTime}
                    onChange={(e) => setMeetingTime(e.target.value)}
                    placeholder="e.g., 15:00 or 3:00 PM"
                    className="bg-white text-black"
                    disabled={isSubmitting}
                    required
                  />
                </div>

                {/* Meeting Link */}
                <div>
                  <Label htmlFor="meeting-link" className="text-white mb-2 block">
                    Meeting Link <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="meeting-link"
                    type="url"
                    value={meetingLink}
                    onChange={(e) => setMeetingLink(e.target.value)}
                    placeholder="https://meet.google.com/..."
                    className="bg-white text-black"
                    disabled={isSubmitting}
                    required
                  />
                </div>

                {/* Scheduled By (Optional) */}
                <div>
                  <Label htmlFor="scheduled-by" className="text-white mb-2 block">
                    Scheduled By (Optional)
                  </Label>
                  <Input
                    id="scheduled-by"
                    type="text"
                    value={scheduledBy}
                    onChange={(e) => setScheduledBy(e.target.value)}
                    className="bg-white text-black"
                    disabled={isSubmitting}
                  />
                </div>

                {/* Notes (Optional) */}
                <div className="md:col-span-2">
                  <Label htmlFor="notes" className="text-white mb-2 block">
                    Notes (Optional)
                  </Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="bg-white text-black min-h-[80px]"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-gold-medium hover:bg-gold-light text-black flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Scheduling...
                    </>
                  ) : (
                    <>
                      <Calendar className="w-4 h-4" />
                      Schedule Meeting & Send Email
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Filter and List of Scheduled Meetings */}
        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-white flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Scheduled Meetings
              </CardTitle>
              <div className="flex items-center gap-3">
                <Label htmlFor="filter-date" className="text-white text-sm whitespace-nowrap">
                  Filter:
                </Label>
                <Select value={filterDate} onValueChange={(value) => setFilterDate(value as 'upcoming' | 'past' | 'all')}>
                  <SelectTrigger id="filter-date" className="w-full sm:w-[160px] bg-black/50 border-gold-medium/50 text-white hover:bg-black/70">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Meetings</SelectItem>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="past">Past</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScheduledMeetingsList filterDate={filterDate} refreshKey={refreshKey} onEdit={handleEdit} />
          </CardContent>
        </Card>

        {/* Edit Meeting Modal */}
        {editingMeeting && showEditModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="text-white">Edit Meeting</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleEditSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-full-name" className="text-white mb-2 block">
                        Full Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="edit-full-name"
                        name="full_name"
                        type="text"
                        defaultValue={editingMeeting.full_name}
                        className="bg-white text-black"
                        disabled={isSubmitting}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-email" className="text-white mb-2 block">
                        Email <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="edit-email"
                        name="email"
                        type="email"
                        defaultValue={editingMeeting.email}
                        className="bg-white text-black"
                        disabled={isSubmitting}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-meeting-date" className="text-white mb-2 block">
                        Meeting Date <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="edit-meeting-date"
                        name="meeting_date"
                        type="date"
                        defaultValue={editingMeeting.meeting_date}
                        className="bg-white text-black"
                        disabled={isSubmitting}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-meeting-time" className="text-white mb-2 block">
                        Meeting Time <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="edit-meeting-time"
                        name="meeting_time"
                        type="text"
                        defaultValue={editingMeeting.meeting_time}
                        className="bg-white text-black"
                        disabled={isSubmitting}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-meeting-link" className="text-white mb-2 block">
                        Meeting Link <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="edit-meeting-link"
                        name="meeting_link"
                        type="url"
                        defaultValue={editingMeeting.meeting_link}
                        className="bg-white text-black"
                        disabled={isSubmitting}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-scheduled-by" className="text-white mb-2 block">
                        Scheduled By
                      </Label>
                      <Input
                        id="edit-scheduled-by"
                        name="scheduled_by"
                        type="text"
                        defaultValue={editingMeeting.scheduled_by || ''}
                        className="bg-white text-black"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="edit-notes" className="text-white mb-2 block">
                        Notes
                      </Label>
                      <Textarea
                        id="edit-notes"
                        name="notes"
                        defaultValue={editingMeeting.notes || ''}
                        className="bg-white text-black min-h-[80px]"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowEditModal(false);
                        setEditingMeeting(null);
                      }}
                      disabled={isSubmitting}
                      className="border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="bg-gold-medium hover:bg-gold-light text-black"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Updating...
                        </>
                      ) : (
                        'Update Meeting'
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Alert Modal */}
        {alertData && (
          <AlertModal
            isOpen={showAlert}
            onClose={() => setShowAlert(false)}
            title={alertData.title}
            message={alertData.message}
            variant={alertData.variant}
          />
        )}
      </div>
    </div>
  );
}
