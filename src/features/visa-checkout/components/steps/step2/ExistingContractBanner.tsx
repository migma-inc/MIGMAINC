import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FileText, ArrowRight } from 'lucide-react';

interface ExistingContractBannerProps {
    clientName: string;
    onContinue: () => void;
}

export const ExistingContractBanner: React.FC<ExistingContractBannerProps> = ({ clientName, onContinue }) => {
    const { t } = useTranslation();
    return (
        <Alert className="bg-gold-light/20 border-gold-medium text-white">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gold-medium/20 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-gold-medium" />
                    </div>
                    <div>
                        <AlertTitle className="text-gold-light font-bold">{t('checkout.existing_contract_found', 'Existing Contract Found')}</AlertTitle>
                        <AlertDescription className="text-gray-300">
                            {t('checkout.existing_contract_message', 'We found an active contract for')} <span className="text-white font-medium">{clientName}</span>.
                            {t('checkout.skip_document_upload', ' You can skip document upload.')}
                        </AlertDescription>
                    </div>
                </div>
                <Button
                    onClick={onContinue}
                    className="bg-gold-medium text-black hover:bg-gold-light font-bold whitespace-nowrap"
                >
                    {t('checkout.continue_to_payment', 'Continue to Payment')} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </div>
        </Alert>
    );
};
