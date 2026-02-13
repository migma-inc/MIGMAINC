import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getTodayLocalDate } from '@/lib/utils';
import { countries } from '@/lib/visa-checkout-constants';

interface Step1PersonalDetailsProps {
    fullLegalName: string;
    setFullLegalName: (value: string) => void;
    dateOfBirth: string;
    setDateOfBirth: (value: string) => void;
    nationality: string;
    setNationality: (value: string) => void;
    countryOfResidence: string;
    setCountryOfResidence: (value: string) => void;
    phoneWhatsapp: string;
    setPhoneWhatsapp: (value: string) => void;
    email: string;
    setEmail: (value: string) => void;
    formErrors: Record<string, string>;
}

export const Step1PersonalDetails = ({
    fullLegalName,
    setFullLegalName,
    dateOfBirth,
    setDateOfBirth,
    nationality,
    setNationality,
    countryOfResidence,
    setCountryOfResidence,
    phoneWhatsapp,
    setPhoneWhatsapp,
    email,
    setEmail,
    formErrors,
}: Step1PersonalDetailsProps) => {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="full-legal-name" className="text-white">
                        Full Legal Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                        id="full-legal-name"
                        type="text"
                        value={fullLegalName}
                        onChange={(e) => setFullLegalName(e.target.value)}
                        className="bg-white text-black"
                        placeholder="Enter your full legal name"
                    />
                    {formErrors.fullLegalName && (
                        <p className="text-sm text-red-400">{formErrors.fullLegalName}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="date-of-birth" className="text-white">
                        Date of Birth <span className="text-red-500">*</span>
                    </Label>
                    <Input
                        id="date-of-birth"
                        type="date"
                        value={dateOfBirth}
                        onChange={(e) => setDateOfBirth(e.target.value)}
                        className="bg-white text-black"
                        max={getTodayLocalDate()}
                    />
                    {formErrors.dateOfBirth && (
                        <p className="text-sm text-red-400">{formErrors.dateOfBirth}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="nationality" className="text-white">
                        Nationality <span className="text-red-500">*</span>
                    </Label>
                    <Select value={nationality} onValueChange={setNationality}>
                        <SelectTrigger className="bg-white text-black">
                            <SelectValue placeholder="Select nationality" />
                        </SelectTrigger>
                        <SelectContent>
                            {countries.map((country) => (
                                <SelectItem key={country} value={country}>
                                    {country}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {formErrors.nationality && (
                        <p className="text-sm text-red-400">{formErrors.nationality}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="country-of-residence" className="text-white">
                        Country of Residence <span className="text-red-500">*</span>
                    </Label>
                    <Select value={countryOfResidence} onValueChange={setCountryOfResidence}>
                        <SelectTrigger className="bg-white text-black">
                            <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                        <SelectContent>
                            {countries.map((country) => (
                                <SelectItem key={country} value={country}>
                                    {country}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {formErrors.countryOfResidence && (
                        <p className="text-sm text-red-400">{formErrors.countryOfResidence}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="phone-whatsapp" className="text-white">
                        Phone / WhatsApp <span className="text-red-500">*</span>
                    </Label>
                    <Input
                        id="phone-whatsapp"
                        type="tel"
                        value={phoneWhatsapp}
                        onChange={(e) => setPhoneWhatsapp(e.target.value)}
                        className="bg-white text-black"
                        placeholder="+55 11 99999-9999"
                    />
                    {formErrors.phoneWhatsapp && (
                        <p className="text-sm text-red-400">{formErrors.phoneWhatsapp}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="email" className="text-white">
                        Email <span className="text-red-500">*</span>
                    </Label>
                    <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="bg-white text-black"
                        placeholder="your.email@example.com"
                    />
                    {formErrors.email && (
                        <p className="text-sm text-red-400">{formErrors.email}</p>
                    )}
                </div>
            </div>
        </div>
    );
};
