import React from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FileText, ArrowRight } from 'lucide-react';

interface ExistingContractBannerProps {
    clientName: string;
    onContinue: () => void;
}

export const ExistingContractBanner: React.FC<ExistingContractBannerProps> = ({ clientName, onContinue }) => {
    return (
        <Alert className="bg-gold-light/20 border-gold-medium text-white">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gold-medium/20 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-gold-medium" />
                    </div>
                    <div>
                        <AlertTitle className="text-gold-light font-bold">Existing Contract Found</AlertTitle>
                        <AlertDescription className="text-gray-300">
                            We found an active contract for <span className="text-white font-medium">{clientName}</span>.
                            You can skip document upload.
                        </AlertDescription>
                    </div>
                </div>
                <Button
                    onClick={onContinue}
                    className="bg-gold-medium text-black hover:bg-gold-light font-bold whitespace-nowrap"
                >
                    Continue to Payment <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </div>
        </Alert>
    );
};
