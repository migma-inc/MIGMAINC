import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface Step4PaymentDetailsProps {
    preferredPayoutMethod: string;
    setPreferredPayoutMethod: (value: string) => void;
    payoutDetails: string;
    setPayoutDetails: (value: string) => void;
    formErrors: Record<string, string>;
}

export const Step4PaymentDetails = ({
    preferredPayoutMethod,
    setPreferredPayoutMethod,
    payoutDetails,
    setPayoutDetails,
    formErrors,
}: Step4PaymentDetailsProps) => {
    return (
        <div className="space-y-4">
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="preferred-payout-method" className="text-white">
                        Preferred Payout Method <span className="text-red-500">*</span>
                    </Label>
                    <Select value={preferredPayoutMethod} onValueChange={setPreferredPayoutMethod}>
                        <SelectTrigger className="bg-white text-black">
                            <SelectValue placeholder="Select payout method" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Wise">Wise</SelectItem>
                            <SelectItem value="Stripe">Stripe</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                    </Select>
                    {formErrors.preferredPayoutMethod && (
                        <p className="text-sm text-red-400">{formErrors.preferredPayoutMethod}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="payout-details" className="text-white">
                        Payout Details <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                        id="payout-details"
                        value={payoutDetails}
                        onChange={(e) => setPayoutDetails(e.target.value)}
                        className="bg-white text-black min-h-[100px]"
                        placeholder="Enter your account details (account number, routing number, email, etc.)"
                    />
                    {formErrors.payoutDetails && (
                        <p className="text-sm text-red-400">{formErrors.payoutDetails}</p>
                    )}
                </div>
            </div>
        </div>
    );
};
