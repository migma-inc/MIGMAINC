import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { countries } from '@/lib/visa-checkout-constants';

interface LegalAddressFieldsProps {
    documentType: 'passport' | 'id' | 'driver_license' | '';
    documentNumber: string;
    addressLine: string;
    city: string;
    state: string;
    postalCode: string;
    clientCountry: string;
    clientNationality: string;
    clientWhatsApp: string;
    maritalStatus: 'single' | 'married' | 'divorced' | 'widowed' | 'other' | '';
    fieldErrors: Record<string, string>;
    onDocumentTypeChange: (val: 'passport' | 'id' | 'driver_license' | '') => void;
    onDocumentNumberChange: (val: string) => void;
    onAddressLineChange: (val: string) => void;
    onCityChange: (val: string) => void;
    onStateChange: (val: string) => void;
    onPostalCodeChange: (val: string) => void;
    onCountryChange: (val: string) => void;
    onNationalityChange: (val: string) => void;
    onClientWhatsAppChange: (val: string) => void;
    onMaritalStatusChange: (val: 'single' | 'married' | 'divorced' | 'widowed' | 'other' | '') => void;
    isSimplified?: boolean;
}

export const LegalAddressFields: React.FC<LegalAddressFieldsProps> = ({
    documentType,
    documentNumber,
    addressLine,
    city,
    state,
    postalCode,
    clientCountry,
    clientNationality,
    clientWhatsApp,
    maritalStatus,
    fieldErrors,
    onDocumentTypeChange,
    onDocumentNumberChange,
    onAddressLineChange,
    onCityChange,
    onStateChange,
    onPostalCodeChange,
    onCountryChange,
    onNationalityChange,
    onClientWhatsAppChange,
    onMaritalStatusChange,
    isSimplified = false,
}) => {
    return (
        <div className="space-y-4">
            {/* 1. Document Type & Number */}
            {!isSimplified && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="doc-type" className="text-white text-sm sm:text-base">Document Type *</Label>
                        <Select value={documentType} onValueChange={(val: any) => onDocumentTypeChange(val)}>
                            <SelectTrigger className="bg-white text-black min-h-[44px]">
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="passport">Passport</SelectItem>
                                <SelectItem value="id">ID Card</SelectItem>
                                <SelectItem value="driver_license">Driver's License</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="doc-number" className="text-white text-sm sm:text-base">Document Number *</Label>
                        <Input
                            id="doc-number"
                            value={documentNumber}
                            onChange={(e) => onDocumentNumberChange(e.target.value)}
                            className="bg-white text-black min-h-[44px]"
                            placeholder="Number"
                        />
                        {fieldErrors.documentNumber && <p className="text-red-400 text-xs mt-1">{fieldErrors.documentNumber}</p>}
                    </div>
                </div>
            )}

            {/* 2. Address Line */}
            {!isSimplified && (
                <div className="space-y-2">
                    <Label htmlFor="address" className="text-white text-sm sm:text-base">Address Line *</Label>
                    <Input
                        id="address"
                        value={addressLine}
                        onChange={(e) => onAddressLineChange(e.target.value)}
                        className="bg-white text-black min-h-[44px]"
                        placeholder="Street name and number"
                    />
                    {fieldErrors.addressLine && <p className="text-red-400 text-xs mt-1">{fieldErrors.addressLine}</p>}
                </div>
            )}

            {/* 3. City, State, Postal Code */}
            {!isSimplified && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="city" className="text-white text-sm sm:text-base">City *</Label>
                        <Input
                            id="city"
                            value={city}
                            onChange={(e) => onCityChange(e.target.value)}
                            className="bg-white text-black min-h-[44px]"
                        />
                        {fieldErrors.city && <p className="text-red-400 text-xs mt-1">{fieldErrors.city}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="state" className="text-white text-sm sm:text-base">State/Province *</Label>
                        <Input
                            id="state"
                            value={state}
                            onChange={(e) => onStateChange(e.target.value)}
                            className="bg-white text-black min-h-[44px]"
                        />
                        {fieldErrors.state && <p className="text-red-400 text-xs mt-1">{fieldErrors.state}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="zip" className="text-white text-sm sm:text-base">Postal Code *</Label>
                        <Input
                            id="zip"
                            value={postalCode}
                            onChange={(e) => onPostalCodeChange(e.target.value)}
                            className="bg-white text-black min-h-[44px]"
                        />
                        {fieldErrors.postalCode && <p className="text-red-400 text-xs mt-1">{fieldErrors.postalCode}</p>}
                    </div>
                </div>
            )}

            {/* 4. Country of Residence & Nationality */}
            {!isSimplified && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="country" className="text-white text-sm sm:text-base">Country of Residence *</Label>
                        <Select value={clientCountry} onValueChange={onCountryChange}>
                            <SelectTrigger className="bg-white text-black min-h-[44px]">
                                <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                            <SelectContent>
                                {countries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="nationality" className="text-white text-sm sm:text-base">Nationality *</Label>
                        <Select value={clientNationality} onValueChange={onNationalityChange}>
                            <SelectTrigger className="bg-white text-black min-h-[44px]">
                                <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                            <SelectContent>
                                {countries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            )}

            {/* 5. WhatsApp & Marital Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="whatsapp" className="text-white text-sm sm:text-base">WhatsApp (with country code) *</Label>
                    <Input
                        id="whatsapp"
                        value={clientWhatsApp}
                        onChange={(e) => onClientWhatsAppChange(e.target.value)}
                        className="bg-white text-black min-h-[44px]"
                        placeholder="+55 11 99999-9999"
                    />
                    {fieldErrors.clientWhatsApp && <p className="text-red-400 text-xs mt-1">{fieldErrors.clientWhatsApp}</p>}
                </div>
                {!isSimplified && (
                    <div className="space-y-2">
                        <Label htmlFor="marital-status" className="text-white text-sm sm:text-base">Marital Status *</Label>
                        <Select value={maritalStatus} onValueChange={(val: any) => onMaritalStatusChange(val)}>
                            <SelectTrigger className="bg-white text-black min-h-[44px]">
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="single">Single</SelectItem>
                                <SelectItem value="married">Married</SelectItem>
                                <SelectItem value="divorced">Divorced</SelectItem>
                                <SelectItem value="widowed">Widowed</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>
        </div>
    );
};
