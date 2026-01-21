import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface ContactFieldsProps {
    clientName: string;
    clientEmail: string;
    dateOfBirth: string;
    fieldErrors: Record<string, string>;
    onClientNameChange: (val: string) => void;
    onClientEmailChange: (val: string) => void;
    onDateOfBirthChange: (val: string) => void;
    isSimplified?: boolean;
}

export const ContactFields: React.FC<ContactFieldsProps> = ({
    clientName,
    clientEmail,
    dateOfBirth,
    fieldErrors,
    onClientNameChange,
    onClientEmailChange,
    onDateOfBirthChange,
    isSimplified = false,
}) => {
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="name" className="text-white text-sm sm:text-base">Full Name *</Label>
                <Input
                    id="name"
                    value={clientName}
                    onChange={(e) => onClientNameChange(e.target.value)}
                    className="bg-white text-black min-h-[44px]"
                />
                {fieldErrors.clientName && <p className="text-red-400 text-xs mt-1">{fieldErrors.clientName}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="email" className="text-white text-sm sm:text-base">Email *</Label>
                <Input
                    id="email"
                    type="email"
                    value={clientEmail}
                    onChange={(e) => onClientEmailChange(e.target.value.replace(/\s/g, ''))}
                    className="bg-white text-black min-h-[44px]"
                />
                {fieldErrors.clientEmail && <p className="text-red-400 text-xs mt-1">{fieldErrors.clientEmail}</p>}
            </div>

            {!isSimplified && (
                <div className="space-y-2">
                    <Label htmlFor="dob" className="text-white text-sm sm:text-base">Date of Birth *</Label>
                    <Input
                        id="dob"
                        type="date"
                        value={dateOfBirth}
                        onChange={(e) => onDateOfBirthChange(e.target.value)}
                        className="bg-white text-black min-h-[44px]"
                    />
                    {fieldErrors.dateOfBirth && <p className="text-red-400 text-xs mt-1">{fieldErrors.dateOfBirth}</p>}
                </div>
            )}
        </div>
    );
};
