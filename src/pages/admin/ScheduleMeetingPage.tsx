/**
 * Admin page for scheduling meetings and sending emails directly to users
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
import { MeetingScheduleModal } from '@/components/admin/MeetingScheduleModal';
import { Calendar, Plus, Filter } from 'lucide-react';
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

  const handleEditConfirm = async (data: {
    meetingDate: string;
    meetingTime: string;
    meetingLink: string;
    scheduledBy?: string;
  }) => {
    if (!editingMeeting) return;

    setIsSubmitting(true);
    try {
      const result = await updateScheduledMeeting(editingMeeting.id, {
        meeting_date: data.meetingDate,
        meeting_time: data.meetingTime,
        meeting_link: data.meetingLink,
        scheduled_by: data.scheduledBy,
      });

      if (result.success) {
        setAlertData({
          title: 'Success',
          message: result.error || 'Meeting updated successfully! Email sent.',
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
                    className="bg-white text-black"
                    disabled={isSubmitting}
                    required
                  />
                </div>

                {/* Meeting Link */}
                <div className="md:col-span-2">
                  <Label htmlFor="meeting-link" className="text-white mb-2 block">
                    Meeting Link <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="meeting-link"
                    type="url"
                    value={meetingLink}
                    onChange={(e) => setMeetingLink(e.target.value)}
                    className="bg-white text-black"
                    disabled={isSubmitting}
                    required
                  />
                </div>

                {/* Scheduled By */}
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

                {/* Notes */}
                <div className="md:col-span-2">
                  <Label htmlFor="notes" className="text-white mb-2 block">
                    Notes (Optional)
                  </Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="bg-white text-black min-h-[100px]"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {isSubmitting ? 'Scheduling...' : 'Schedule Meeting & Send Email'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Meetings List */}
        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="text-white">Scheduled Meetings</CardTitle>
              <div className="flex items-center gap-3">
                <Filter className="w-4 h-4 text-gray-400" />
                <Select
                  value={filterDate}
                  onValueChange={(value) => setFilterDate(value as 'upcoming' | 'past' | 'all')}
                >
                  <SelectTrigger className="w-[140px] sm:w-[180px] bg-black/50 border-gold-medium/50 text-white hover:bg-black/70">
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
            <ScheduledMeetingsList
              onEdit={handleEdit}
              refreshKey={refreshKey}
              filterDate={filterDate}
            />
          </CardContent>
        </Card>
      </div>

      {/* Edit Modal */}
      {editingMeeting && (
        <MeetingScheduleModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingMeeting(null);
          }}
          onConfirm={handleEditConfirm}
          isLoading={isSubmitting}
          initialData={{
            meetingDate: editingMeeting.meeting_date,
            meetingTime: editingMeeting.meeting_time,
            meetingLink: editingMeeting.meeting_link,
            scheduledBy: editingMeeting.scheduled_by || undefined,
          }}
          isEditMode={true}
        />
      )}

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
    </div>
  );
}

