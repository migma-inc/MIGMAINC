import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const BookACallThankYou = () => {
    return (
        <div className="min-h-screen bg-gradient-to-b from-black via-[#1a1a1a] to-black font-sans text-foreground">
            <Header />
            
            <div className="pt-[120px] pb-24 flex items-center justify-center px-4">
                <Card className="max-w-2xl w-full border-gold-medium/30 shadow-2xl bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 backdrop-blur-sm">
                    <CardContent className="p-8 sm:p-12 text-center">
                        <div className="w-16 h-16 bg-green-900/30 border-2 border-green-500/50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Check className="w-8 h-8 text-green-300" />
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold mb-4 migma-gold-text">
                            Thank you for reaching out
                        </h1>
                        <p className="text-lg text-gray-300 mb-8 leading-relaxed">
                            We've received your information. Our team will review your details and contact you to schedule a call and understand how MIGMA can plug into your operation.
                        </p>
                        <Link to="/">
                            <Button className="bg-black border-2 border-gold-medium/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium">
                                Back to homepage
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>

            <Footer />
        </div>
    );
};

