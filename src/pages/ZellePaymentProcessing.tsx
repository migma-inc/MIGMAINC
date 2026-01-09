import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, ArrowRight, CheckCircle } from 'lucide-react';

export const ZellePaymentProcessing = () => {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
        <CardContent className="p-8 text-center">
          <div className="mb-6">
            <div className="relative inline-block mb-4">
              <Clock className="w-20 h-20 text-gold-medium mx-auto animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 border-4 border-gold-light/30 border-t-gold-medium rounded-full animate-spin"></div>
              </div>
            </div>
            <h1 className="text-3xl font-bold migma-gold-text mb-2">
              Your payment is being processed
            </h1>
            <p className="text-gray-300 text-lg mt-4">
              We have received your Zelle payment receipt and our team is reviewing it.
            </p>
          </div>

          <div className="bg-black/50 rounded-lg p-6 mb-6 text-left">
            <div className="flex items-start gap-3 mb-4">
              <CheckCircle className="w-5 h-5 text-gold-medium flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="text-lg font-semibold text-gold-light mb-2">
                  What happens now?
                </h2>
                <p className="text-gray-300 text-sm leading-relaxed">
                  Our team is verifying your payment receipt. This process may take up to <strong className="text-gold-light">48 hours</strong> to complete.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 mb-4">
              <CheckCircle className="w-5 h-5 text-gold-medium flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="text-lg font-semibold text-gold-light mb-2">
                  You will receive a confirmation
                </h2>
                <p className="text-gray-300 text-sm leading-relaxed">
                  Once the payment is confirmed, you will receive an email with the next steps to begin the visa process.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-gold-medium flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="text-lg font-semibold text-gold-light mb-2">
                  Need help?
                </h2>
                <p className="text-gray-300 text-sm leading-relaxed">
                  If you have any questions or need support, please contact us through our contact page.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-gold-medium/10 border border-gold-medium/30 rounded-lg p-4">
              <p className="text-sm text-gold-light">
                <strong>Estimated time:</strong> Up to 48 business hours
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/contact">
                <Button className="bg-gradient-to-b from-gold-light via-gold-medium to-gold-light text-black font-bold hover:from-gold-medium hover:via-gold-light hover:to-gold-medium w-full sm:w-auto">
                  Contact Us
                </Button>
              </Link>
              <Link to="/">
                <Button 
                  className="bg-black border-2 border-gold-medium/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium w-full sm:w-auto"
                >
                  Back to Home
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
