import React from 'react';
// Force HMR update
import { Card } from '@/components/ui/card';
import { Check, Crown, Rocket, Star } from 'lucide-react';


interface UpsellSelectionProps {
    selectedUpsell: 'none' | 'canada-premium' | 'canada-revolution';
    onSelect: (val: 'none' | 'canada-premium' | 'canada-revolution') => void;
    extraUnits?: number;
}

export const UpsellSelection: React.FC<UpsellSelectionProps> = ({ selectedUpsell, onSelect, extraUnits = 0 }) => {
    // Canada Premium Pricing
    const premiumOfferBase = 399;
    const premiumOfferDep = 50;
    const premiumOfferTotal = premiumOfferBase + (extraUnits * premiumOfferDep);

    // Canada Revolution Pricing
    const revolutionOfferBase = 199;
    const revolutionOfferDep = 50;
    const revolutionOfferTotal = revolutionOfferBase + (extraUnits * revolutionOfferDep);



    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-2 mb-2">
                <Star className="w-5 h-5 text-gold-medium fill-gold-medium" />
                <h3 className="text-xl font-bold migma-gold-text">World Cup Bundle Exclusive Offer</h3>
            </div>

            <p className="text-gray-400 text-sm mb-4">
                Since you are applying for a U.S. Visa, why not secure your Canada Visa at the same time?
                Choose one of our special bundles below:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Canada Premium Upsell */}
                <Card
                    className={`cursor-pointer transition-all duration-300 border-2 overflow-hidden ${selectedUpsell === 'canada-premium'
                        ? 'border-gold-medium bg-gold-medium/10 ring-2 ring-gold-medium/20 shadow-[0_0_20px_rgba(212,175,55,0.2)]'
                        : 'border-white/10 bg-black/40 hover:border-gold-medium/40'
                        }`}
                    onClick={() => onSelect(selectedUpsell === 'canada-premium' ? 'none' : 'canada-premium')}
                >
                    <div className="p-4 relative">
                        {selectedUpsell === 'canada-premium' && (
                            <div className="absolute top-2 right-2 bg-gold-medium rounded-full p-1">
                                <Check className="w-3 h-3 text-black" />
                            </div>
                        )}
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-gold-medium/20 rounded-lg">
                                <Crown className="w-6 h-6 text-gold-light" />
                            </div>
                            <div>
                                <h4 className="font-bold text-white text-lg mb-2">Canada Premium</h4>

                                <div className="space-y-1 mb-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Main applicant:</span>
                                        <span className="text-gray-200">${premiumOfferBase}</span>
                                    </div>
                                    {extraUnits > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">Dependents ({extraUnits}x $50):</span>
                                            <span className="text-gray-200">+${extraUnits * 50}</span>
                                        </div>
                                    )}
                                    <div className="h-px bg-white/10 my-1" />
                                    <div className="flex justify-between text-base font-bold">
                                        <span className="text-gold-light">Total:</span>
                                        <span className="text-gold-light">${premiumOfferTotal}</span>
                                    </div>
                                </div>

                                <p className="text-xs text-gray-400 mt-2">2 visas process with <strong>same time</strong></p>
                            </div>
                        </div>
                        <ul className="mt-4 space-y-2">
                            <li className="flex items-center gap-2 text-xs text-gray-300">
                                <Check className="w-3 h-3 text-green-500" /> Complete Documentation
                            </li>
                            <li className="flex items-center gap-2 text-xs text-gray-300">
                                <Check className="w-3 h-3 text-green-500" /> Specialist Review
                            </li>
                        </ul>
                    </div>
                </Card>

                {/* Canada Revolution Upsell */}
                <Card
                    className={`cursor-pointer transition-all duration-300 border-2 overflow-hidden ${selectedUpsell === 'canada-revolution'
                        ? 'border-gold-medium bg-gold-medium/10 ring-2 ring-gold-medium/20 shadow-[0_0_20px_rgba(212,175,55,0.2)]'
                        : 'border-white/10 bg-black/40 hover:border-gold-medium/40'
                        }`}
                    onClick={() => onSelect(selectedUpsell === 'canada-revolution' ? 'none' : 'canada-revolution')}
                >
                    <div className="p-4 relative">
                        {selectedUpsell === 'canada-revolution' && (
                            <div className="absolute top-2 right-2 bg-gold-medium rounded-full p-1">
                                <Check className="w-3 h-3 text-black" />
                            </div>
                        )}
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-blue-500/20 rounded-lg">
                                <Rocket className="w-6 h-6 text-blue-400" />
                            </div>
                            <div>
                                <h4 className="font-bold text-white text-lg mb-2">Canada Revolution</h4>

                                <div className="space-y-1 mb-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Main applicant:</span>
                                        <span className="text-gray-200">${revolutionOfferBase}</span>
                                    </div>
                                    {extraUnits > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">Dependents ({extraUnits}x $50):</span>
                                            <span className="text-gray-200">+${extraUnits * 50}</span>
                                        </div>
                                    )}
                                    <div className="h-px bg-white/10 my-1" />
                                    <div className="flex justify-between text-base font-bold">
                                        <span className="text-gold-light">Total:</span>
                                        <span className="text-gold-light">${revolutionOfferTotal}</span>
                                    </div>
                                </div>

                                <p className="text-xs text-gray-400 mt-2">2 visas process with <strong>different time</strong></p>
                            </div>
                        </div>
                        <ul className="mt-4 space-y-2">
                            <li className="flex items-center gap-2 text-xs text-gray-300">
                                <Check className="w-3 h-3 text-green-500" /> Fast Track Processing
                            </li>
                            <li className="flex items-center gap-2 text-xs text-gray-300">
                                <Check className="w-3 h-3 text-green-500" /> Electronic Authorization
                            </li>
                        </ul>
                    </div>
                </Card>
            </div>

            <div className="flex justify-center mt-4">
                <button
                    onClick={() => onSelect('none')}
                    className={`text-sm px-4 py-2 rounded-full transition-all duration-300 ${selectedUpsell === 'none'
                        ? 'bg-white/10 text-gray-300 cursor-default'
                        : 'bg-transparent text-gray-400 hover:text-white hover:bg-white/5 underline decoration-gray-600 hover:decoration-white'
                        }`}
                >
                    {selectedUpsell === 'none' ? 'No bundle selected' : 'No thanks, I don\'t want to add Canada Visa'}
                </button>
            </div>
        </div>
    );
};
