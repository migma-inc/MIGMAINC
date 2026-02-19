import { useState, useEffect } from 'react';
import type {
    FinancialProcessWithSteps,
    FinancialProcessType
} from '@/types/financial-process';
import { PROCESS_TEMPLATES } from '@/types/financial-process';

import {
    getFinancialProcesses,
    createFinancialProcess,
} from '@/lib/financial-process';
import { syncFinancialProcesses } from '@/lib/financial-process-sync';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Plus, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { FinancialProcessTable } from './FinancialProcessTable';
import { FinancialProcessDetails } from './FinancialProcessDetails';

interface FinancialProcessListProps {
    isAdmin?: boolean;
    sellerId?: string;
}

export function FinancialProcessList({ isAdmin = false, sellerId }: FinancialProcessListProps) {
    const [processes, setProcesses] = useState<FinancialProcessWithSteps[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');

    // Create Modal State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState('');
    const [selectedType, setSelectedType] = useState<FinancialProcessType>('initial');
    const [dependentsCount, setDependentsCount] = useState(0);
    const [clients, setClients] = useState<{ id: string, full_name: string }[]>([]);
    const [creating, setCreating] = useState(false);

    // Details Modal State
    const [selectedProcess, setSelectedProcess] = useState<FinancialProcessWithSteps | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    useEffect(() => {
        loadProcesses();
        if (isAdmin) {
            loadClients();
            // Auto-sync in background
            syncFinancialProcesses().then(res => {
                if (res.updated > 0 || res.created > 0) {
                    loadProcesses(); // Reload only if changes occurred
                }
            }).catch(err => console.error('Auto-sync failed', err));
        }
    }, [refreshKey, isAdmin]);

    const loadProcesses = async () => {
        setLoading(true);
        // If not admin, RLS handles filtering by seller's clients if we don't pass sellerId
        // But if we pass sellerId (e.g. admin viewing a specific seller), we filter explicitly
        const { data, success } = await getFinancialProcesses(undefined, sellerId);
        if (success && data) {
            setProcesses(data);

            // If details modal is open, refresh the selected process data too
            if (isDetailsOpen && selectedProcess) {
                const updatedProcess = data.find(p => p.id === selectedProcess.id);
                if (updatedProcess) {
                    setSelectedProcess(updatedProcess);
                }
            }
        }
        setLoading(false);
    };

    const loadClients = async () => {
        let clientsQuery = supabase.from('clients').select('id, full_name').order('full_name');

        if (sellerId) {
            // Find clients associated with this seller via service_requests
            const { data: requests } = await supabase
                .from('service_requests')
                .select('client_id')
                .eq('seller_id', sellerId);

            const { data: orders } = await supabase
                .from('visa_orders')
                .select('client_email')
                .eq('seller_id', sellerId);

            let clientIds: string[] = [];

            if (requests && requests.length > 0) {
                clientIds = [...clientIds, ...requests.map(r => r.client_id).filter(Boolean)];
            }

            if (orders && orders.length > 0) {
                const orderEmails = [...new Set(orders.map(o => o.client_email).filter(Boolean))];
                if (orderEmails.length > 0) {
                    const { data: clientsFromOrders } = await supabase
                        .from('clients')
                        .select('id')
                        .in('email', orderEmails);

                    if (clientsFromOrders) {
                        clientIds = [...clientIds, ...clientsFromOrders.map(c => c.id)];
                    }
                }
            }

            clientIds = [...new Set(clientIds)];

            if (clientIds.length > 0) {
                clientsQuery = clientsQuery.in('id', clientIds);
            } else {
                // No clients for this seller
                setClients([]);
                return;
            }
        }

        const { data } = await clientsQuery;
        if (data) setClients(data);
    };

    const handleCreate = async () => {
        if (!selectedClient) return;
        setCreating(true);
        const result = await createFinancialProcess(selectedClient, selectedType, dependentsCount);
        setCreating(false);

        if (result.success) {
            setIsCreateOpen(false);
            setRefreshKey(prev => prev + 1);
            // Reset form
            setSelectedClient('');
            setSelectedType('initial');
        } else {
            alert('Failed to create process: ' + result.error);
        }
    };

    const handleViewDetails = (process: FinancialProcessWithSteps) => {
        setSelectedProcess(process);
        setIsDetailsOpen(true);
    };

    // Sorting and Filtering Logic
    const processedList = [...processes]
        .sort((a, b) => {
            const getLastPaidTime = (p: FinancialProcessWithSteps) => {
                const paidSteps = p.steps.filter(s => s.status === 'paid');
                if (paidSteps.length === 0) return 0;
                // Use updated_at (when it was marked paid) or created_at as fallback
                return Math.max(...paidSteps.map(s => new Date(s.updated_at || s.created_at).getTime()));
            };

            const timeA = getLastPaidTime(a);
            const timeB = getLastPaidTime(b);

            // Sort by most recent payment first
            if (timeA !== timeB) return timeB - timeA;

            // Sort by creation date if no payments (newest first)
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        })
        .filter(p => {
            if (!searchTerm) return true;
            const search = searchTerm.toLowerCase();
            return (
                p.client?.full_name?.toLowerCase().includes(search) ||
                p.client?.email?.toLowerCase().includes(search)
            );
        });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-xl font-bold text-white">Financial Processes</h2>

                <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                        <Input
                            placeholder="Search clients..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 bg-zinc-900 border-gray-800 focus:border-gold-medium/50 text-white placeholder:text-gray-400"
                        />
                    </div>

                    {isAdmin && (
                        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                            <DialogTrigger asChild>
                                <Button className="bg-gold-medium hover:bg-gold-light text-black font-semibold whitespace-nowrap">
                                    <Plus className="w-4 h-4 mr-2" />
                                    New Process
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-zinc-900 border-gold-medium/30 text-white">
                                <DialogHeader>
                                    <DialogTitle>Start New Financial Process</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label>Client</Label>
                                        <Select value={selectedClient} onValueChange={setSelectedClient}>
                                            <SelectTrigger className="bg-black/50 border-white/10">
                                                <SelectValue placeholder="Select a client" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {clients.map(c => (
                                                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Process Type</Label>
                                        <Select value={selectedType} onValueChange={(v: any) => setSelectedType(v)}>
                                            <SelectTrigger className="bg-black/50 border-white/10">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(PROCESS_TEMPLATES).map(([key, t]) => (
                                                    <SelectItem key={key} value={key}>{t.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Number of Dependents</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            value={dependentsCount}
                                            onChange={e => setDependentsCount(parseInt(e.target.value) || 0)}
                                            className="bg-black/50 border-white/10"
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                                    <Button
                                        onClick={handleCreate}
                                        disabled={!selectedClient || creating}
                                        className="bg-gold-medium hover:bg-gold-light text-black"
                                    >
                                        {creating ? 'Creating...' : 'Create Process'}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
            </div>

            <FinancialProcessTable
                processes={processedList}
                loading={loading}
                onViewDetails={handleViewDetails}
            />

            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="bg-zinc-900 border-gold-medium/30 text-white max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Financial Process Details</DialogTitle>
                    </DialogHeader>
                    {selectedProcess && (
                        <FinancialProcessDetails
                            process={selectedProcess}
                            isAdmin={isAdmin}
                            sellerId={sellerId}
                            onUpdate={() => setRefreshKey(prev => prev + 1)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
