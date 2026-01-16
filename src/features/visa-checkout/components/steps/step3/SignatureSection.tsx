import React from 'react';
import { SignaturePadComponent } from '@/components/ui/signature-pad';

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
    return (
        <div className="pt-4 border-t border-gold-medium/30">
            <SignaturePadComponent
                onSignatureConfirm={onSignatureConfirm}
                onSignatureChange={onSignatureChange}
                savedSignature={signatureImageDataUrl}
                isConfirmed={signatureConfirmed}
                label="Digital Signature *"
                onEdit={onEdit}
            />
        </div>
    );
};
