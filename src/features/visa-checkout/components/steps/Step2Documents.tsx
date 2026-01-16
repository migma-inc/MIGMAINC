import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { DocumentUpload } from '@/components/checkout/DocumentUpload';
import type { VisaCheckoutState, VisaCheckoutActions } from '../../types/form.types';
import { ExistingContractBanner } from './step2/ExistingContractBanner';

interface Step2Props {
    state: VisaCheckoutState;
    actions: VisaCheckoutActions;
    onNext: () => Promise<void | boolean>;
    onPrev: () => void;
}

export const Step2Documents: React.FC<Step2Props> = ({ state, actions, onNext, onPrev }) => {
    const {
        hasExistingContract, existingContractData,
        documentsUploaded, step2Errors
    } = state;
    const { setDocumentFiles, setDocumentsUploaded, setStep2Errors } = actions;

    return (
        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardHeader>
                <CardTitle className="text-white text-lg sm:text-xl">Step 2: Documentation</CardTitle>
            </CardHeader>
            <CardContent>
                {hasExistingContract && existingContractData ? (
                    <div className="space-y-6">
                        <ExistingContractBanner
                            clientName={state.clientName}
                            onContinue={onNext}
                        />
                        <div className="flex pt-4">
                            <Button
                                variant="outline"
                                onClick={onPrev}
                                className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-gold-medium/30 hover:text-gold-light w-full sm:w-auto"
                            >
                                <ChevronLeft className="w-4 h-4 mr-2" />
                                Back
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div data-document-upload>
                            <DocumentUpload
                                onComplete={(files) => {
                                    setDocumentFiles(files);
                                    setDocumentsUploaded(true);
                                    setStep2Errors({});
                                }}
                                onCancel={onPrev}
                            />
                            {(step2Errors.documentFront || step2Errors.documentBack || step2Errors.selfie || step2Errors.documents) && (
                                <div className="mt-4 space-y-2">
                                    {Object.entries(step2Errors).map(([key, msg]) => (
                                        <p key={key} className="text-red-400 text-xs break-words">• {msg}</p>
                                    ))}
                                </div>
                            )}
                        </div>
                        {documentsUploaded && (
                            <div className="mt-4 flex flex-col sm:flex-row justify-between gap-2 sm:gap-0">
                                <Button
                                    variant="outline"
                                    onClick={onPrev}
                                    className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-gold-medium/30 hover:text-gold-light w-full sm:w-auto"
                                >
                                    <ChevronLeft className="w-4 h-4 mr-2" />
                                    Back
                                </Button>
                                <Button
                                    onClick={onNext}
                                    className="bg-gold-medium hover:bg-gold-light text-black w-full sm:w-auto"
                                >
                                    Continue
                                    <ChevronRight className="w-4 h-4 ml-2" />
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
};
