import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface MeetingScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    meetingDate: string;
    meetingTime: string;
    meetingLink: string;
    scheduledBy?: string;
  }) => void;
  isLoading?: boolean;
  initialData?: {
    meetingDate?: string;
    meetingTime?: string;
    meetingLink?: string;
    scheduledBy?: string;
  };
  isEditMode?: boolean;
}

export function MeetingScheduleModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  initialData,
  isEditMode = false,
}: MeetingScheduleModalProps) {
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [scheduledBy, setScheduledBy] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      // Set initial data if provided (for edit mode), otherwise reset
      if (initialData) {
        setMeetingDate(initialData.meetingDate || '');
        setMeetingTime(initialData.meetingTime || '');
        setMeetingLink(initialData.meetingLink || '');
        setScheduledBy(initialData.scheduledBy || '');
      } else {
        setMeetingDate('');
        setMeetingTime('');
        setMeetingLink('');
        setScheduledBy('');
      }
      setErrors({});
    }
  }, [isOpen, initialData]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!meetingDate) {
      newErrors.meetingDate = 'Date is required';
    } else {
      // Parse date in local timezone to avoid timezone conversion issues
      const [year, month, day] = meetingDate.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date < today) {
        newErrors.meetingDate = 'Date cannot be in the past';
      }
    }

    if (!meetingTime.trim()) {
      newErrors.meetingTime = 'Time is required';
    }

    if (!meetingLink.trim()) {
      newErrors.meetingLink = 'Meeting link is required';
    } else {
      // Basic URL validation
      try {
        new URL(meetingLink);
      } catch {
        newErrors.meetingLink = 'Please enter a valid URL';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleConfirm = () => {
    if (!validateForm()) {
      return;
    }

    onConfirm({
      meetingDate,
      meetingTime: meetingTime.trim(),
      meetingLink: meetingLink.trim(),
      scheduledBy: scheduledBy.trim() || undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-black border border-gold-medium/50 rounded-lg shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold text-white">
              {isEditMode ? 'Edit Meeting Details' : 'Schedule Meeting'}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              disabled={isLoading}
              className="text-white hover:text-white hover:bg-transparent"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="space-y-4">
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
                disabled={isLoading}
              />
              {errors.meetingDate && (
                <p className="text-red-500 text-sm mt-1">{errors.meetingDate}</p>
              )}
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
                placeholder="Ex: 14:00 or 2:00 PM"
                className="bg-white text-black"
                disabled={isLoading}
              />
              {errors.meetingTime && (
                <p className="text-red-500 text-sm mt-1">{errors.meetingTime}</p>
              )}
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
                placeholder="https://zoom.us/j/..."
                className="bg-white text-black"
                disabled={isLoading}
              />
              {errors.meetingLink && (
                <p className="text-red-500 text-sm mt-1">{errors.meetingLink}</p>
              )}
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
                placeholder="Admin name"
                className="bg-white text-black"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end mt-6">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="border-gold-medium/50 bg-black/50 text-white hover:bg-black/50 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isLoading 
                ? (isEditMode ? 'Updating...' : 'Scheduling...') 
                : (isEditMode ? 'Update Meeting & Send Email' : 'Schedule Meeting & Send Email')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

