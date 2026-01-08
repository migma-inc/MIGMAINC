/**
 * Book a Call Page - Admin view of all Book a Call submissions
 */

import { BookACallList } from '@/components/admin/BookACallList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone } from 'lucide-react';

export function BookACallPage() {
  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border-gold-medium/30">
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl migma-gold-text flex items-center gap-2">
            <Phone className="w-5 h-5 sm:w-6 sm:h-6" />
            Book a Call Submissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BookACallList />
        </CardContent>
      </Card>
    </div>
  );
}


































