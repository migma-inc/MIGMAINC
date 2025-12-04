/**
 * Component for displaying a list of Book a Call submissions
 */

import React from 'react';
import { useBookACallSubmissions } from '@/hooks/useBookACallSubmissions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Calendar, Building2, Mail, Phone, Globe } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BookACallListProps {
  refreshKey?: number;
}

export function BookACallList({ refreshKey }: BookACallListProps) {
  const { submissions, loading, error, refetch } = useBookACallSubmissions({
    orderBy: 'created_at',
    orderDirection: 'desc',
  });

  // Refetch when refreshKey changes
  React.useEffect(() => {
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
          <p className="mt-4 text-gray-400">Loading submissions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-500/50 text-red-300 px-4 py-3 rounded-md">
        <p className="font-semibold">Error loading submissions</p>
        <p className="text-sm mt-1">{error}</p>
        <Button onClick={refetch} variant="outline" className="mt-2 border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30 hover:text-gold-light">
          Retry
        </Button>
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-lg">No submissions found</p>
        <p className="text-gray-500 text-sm mt-2">Book a Call submissions will appear here</p>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-4">
      {submissions.map((submission) => (
        <Card
          key={submission.id}
          className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border-gold-medium/30 hover:border-gold-medium/50 transition-colors"
        >
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-gold-medium" />
                  <h3 className="text-lg font-bold text-white">{submission.company_name}</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-300">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gold-medium" />
                    <span>{submission.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gold-medium" />
                    <span>{submission.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-gold-medium" />
                    <span>{submission.country}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gold-medium" />
                    <span>{formatDate(submission.created_at)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <span className="text-xs px-2 py-1 bg-gold-medium/20 text-gold-light rounded border border-gold-medium/30">
                    {submission.type_of_business}
                  </span>
                  <span className="text-xs px-2 py-1 bg-gold-medium/20 text-gold-light rounded border border-gold-medium/30">
                    {submission.lead_volume}
                  </span>
                </div>
              </div>

              <div className="ml-4">
                <Link to={`/dashboard/book-a-call/${submission.id}`}>
                  <Button
                    variant="outline"
                    className="border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30 hover:text-gold-light"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

