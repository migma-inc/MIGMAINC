import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { countries } from '@/lib/visa-checkout-constants';

interface Step2AddressDetailsProps {
    addressStreet: string;
    setAddressStreet: (value: string) => void;
    addressCity: string;
    setAddressCity: (value: string) => void;
    addressState: string;
    setAddressState: (value: string) => void;
    addressZip: string;
    setAddressZip: (value: string) => void;
    addressCountry: string;
    setAddressCountry: (value: string) => void;
    formErrors: Record<string, string>;
}

export const Step2AddressDetails = ({
    addressStreet,
    setAddressStreet,
    addressCity,
    setAddressCity,
    addressState,
    setAddressState,
    addressZip,
    setAddressZip,
    addressCountry,
    setAddressCountry,
    formErrors,
}: Step2AddressDetailsProps) => {
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="address-street" className="text-white">
                    Street Address <span className="text-red-500">*</span>
                </Label>
                <Input
                    id="address-street"
                    type="text"
                    value={addressStreet}
                    onChange={(e) => setAddressStreet(e.target.value)}
                    className="bg-white text-black"
                    placeholder="Street name and number"
                />
                {formErrors.addressStreet && (
                    <p className="text-sm text-red-400">{formErrors.addressStreet}</p>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="address-city" className="text-white">
                        City <span className="text-red-500">*</span>
                    </Label>
                    <Input
                        id="address-city"
                        type="text"
                        value={addressCity}
                        onChange={(e) => {
                            const value = e.target.value;
                            // Only allow letters, spaces, and common punctuation
                            if (value === '' || /^[a-zA-ZÀ-ÿ\s\-\.,']*$/.test(value)) {
                                setAddressCity(value);
                            }
                        }}
                        className="bg-white text-black"
                        placeholder="City name"
                    />
                    {formErrors.addressCity && (
                        <p className="text-sm text-red-400">{formErrors.addressCity}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="address-state" className="text-white">
                        State / Province
                    </Label>
                    <Input
                        id="address-state"
                        type="text"
                        value={addressState}
                        onChange={(e) => {
                            const value = e.target.value;
                            // Only allow letters, spaces, and common punctuation
                            if (value === '' || /^[a-zA-ZÀ-ÿ\s\-\.,']*$/.test(value)) {
                                setAddressState(value);
                            }
                        }}
                        className="bg-white text-black"
                        placeholder="State or Province"
                    />
                    {formErrors.addressState && (
                        <p className="text-sm text-red-400">{formErrors.addressState}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="address-zip" className="text-white">
                        ZIP / Postal Code
                    </Label>
                    <Input
                        id="address-zip"
                        type="text"
                        value={addressZip}
                        onChange={(e) => setAddressZip(e.target.value)}
                        className="bg-white text-black"
                        placeholder="12345-678"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="address-country" className="text-white">
                        Country <span className="text-red-500">*</span>
                    </Label>
                    <Select value={addressCountry} onValueChange={setAddressCountry}>
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
                    {formErrors.addressCountry && (
                        <p className="text-sm text-red-400">{formErrors.addressCountry}</p>
                    )}
                </div>
            </div>
        </div>
    );
};
