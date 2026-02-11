import React from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { countries, countryToIso } from '@/lib/visa-checkout-constants';
import { PhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';

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
    const { t } = useTranslation();
    return (
        <div className="space-y-4">
            {/* 1. Document Type & Number */}
            {!isSimplified && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="doc-type" className="text-white text-sm sm:text-base">{t('checkout.document_type', 'Document Type')} *</Label>
                        <Select value={documentType} onValueChange={(val: any) => onDocumentTypeChange(val)}>
                            <SelectTrigger className="bg-white text-black min-h-[44px]">
                                <SelectValue placeholder={t('checkout.select_type', 'Select type')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="passport">{t('checkout.passport', 'Passport')}</SelectItem>
                                <SelectItem value="id">{t('checkout.id_card', 'ID Card')}</SelectItem>
                                <SelectItem value="driver_license">{t('checkout.driver_license', 'Driver\'s License')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="doc-number" className="text-white text-sm sm:text-base">{t('checkout.document_number', 'Document Number')} *</Label>
                        <Input
                            id="doc-number"
                            value={documentNumber}
                            onChange={(e) => onDocumentNumberChange(e.target.value)}
                            className="bg-white text-black min-h-[44px]"
                            placeholder={t('checkout.number', 'Number')}
                        />
                        {fieldErrors.documentNumber && <p className="text-red-400 text-xs mt-1">{fieldErrors.documentNumber}</p>}
                    </div>
                </div>
            )}

            {/* 2. Address Line */}
            {!isSimplified && (
                <div className="space-y-2">
                    <Label htmlFor="address" className="text-white text-sm sm:text-base">{t('checkout.address_line', 'Address Line')} *</Label>
                    <Input
                        id="address"
                        value={addressLine}
                        onChange={(e) => onAddressLineChange(e.target.value)}
                        className="bg-white text-black min-h-[44px]"
                        placeholder={t('checkout.street_name_number', 'Street name and number')}
                    />
                    {fieldErrors.addressLine && <p className="text-red-400 text-xs mt-1">{fieldErrors.addressLine}</p>}
                </div>
            )}

            {/* 3. City, State, Postal Code */}
            {!isSimplified && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="city" className="text-white text-sm sm:text-base">{t('checkout.city', 'City')} *</Label>
                        <Input
                            id="city"
                            value={city}
                            onChange={(e) => onCityChange(e.target.value)}
                            className="bg-white text-black min-h-[44px]"
                        />
                        {fieldErrors.city && <p className="text-red-400 text-xs mt-1">{fieldErrors.city}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="state" className="text-white text-sm sm:text-base">{t('checkout.state_province', 'State/Province')} *</Label>
                        <Input
                            id="state"
                            value={state}
                            onChange={(e) => onStateChange(e.target.value)}
                            className="bg-white text-black min-h-[44px]"
                        />
                        {fieldErrors.state && <p className="text-red-400 text-xs mt-1">{fieldErrors.state}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="zip" className="text-white text-sm sm:text-base">{t('checkout.postal_code', 'Postal Code')} *</Label>
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
                        <Label htmlFor="country" className="text-white text-sm sm:text-base">{t('checkout.country_of_residence', 'Country of Residence')} *</Label>
                        <Select value={clientCountry} onValueChange={onCountryChange}>
                            <SelectTrigger className="bg-white text-black min-h-[44px]">
                                <SelectValue placeholder={t('checkout.select_country', 'Select country')} />
                            </SelectTrigger>
                            <SelectContent>
                                {countries.map(c => (
                                    <SelectItem key={c} value={c}>
                                        {t(`global_partner.countries.${c.toLowerCase().replace(/\s+/g, '_')}`, c)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="nationality" className="text-white text-sm sm:text-base">{t('checkout.nationality', 'Nationality')} *</Label>
                        <Select value={clientNationality} onValueChange={onNationalityChange}>
                            <SelectTrigger className="bg-white text-black min-h-[44px]">
                                <SelectValue placeholder={t('checkout.select_country', 'Select country')} />
                            </SelectTrigger>
                            <SelectContent>
                                {countries.map(c => (
                                    <SelectItem key={c} value={c}>
                                        {t(`global_partner.countries.${c.toLowerCase().replace(/\s+/g, '_')}`, c)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            )}

            {/* 5. WhatsApp & Marital Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="whatsapp" className="text-white text-sm sm:text-base">{t('checkout.whatsapp_with_code', 'WhatsApp (with country code)')} *</Label>
                    <PhoneInput
                        key={clientCountry}
                        defaultCountry={countryToIso[clientCountry] || 'br'}
                        value={clientWhatsApp}
                        onChange={(phone) => onClientWhatsAppChange(phone)}
                        className="w-full react-international-phone-container"
                        inputClassName="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-black ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px]"
                        countrySelectorStyleProps={{
                            buttonClassName: "bg-white border-input rounded-l-md border-r-0 min-h-[44px] px-4",
                        }}
                    />
                    {fieldErrors.clientWhatsApp && <p className="text-red-400 text-xs mt-1">{fieldErrors.clientWhatsApp}</p>}
                </div>
                {!isSimplified && (
                    <div className="space-y-2">
                        <Label htmlFor="marital-status" className="text-white text-sm sm:text-base">{t('checkout.marital_status', 'Marital Status')} *</Label>
                        <Select value={maritalStatus} onValueChange={(val: any) => onMaritalStatusChange(val)}>
                            <SelectTrigger className="bg-white text-black min-h-[44px]">
                                <SelectValue placeholder={t('checkout.select_status', 'Select status')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="single">{t('checkout.single', 'Single')}</SelectItem>
                                <SelectItem value="married">{t('checkout.married', 'Married')}</SelectItem>
                                <SelectItem value="divorced">{t('checkout.divorced', 'Divorced')}</SelectItem>
                                <SelectItem value="widowed">{t('checkout.widowed', 'Widowed')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>
        </div>
    );
};
