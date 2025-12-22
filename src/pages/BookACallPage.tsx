/**
 * Book a Call Page - Admin view of all Book a Call submissions
 */

import { BookACallList } from '@/components/admin/BookACallList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone } from 'lucide-react';

export function BookACallPage() {
  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border-gold-medium/30">
        <CardHeader>
          <CardTitle className="text-2xl migma-gold-text flex items-center gap-2">
            <Phone className="w-6 h-6" />
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

























