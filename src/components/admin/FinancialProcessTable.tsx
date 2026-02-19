import type {
    FinancialProcessWithSteps
} from '@/types/financial-process';
import { PROCESS_TEMPLATES } from '@/types/financial-process';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Loader2, AlertCircle } from 'lucide-react';

interface FinancialProcessTableProps {
    processes: FinancialProcessWithSteps[];
    loading: boolean;
    onViewDetails: (process: FinancialProcessWithSteps) => void;
}

export function FinancialProcessTable({ processes, loading, onViewDetails }: FinancialProcessTableProps) {
    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-gold-medium" />
            </div>
        );
    }

    if (processes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 border border-dashed border-gray-800 rounded-lg">
                <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-lg font-medium">No financial processes found</p>
                <p className="text-sm text-gray-500">Create a new process to get started.</p>
            </div>
        );
    }

    return (
        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardHeader>
                <CardTitle className="text-white">Active Processes ({processes.length})</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-white border-b border-gray-700">
                                <th className="pb-3 font-medium px-4">Client</th>
                                <th className="pb-3 font-medium px-4">Process Type</th>
                                <th className="pb-3 font-medium px-4">Progress</th>
                                <th className="pb-3 font-medium px-4">Status</th>
                                <th className="pb-3 font-medium px-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {processes.map((process) => (
                                <tr key={process.id} className="border-b border-gray-800 hover:bg-white/5 transition-colors group">
                                    <td className="py-4 px-4">
                                        <div className="font-medium text-white">{process.client?.full_name || 'Unknown Client'}</div>
                                        <div className="text-sm text-gray-400">{process.client?.email || '-'}</div>
                                    </td>
                                    <td className="py-4 px-4">
                                        <span className="text-white font-medium">
                                            {PROCESS_TEMPLATES[process.process_type]?.name || process.process_type}
                                        </span>
                                    </td>
                                    <td className="py-4 px-4">
                                        <div className="flex flex-col gap-1 w-[140px]">
                                            <div className="flex justify-between text-xs text-gray-400 mb-1">
                                                <span>{process.completed_steps} / {process.total_steps}</span>
                                                <span>{Math.round((process.completed_steps / process.total_steps) * 100)}%</span>
                                            </div>
                                            <div className="w-full bg-gray-700 rounded-full h-1.5">
                                                <div
                                                    className="bg-gold-medium h-1.5 rounded-full transition-all duration-500"
                                                    style={{ width: `${(process.completed_steps / process.total_steps) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4">
                                        <Badge
                                            variant={process.status === 'completed' ? 'default' : 'secondary'}
                                            className={process.status === 'completed' ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-blue-500/20 text-blue-400 border-blue-500/50'}
                                        >
                                            {process.status === 'completed' ? 'Completed' : 'Active'}
                                        </Badge>
                                    </td>
                                    <td className="py-4 px-4 text-right">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 w-8 p-0 text-gray-400 hover:text-white"
                                            onClick={() => onViewDetails(process)}
                                            title="View Details"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
