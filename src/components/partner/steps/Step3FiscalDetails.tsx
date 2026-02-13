import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Step3FiscalDetailsProps {
    businessType: 'Individual' | 'Company' | '';
    setBusinessType: (value: 'Individual' | 'Company') => void;
    companyLegalName: string;
    setCompanyLegalName: (value: string) => void;
    taxIdType: string;
    setTaxIdType: (value: string) => void;
    taxIdNumber: string;
    setTaxIdNumber: (value: string) => void;
    formErrors: Record<string, string>;
}

export const Step3FiscalDetails = ({
    businessType,
    setBusinessType,
    companyLegalName,
    setCompanyLegalName,
    taxIdType,
    setTaxIdType,
    taxIdNumber,
    setTaxIdNumber,
    formErrors,
}: Step3FiscalDetailsProps) => {
    return (
        <div className="space-y-4">
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="business-type" className="text-white">
                        Business Type <span className="text-red-500">*</span>
                    </Label>
                    <Select value={businessType} onValueChange={(value) => setBusinessType(value as 'Individual' | 'Company')}>
                        <SelectTrigger className="bg-white text-black">
                            <SelectValue placeholder="Select business type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Individual">Individual</SelectItem>
                            <SelectItem value="Company">Company</SelectItem>
                        </SelectContent>
                    </Select>
                    {formErrors.businessType && (
                        <p className="text-sm text-red-400">{formErrors.businessType}</p>
                    )}
                </div>

                {businessType === 'Company' && (
                    <div className="space-y-2">
                        <Label htmlFor="company-legal-name" className="text-white">
                            Company Legal Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="company-legal-name"
                            type="text"
                            value={companyLegalName}
                            onChange={(e) => setCompanyLegalName(e.target.value)}
                            className="bg-white text-black"
                            placeholder="Company registered name"
                        />
                        {formErrors.companyLegalName && (
                            <p className="text-sm text-red-400">{formErrors.companyLegalName}</p>
                        )}
                    </div>
                )}

                <div className="space-y-2">
                    <Label htmlFor="tax-id-type" className="text-white">
                        Tax ID Type <span className="text-red-500">*</span>
                    </Label>
                    <Select value={taxIdType} onValueChange={setTaxIdType}>
                        <SelectTrigger className="bg-white text-black">
                            <SelectValue placeholder="Select tax ID type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="CNPJ">CNPJ (Brazil)</SelectItem>
                            <SelectItem value="NIF">NIF (Portugal/Spain)</SelectItem>
                            <SelectItem value="Equivalent">Equivalent</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                    </Select>
                    {formErrors.taxIdType && (
                        <p className="text-sm text-red-400">{formErrors.taxIdType}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="tax-id-number" className="text-white">
                        Tax ID Number <span className="text-red-500">*</span>
                    </Label>
                    <Input
                        id="tax-id-number"
                        type="text"
                        value={taxIdNumber}
                        onChange={(e) => setTaxIdNumber(e.target.value)}
                        className="bg-white text-black"
                        placeholder="Enter tax ID number"
                    />
                    {formErrors.taxIdNumber && (
                        <p className="text-sm text-red-400">{formErrors.taxIdNumber}</p>
                    )}
                </div>
            </div>
        </div>
    );
};
