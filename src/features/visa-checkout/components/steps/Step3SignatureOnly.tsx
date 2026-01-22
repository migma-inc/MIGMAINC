import React from 'react';
import type { VisaCheckoutState, VisaCheckoutActions } from '../../types/form.types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ContractTermsSection } from './step3/ContractTermsSection';
import { SignatureSection } from './step3/SignatureSection';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';

interface Step3SignatureOnlyProps {
    state: VisaCheckoutState;
    actions: VisaCheckoutActions;
    onPrev: () => void;
    onFinalize: () => Promise<void>;
}

export const Step3SignatureOnly: React.FC<Step3SignatureOnlyProps> = ({ state, actions, onPrev, onFinalize }) => {
    const {
        termsAccepted, dataAuthorization, contractTemplate, chargebackAnnexTemplate,
        signatureImageDataUrl, signatureConfirmed, submitting
    } = state;

    const {
        setTermsAccepted, setDataAuthorization
    } = actions;

    return (
        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardHeader>
                <CardTitle className="text-white text-lg sm:text-xl">Step 3: Contract Signature</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <ContractTermsSection
                    termsAccepted={termsAccepted}
                    dataAuthorization={dataAuthorization}
                    contractTemplate={contractTemplate}
                    chargebackAnnexTemplate={chargebackAnnexTemplate}
                    onTermsChange={setTermsAccepted}
                    onDataAuthChange={setDataAuthorization}
                />

                {termsAccepted && (
                    <SignatureSection
                        signatureImageDataUrl={signatureImageDataUrl}
                        signatureConfirmed={signatureConfirmed}
                        onSignatureConfirm={(url) => {
                            actions.setSignatureImageDataUrl(url);
                            actions.setSignatureConfirmed(true);
                        }}
                        onSignatureChange={(url) => {
                            actions.setSignatureImageDataUrl(url);
                        }}
                        onEdit={() => actions.setSignatureConfirmed(false)}
                    />
                )}

                <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-white/10">
                    <button
                        onClick={onPrev}
                        disabled={submitting}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gold-light border border-gold-medium/50 bg-black/50 rounded-md hover:bg-gold-medium/30 hover:text-gold-light transition-colors disabled:opacity-50"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m15 18-6-6 6-6" />
                        </svg>
                        Back
                    </button>

                    <Button
                        onClick={onFinalize}
                        disabled={!signatureConfirmed || !termsAccepted || submitting}
                        className="flex-1 bg-gold-medium text-black font-bold hover:bg-gold-light transition-colors"
                    >
                        {submitting ? (
                            <span className="flex items-center gap-2">
                                <svg className="animate-spin h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processing...
                            </span>
                        ) : (
                            <span className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4" />
                                Finalize & Sign Contract
                            </span>
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};
