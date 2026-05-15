import React from 'react';
import { SignaturePadComponent } from '@/components/ui/signature-pad';
import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SignatureSectionProps {
    signatureImageDataUrl: string | null;
    signatureConfirmed: boolean;
    onSignatureConfirm: (url: string) => void;
    onSignatureChange: (url: string | null) => void;
    onEdit?: () => void;
}

export const SignatureSection: React.FC<SignatureSectionProps> = ({
    signatureImageDataUrl,
    signatureConfirmed,
    onSignatureConfirm,
    onSignatureChange,
    onEdit
}) => {
    const { t } = useTranslation();
    const isSignaturePendingConfirmation = Boolean(signatureImageDataUrl && !signatureConfirmed);

    return (
        <div className="pt-4 border-t border-gold-medium/30 space-y-3">
            <SignaturePadComponent
                onSignatureConfirm={onSignatureConfirm}
                onSignatureChange={onSignatureChange}
                savedSignature={signatureImageDataUrl}
                isConfirmed={signatureConfirmed}
                label="Digital Signature *"
                onEdit={onEdit}
            />
            {isSignaturePendingConfirmation && (
                <div className="flex items-start gap-3 rounded-lg border border-amber-400/60 bg-amber-400/10 px-4 py-3 text-amber-100 animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-300" />
                    <div className="space-y-1">
                        <p className="text-sm font-bold">
                            {t('checkout.signature_not_confirmed_title', 'Assinatura pendente de confirmacao')}
                        </p>
                        <p className="text-xs sm:text-sm leading-relaxed">
                            {t('checkout.signature_not_confirmed_message', 'Voce ja desenhou a assinatura, mas precisa clicar em "Pronto". Enquanto isso nao for feito, o checkout fica bloqueado.')}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
