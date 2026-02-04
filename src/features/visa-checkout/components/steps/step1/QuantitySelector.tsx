import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { VisaProduct } from '@/types/visa-product';

interface QuantitySelectorProps {
    product: VisaProduct;
    extraUnits: number;
    dependentNames: string[];
    onExtraUnitsChange: (val: number) => void;
    onDependentNamesChange: (val: string[]) => void;
    fieldErrors?: Record<string, string>;
}

export const QuantitySelector: React.FC<QuantitySelectorProps> = ({
    product,
    extraUnits,
    dependentNames,
    onExtraUnitsChange,
    onDependentNamesChange,
    fieldErrors,
}) => {
    if (!product.allow_extra_units) return null;

    const handleUnitsChange = (val: string) => {
        const num = parseInt(val);
        onExtraUnitsChange(num);

        const isUnitsOnly = product.calculation_type === 'units_only';
        const requiredNamesCount = isUnitsOnly ? (num > 0 ? num - 1 : 0) : num;

        const newNames = [...dependentNames];
        if (requiredNamesCount < newNames.length) {
            onDependentNamesChange(newNames.slice(0, requiredNamesCount));
        } else {
            while (newNames.length < requiredNamesCount) {
                newNames.push('');
            }
            onDependentNamesChange(newNames);
        }
    };

    const handleNameChange = (index: number, value: string) => {
        const newNames = [...dependentNames];
        newNames[index] = value;
        onDependentNamesChange(newNames);
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="extra-units" className="text-white text-sm sm:text-base flex items-center">
                    {product.calculation_type === 'units_only'
                        ? (product.slug === 'rfe-defense' ? 'Number of evidences' : 'Number of applicants')
                        : product.extra_unit_label + ' (0-5)'}
                    <span className="text-red-500 ml-1 font-bold">*</span>
                </Label>
                <Select
                    value={String(extraUnits)}
                    onValueChange={handleUnitsChange}
                >
                    <SelectTrigger className="bg-white text-black min-h-[44px]">
                        <SelectValue placeholder="0" />
                    </SelectTrigger>
                    <SelectContent>
                        {(product.calculation_type === 'units_only' ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5]).map(n => (
                            <SelectItem key={n} value={String(n)}>
                                {String(n)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {fieldErrors?.extraUnits && (
                    <p className="text-red-400 text-xs mt-1 animate-in fade-in slide-in-from-top-1">{fieldErrors.extraUnits}</p>
                )}
            </div>

            {dependentNames.map((name, i) => (
                <div key={i} className="space-y-2">
                    <Label className="text-white text-sm sm:text-base flex items-center">
                        {product.slug === 'rfe-defense'
                            ? `Evidence ${i + 1} description`
                            : (product.calculation_type === 'units_only' ? 'Applicant Name' : 'Dependent Name')} {i + 1}
                        <span className="text-red-500 ml-1 font-bold">*</span>
                    </Label>
                    <Input
                        value={name}
                        onChange={(e) => handleNameChange(i, e.target.value)}
                        className="bg-white text-black min-h-[44px]"
                        placeholder="Full name"
                    />
                </div>
            ))}
        </div>
    );
};
