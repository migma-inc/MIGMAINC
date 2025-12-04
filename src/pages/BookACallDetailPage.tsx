/**
 * Book a Call Detail Page
 * Shows complete information about a Book a Call submission
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { BookACallSubmission } from '@/hooks/useBookACallSubmissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Building2, Mail, Phone, Globe, Calendar, FileText, ExternalLink } from 'lucide-react';

function BookACallDetailContent() {
  const { id } = useParams<{ id: string }>();
  const [submission, setSubmission] = useState<BookACallSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSubmission() {
      if (!id) {
        setError('Submission ID is required');
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('book_a_call_submissions')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError) {
          throw fetchError;
        }

        if (!data) {
          setError('Submission not found');
          setLoading(false);
          return;
        }

        setSubmission(data as BookACallSubmission);
      } catch (err) {
        console.error('[BookACallDetail] Error loading submission:', err);
        setError(err instanceof Error ? err.message : 'Failed to load submission');
      } finally {
        setLoading(false);
      }
    }

    loadSubmission();
  }, [id]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-medium mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading submission...</p>
        </div>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="space-y-4">
        <Link to="/dashboard/book-a-call">
          <Button variant="ghost" className="text-gold-light hover:text-gold-medium hover:bg-gold-medium/10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Book a Call Submissions
          </Button>
        </Link>
        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border-gold-medium/30">
          <CardContent className="p-6">
            <div className="text-center py-8">
              <p className="text-red-300 text-lg font-semibold">Error</p>
              <p className="text-gray-400 mt-2">{error || 'Submission not found'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/dashboard/book-a-call">
          <Button variant="ghost" className="text-gold-light hover:text-gold-medium hover:bg-gold-medium/10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Book a Call Submissions
          </Button>
        </Link>
      </div>

      <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border-gold-medium/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl migma-gold-text flex items-center gap-2">
              <Building2 className="w-6 h-6" />
              {submission.company_name}
            </CardTitle>
            <div className="text-sm text-gray-400 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {formatDate(submission.created_at)}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Company Information */}
          <div>
            <h3 className="text-lg font-semibold text-gold-light mb-4">Company Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-gray-400">Company Name</p>
                <p className="text-white font-medium">{submission.company_name}</p>
              </div>
              {submission.website && (
                <div className="space-y-1">
                  <p className="text-sm text-gray-400">Website</p>
                  <a
                    href={submission.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gold-medium hover:text-gold-light flex items-center gap-1"
                  >
                    {submission.website}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
              <div className="space-y-1">
                <p className="text-sm text-gray-400">Country</p>
                <p className="text-white font-medium flex items-center gap-2">
                  <Globe className="w-4 h-4 text-gold-medium" />
                  {submission.country}
                </p>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div>
            <h3 className="text-lg font-semibold text-gold-light mb-4">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-gray-400">Contact Name</p>
                <p className="text-white font-medium">{submission.contact_name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-400">Email</p>
                <a
                  href={`mailto:${submission.email}`}
                  className="text-gold-medium hover:text-gold-light flex items-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  {submission.email}
                </a>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-400">Phone / WhatsApp</p>
                <a
                  href={`tel:${submission.phone}`}
                  className="text-gold-medium hover:text-gold-light flex items-center gap-2"
                >
                  <Phone className="w-4 h-4" />
                  {submission.phone}
                </a>
              </div>
            </div>
          </div>

          {/* Business Details */}
          <div>
            <h3 className="text-lg font-semibold text-gold-light mb-4">Business Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-gray-400">Type of Business</p>
                <p className="text-white font-medium">{submission.type_of_business}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-400">Lead Volume</p>
                <p className="text-white font-medium">{submission.lead_volume}</p>
              </div>
            </div>
          </div>

          {/* Challenges */}
          {submission.challenges && (
            <div>
              <h3 className="text-lg font-semibold text-gold-light mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Challenges
              </h3>
              <div className="bg-black/50 p-4 rounded-lg border border-gold-medium/20">
                <p className="text-gray-300 whitespace-pre-wrap">{submission.challenges}</p>
              </div>
            </div>
          )}

          {/* Additional Information */}
          <div>
            <h3 className="text-lg font-semibold text-gold-light mb-4">Additional Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-gray-400">Confirmation Accepted</p>
                <p className="text-white font-medium">
                  {submission.confirmation_accepted ? (
                    <span className="text-green-300">Yes</span>
                  ) : (
                    <span className="text-red-300">No</span>
                  )}
                </p>
              </div>
              {submission.ip_address && (
                <div className="space-y-1">
                  <p className="text-sm text-gray-400">IP Address</p>
                  <p className="text-white font-medium text-sm">{submission.ip_address}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function BookACallDetailPage() {
  return <BookACallDetailContent />;
}


