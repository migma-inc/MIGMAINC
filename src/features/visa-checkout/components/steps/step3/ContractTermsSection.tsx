import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ANNEX_I_HTML } from '@/lib/annex-text';
import type { ContractTemplate } from '@/lib/contract-templates';

interface ContractTermsSectionProps {
    termsAccepted: boolean;
    dataAuthorization: boolean;
    contractTemplate: ContractTemplate | null;
    chargebackAnnexTemplate: ContractTemplate | null;
    onTermsChange: (val: boolean) => void;
    onDataAuthChange: (val: boolean) => void;
}

export const ContractTermsSection: React.FC<ContractTermsSectionProps> = ({
    termsAccepted,
    dataAuthorization,
    contractTemplate,
    chargebackAnnexTemplate,
    onTermsChange,
    onDataAuthChange,
}) => {
    return (
        <div className="space-y-6">
            {contractTemplate && (
                <div className="p-3 sm:p-4 bg-blue-900/20 border border-blue-500/30 rounded-md">
                    <h3 className="text-white font-semibold mb-2 text-sm">{contractTemplate.name}</h3>
                    <div
                        className="text-xs text-gray-300 max-h-48 overflow-y-auto prose prose-invert custom-scrollbar"
                        dangerouslySetInnerHTML={{ __html: contractTemplate.content }}
                    />
                </div>
            )}

            <div className="p-3 sm:p-4 bg-blue-900/20 border border-blue-500/30 rounded-md">
                <h3 className="text-white font-semibold mb-2 text-sm">ANNEX I - Payment Authorization</h3>
                <div
                    className="text-xs text-gray-300 max-h-48 overflow-y-auto prose prose-invert custom-scrollbar"
                    dangerouslySetInnerHTML={{ __html: chargebackAnnexTemplate?.content || ANNEX_I_HTML }}
                />
            </div>

            <div className="space-y-4">
                <div className="flex items-start space-x-2">
                    <Checkbox
                        id="terms"
                        checked={termsAccepted}
                        onCheckedChange={(c) => onTermsChange(c === true)}
                    />
                    <Label htmlFor="terms" className="text-white text-sm cursor-pointer select-none">
                        I declare that I have read and agree to all the terms and conditions set forth in this agreement and its Annex I. *
                    </Label>
                </div>
                <div className="flex items-start space-x-2">
                    <Checkbox
                        id="data-auth"
                        checked={dataAuthorization}
                        onCheckedChange={(c) => onDataAuthChange(c === true)}
                    />
                    <Label htmlFor="data-auth" className="text-white text-sm cursor-pointer select-none">
                        I authorize the use and processing of my personal data for the specific purposes of this contract. *
                    </Label>
                </div>
            </div>
        </div>
    );
};
