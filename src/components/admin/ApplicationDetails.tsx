/**
 * Component for displaying detailed information about an application
 */

import type { Application } from '@/types/application';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Download, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ApplicationDetailsProps {
  application: Application;
  onClose: () => void;
  onApprove?: (application: Application) => void;
  onReject?: (application: Application) => void;
}

function StatusBadge({ status }: { status: Application['status'] }) {
  const variants = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    approved: 'bg-green-100 text-green-800 border-green-200',
    rejected: 'bg-red-100 text-red-800 border-red-200',
  };

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${variants[status]}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export function ApplicationDetails({
  application,
  onClose,
  onApprove,
  onReject,
}: ApplicationDetailsProps) {
  const handleDownloadCV = async () => {
    if (!application.cv_file_path) {
      alert('CV file not available');
      return;
    }

    try {
      // Get public URL for the CV file
      const { data } = supabase.storage
        .from('cv-files')
        .getPublicUrl(application.cv_file_path);

      if (data?.publicUrl) {
        window.open(data.publicUrl, '_blank');
      } else {
        alert('Could not generate CV download link');
      }
    } catch (error) {
      console.error('Error downloading CV:', error);
      alert('Error downloading CV file');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <div>
            <CardTitle className="text-2xl">{application.full_name}</CardTitle>
            <p className="text-sm text-gray-500 mt-1">{application.email}</p>
          </div>
          <div className="flex items-center gap-4">
            <StatusBadge status={application.status} />
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Personal Information */}
          <section>
            <h3 className="text-lg font-semibold mb-3">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Full Name</p>
                <p className="font-medium">{application.full_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{application.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-medium">{application.phone}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Country</p>
                <p className="font-medium">{application.country}</p>
              </div>
              {application.city && (
                <div>
                  <p className="text-sm text-gray-500">City</p>
                  <p className="font-medium">{application.city}</p>
                </div>
              )}
            </div>
          </section>

          {/* Business Information */}
          <section>
            <h3 className="text-lg font-semibold mb-3">Business Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Has Business Registration</p>
                <p className="font-medium">{application.has_business_registration}</p>
              </div>
              {application.business_name && (
                <div>
                  <p className="text-sm text-gray-500">Business Name</p>
                  <p className="font-medium">{application.business_name}</p>
                </div>
              )}
              {application.business_id && (
                <div>
                  <p className="text-sm text-gray-500">Business ID (CNPJ/NIF)</p>
                  <p className="font-medium">{application.business_id}</p>
                </div>
              )}
              {application.tax_id && (
                <div>
                  <p className="text-sm text-gray-500">Tax ID</p>
                  <p className="font-medium">{application.tax_id}</p>
                </div>
              )}
            </div>
          </section>

          {/* Professional Information */}
          <section>
            <h3 className="text-lg font-semibold mb-3">Professional Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {application.current_occupation && (
                <div>
                  <p className="text-sm text-gray-500">Current Occupation</p>
                  <p className="font-medium">{application.current_occupation}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">Area of Expertise</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {application.area_of_expertise.map((area, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              </div>
              {application.interested_roles && application.interested_roles.length > 0 && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-500">Interested Roles</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {application.interested_roles.map((role, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">Years of Experience</p>
                <p className="font-medium">{application.years_of_experience}</p>
              </div>
              {application.visa_experience && (
                <div>
                  <p className="text-sm text-gray-500">U.S. Visa Experience</p>
                  <p className="font-medium">{application.visa_experience}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">English Level</p>
                <p className="font-medium">{application.english_level}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Client Experience</p>
                <p className="font-medium">{application.client_experience}</p>
              </div>
              {application.client_experience_description && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-500">Client Experience Description</p>
                  <p className="font-medium">{application.client_experience_description}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">Weekly Availability</p>
                <p className="font-medium">{application.weekly_availability}</p>
              </div>
            </div>
          </section>

          {/* Additional Information */}
          <section>
            <h3 className="text-lg font-semibold mb-3">Additional Information</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Why MIGMA?</p>
                <p className="font-medium">{application.why_migma}</p>
              </div>
              {application.linkedin_url && (
                <div>
                  <p className="text-sm text-gray-500">LinkedIn</p>
                  <a
                    href={application.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {application.linkedin_url}
                  </a>
                </div>
              )}
              {application.other_links && (
                <div>
                  <p className="text-sm text-gray-500">Other Links</p>
                  <a
                    href={application.other_links}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {application.other_links}
                  </a>
                </div>
              )}
              {application.cv_file_name && (
                <div>
                  <p className="text-sm text-gray-500">CV File</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadCV}
                    className="mt-1 flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    {application.cv_file_name}
                  </Button>
                </div>
              )}
            </div>
          </section>

          {/* Timestamps */}
          <section className="border-t pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-500">
              <div>
                <p>Submitted: {new Date(application.created_at).toLocaleString()}</p>
              </div>
              <div>
                <p>Last Updated: {new Date(application.updated_at).toLocaleString()}</p>
              </div>
            </div>
          </section>

          {/* Actions */}
          {application.status === 'pending' && (
            <section className="border-t pt-4 flex gap-4">
              {onApprove && (
                <Button
                  onClick={() => onApprove(application)}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve Application
                </Button>
              )}
              {onReject && (
                <Button
                  variant="destructive"
                  onClick={() => onReject(application)}
                  className="flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Reject Application
                </Button>
              )}
            </section>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

