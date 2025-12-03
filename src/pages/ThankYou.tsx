import { useNavigate } from 'react-router-dom';
import { Check, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const ThankYou = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-b from-black via-[#1a1a1a] to-black flex items-center justify-center py-24 px-4">
            <Card className="max-w-2xl w-full border border-gold-medium/30 shadow-2xl bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 backdrop-blur-sm">
                <CardContent className="p-8 sm:p-12 text-center">
                    <div className="w-16 h-16 bg-gold-medium/20 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-gold-medium/50">
                        <Check className="w-8 h-8 text-gold-medium" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold mb-4 migma-gold-text">
                        Thank you for applying to the MIGMA Global Partner Program
                    </h1>
                    <p className="text-lg text-gray-300 mb-8">
                        We have received your application. Our team will review your profile and, if there is a fit, you will receive an email with a link to schedule an interview.
                    </p>
                    <Button 
                        onClick={() => navigate('/global-partner')} 
                        className="bg-gradient-to-b from-gold-dark via-gold-medium to-gold-dark text-black font-bold hover:opacity-90 transition-opacity border border-gold-medium/50"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to MIGMA homepage
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
};

