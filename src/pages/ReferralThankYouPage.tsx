import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarCheck, CheckCircle2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const ReferralThankYouPage = () => {
  const [searchParams] = useSearchParams();
  const meetUrl    = searchParams.get('meet_url');
  const bookingUrl = searchParams.get('booking_url');
  const mentorName = searchParams.get('mentor');
  const slotStart  = searchParams.get('slot_start');

  const resolvedMeetUrl = meetUrl ?? bookingUrl;

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-[#1a1a1a] to-black font-sans text-foreground">
      <Header />

      <div className="pt-[120px] pb-24 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-2xl"
        >
          <Card className="border-gold-medium/30 shadow-2xl bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 backdrop-blur-sm">
            <CardContent className="p-8 sm:p-12 text-center">

              {/* Icon */}
              <div className="w-16 h-16 bg-green-900/30 border-2 border-green-500/50 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-green-300" />
              </div>

              <h1 className="text-3xl md:text-4xl font-bold mb-4 migma-gold-text">
                You're all set!
              </h1>

              {slotStart && (
                <p className="text-sm text-gray-400">
                  {new Intl.DateTimeFormat('en-US', {
                    weekday: 'long', month: 'short', day: 'numeric',
                    hour: 'numeric', minute: '2-digit', hour12: true,
                  }).format(new Date(slotStart))}
                </p>
              )}

              {resolvedMeetUrl ? (
                <>
                  <p className="text-lg text-gray-300 mb-6 leading-relaxed">
                    Your call{mentorName ? ` with ${mentorName}` : ''} is confirmed. Here's your Google Meet link:
                  </p>

                  <a href={resolvedMeetUrl} target="_blank" rel="noopener noreferrer">
                    <Button className="w-full sm:w-auto btn btn-primary text-base py-5 px-8 mb-4">
                      <CalendarCheck className="w-5 h-5 mr-2" />
                      Open Google Meet
                    </Button>
                  </a>

                  <p className="text-xs text-gray-500 mt-3">
                    A confirmation email has been sent to you with all the details.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg text-gray-300 mb-8 leading-relaxed">
                    Our team will reach out on WhatsApp shortly to schedule your call with a mentor.
                  </p>

                  <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                    <MessageCircle className="w-4 h-4 text-green-400" />
                    <span>Keep an eye on your WhatsApp</span>
                  </div>
                </>
              )}

              <div className="mt-10 pt-6 border-t border-white/10">
                <Link to="/">
                  <Button variant="ghost" className="text-gray-400 hover:text-white text-sm">
                    Back to homepage
                  </Button>
                </Link>
              </div>

            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Footer />
    </div>
  );
};
