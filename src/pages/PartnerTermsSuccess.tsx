import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const PartnerTermsSuccess = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-b from-black via-[#1a1a1a] to-black flex items-center justify-center py-24 px-4">
            <Card className="max-w-2xl w-full border border-gold-medium/30 shadow-2xl bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 backdrop-blur-sm">
                <CardContent className="p-8 sm:p-12 text-center">
                    <div className="w-16 h-16 bg-green-600/30 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-green-500/50">
                        <Check className="w-8 h-8 text-green-300" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold mb-4 migma-gold-text">
                        Your agreement has been accepted
                    </h1>
                    <p className="text-lg text-gray-300 mb-4">
                        Your acceptance of the MIGMA Global Independent Contractor Terms & Conditions has been successfully recorded.
                    </p>
                    <p className="text-base text-gray-400 mb-8">
                        Your signed contract document is being generated. Our team will contact you with your onboarding details and next steps.
                    </p>
                    <Button 
                        onClick={() => navigate('/global-partner')}
                        className="bg-gradient-to-b from-gold-light via-gold-medium to-gold-light text-black font-bold hover:from-gold-medium hover:via-gold-light hover:to-gold-medium transition-all shadow-lg"
                    >
                        Go to MIGMA homepage
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
};

