import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, Link as LinkIcon } from 'lucide-react';
import type {
    FinancialProcessWithSteps,
    FinancialProcessStep
} from '@/types/financial-process';
import { generateStepLink, updateStepStatus } from '@/lib/financial-process';

interface FinancialProcessDetailsProps {
    process: FinancialProcessWithSteps;
    isAdmin?: boolean;
    sellerId?: string;
    onUpdate?: () => void;
}

export function FinancialProcessDetails({ process, isAdmin = false, sellerId, onUpdate }: FinancialProcessDetailsProps) {
    const [copiedStepId, setCopiedStepId] = useState<string | null>(null);
    const [loadingStepId, setLoadingStepId] = useState<string | null>(null);

    const handleGenerateLink = async (step: FinancialProcessStep) => {
        // Pass sellerId if available (for tracking commissions)
        const link = await generateStepLink(step, process.id, sellerId);
        navigator.clipboard.writeText(link);
        setCopiedStepId(step.id);
        setTimeout(() => setCopiedStepId(null), 3000);
    };

    const handleMarkPaid = async (stepId: string) => {
        if (!isAdmin) return;
        if (!confirm('Are you sure you want to manually mark this step as PAID?')) return;

        setLoadingStepId(stepId);
        const result = await updateStepStatus(stepId, 'paid');
        setLoadingStepId(null);

        if (result.success) {
            if (onUpdate) onUpdate();
        } else {
            alert('Error: ' + result.error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2 p-4 bg-zinc-800/50 rounded-lg border border-white/5">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm text-gray-400 font-bold uppercase">Client</p>
                        <p className="text-white text-lg">{process.client?.full_name}</p>
                        <p className="text-sm text-gray-500">{process.client?.email}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-gray-400 font-bold uppercase">Progress</p>
                        <div className="flex items-center gap-2 justify-end">
                            <span className="text-2xl font-bold text-white">
                                {Math.round((process.completed_steps / process.total_steps) * 100)}%
                            </span>
                            <span className="text-sm text-gray-500">
                                ({process.completed_steps}/{process.total_steps})
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                <h3 className="text-md font-semibold text-white">Process Steps</h3>
                <div className="grid grid-cols-1 gap-3">
                    {process.steps.map(step => (
                        <div
                            key={step.id}
                            className={`p-4 rounded-md border flex items-center justify-between transition-colors
                                ${step.status === 'paid'
                                    ? 'bg-green-900/10 border-green-500/30'
                                    : 'bg-zinc-900/50 border-white/5 hover:border-gold-medium/30'
                                }`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`
                                    w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                                    ${step.status === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-zinc-700 text-gray-400'}
                                `}>
                                    {step.step_number}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium text-white">{step.step_name}</p>
                                        <Badge variant="outline" className={`text-xs ${step.status === 'paid' ? 'border-green-500/30 text-green-400' : 'border-gray-700 text-gray-500'
                                            }`}>
                                            ${step.base_amount}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        {step.status === 'paid' ? (
                                            <span className="flex items-center text-xs text-green-400">
                                                <CheckCircle className="w-3 h-3 mr-1" /> Paid
                                            </span>
                                        ) : (
                                            <span className="flex items-center text-xs text-yellow-500">
                                                <Clock className="w-3 h-3 mr-1" /> Pending
                                            </span>
                                        )}
                                        {step.order_id && (
                                            <span className="text-xs text-gray-500 flex items-center border-l border-gray-700 pl-2 ml-2">
                                                Order ID: {step.order_id}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {step.status === 'pending' && (
                                    <>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 text-xs hover:bg-gold-medium/10 hover:text-gold-light"
                                            onClick={() => handleGenerateLink(step)}
                                        >
                                            {copiedStepId === step.id ? 'Copied!' : 'Copy Link'}
                                            {copiedStepId !== step.id && <LinkIcon className="w-3 h-3 ml-1" />}
                                        </Button>
                                        {isAdmin && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 w-8 px-0 hover:bg-green-500/10 hover:text-green-400"
                                                title="Mark as Paid"
                                                disabled={loadingStepId === step.id}
                                                onClick={() => handleMarkPaid(step.id)}
                                            >
                                                {loadingStepId === step.id ? (
                                                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <CheckCircle className="w-4 h-4" />
                                                )}
                                            </Button>
                                        )}
                                    </>
                                )}
                                {step.status === 'paid' && (
                                    <div className="px-3 py-1 bg-green-500/10 rounded text-xs text-green-400 font-medium">
                                        Completed
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
