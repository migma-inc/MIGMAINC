import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Send, CheckCircle2, AlertCircle, Clock, Search } from 'lucide-react';

interface ContractItem {
    id: string;
    name: string;
    email: string;
    date: string;
    type: 'visa' | 'partner';
    order_number?: string;
    selected: boolean;
    status: 'pending' | 'sending' | 'success' | 'error';
    error?: string;
    admin_email_sent: boolean;
}

export const SendExistingContracts = () => {
    const [visaContracts, setVisaContracts] = useState<ContractItem[]>([]);
    const [partnerContracts, setPartnerContracts] = useState<ContractItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentTab, setCurrentTab] = useState<'visa' | 'partner'>('visa');
    const [activeSearch, setActiveSearch] = useState('');

    const loadContracts = async () => {
        setLoading(true);
        try {
            // 1. Fetch Visa Contracts (Approved)
            const { data: visaData, error: visaError } = await supabase
                .from('visa_orders')
                .select('id, client_name, client_email, created_at, order_number, admin_email_sent')
                .eq('contract_approval_status', 'approved')
                .order('created_at', { ascending: false });

            if (visaError) throw visaError;

            // 2. Fetch Partner Contracts (Approved)
            const { data: partnerData, error: partnerError } = await supabase
                .from('partner_terms_acceptances')
                .select(`
          id, 
          admin_email_sent, 
          verification_reviewed_at,
          global_partner_applications (
            full_name,
            email
          )
        `)
                .eq('verification_status', 'approved')
                .order('verification_reviewed_at', { ascending: false });

            if (partnerError) throw partnerError;

            setVisaContracts((visaData || []).map(item => ({
                id: item.id,
                name: item.client_name,
                email: item.client_email,
                date: item.created_at,
                type: 'visa',
                order_number: item.order_number,
                selected: false,
                status: 'pending',
                admin_email_sent: !!item.admin_email_sent
            })));

            setPartnerContracts((partnerData || []).map(item => ({
                id: item.id,
                name: (item.global_partner_applications as any)?.full_name || 'N/A',
                email: (item.global_partner_applications as any)?.email || 'N/A',
                date: item.verification_reviewed_at || '',
                type: 'partner',
                selected: false,
                status: 'pending',
                admin_email_sent: !!item.admin_email_sent
            })));

        } catch (err) {
            console.error('Error loading contracts:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadContracts();
    }, []);

    const getActiveList = () => currentTab === 'visa' ? visaContracts : partnerContracts;
    const setActiveList = currentTab === 'visa' ? setVisaContracts : setPartnerContracts;

    const toggleSelect = (id: string) => {
        setActiveList(prev => prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item));
    };

    const toggleSelectAll = (selected: boolean) => {
        const reachableIds = filteredItems.map(i => i.id);
        setActiveList(prev => prev.map(item =>
            reachableIds.includes(item.id) && !item.admin_email_sent
                ? { ...item, selected }
                : item
        ));
    };

    const filteredItems = getActiveList().filter(item => {
        const searchMatch = item.name.toLowerCase().includes(activeSearch.toLowerCase()) ||
            item.email.toLowerCase().includes(activeSearch.toLowerCase()) ||
            (item.order_number && item.order_number.toLowerCase().includes(activeSearch.toLowerCase()));
        return searchMatch;
    });

    const selectedCount = getActiveList().filter(i => i.selected).length;

    const handleSendBatch = async () => {
        const toSend = getActiveList().filter(i => i.selected && i.status !== 'success');
        if (toSend.length === 0) return;

        setIsProcessing(true);
        setProgress(0);
        let completed = 0;

        for (const item of toSend) {
            // Update status to sending
            setActiveList(prev => prev.map(i => i.id === item.id ? { ...i, status: 'sending' } : i));

            try {
                const { data, error } = await supabase.functions.invoke('send-existing-contract-email', {
                    body: { contract_id: item.id, type: item.type }
                });

                if (error || (data && !data.success)) {
                    throw new Error(error?.message || data?.error || 'Unknown error');
                }

                // Update status to success
                setActiveList(prev => prev.map(i => i.id === item.id ? { ...i, status: 'success', selected: false, admin_email_sent: true } : i));
            } catch (err: any) {
                console.error(`Error sending ${item.id}:`, err);
                setActiveList(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: err.message } : i));
            }

            completed++;
            setProgress((completed / toSend.length) * 100);

            // Wait 3 seconds to avoid spam/rate limit
            if (completed < toSend.length) {
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        setIsProcessing(false);
        loadContracts(); // Refresh to update flags
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-medium"></div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold migma-gold-text">Envio de Contratos Existentes</h1>
                    <p className="text-gray-400 mt-1">Envie manualmente os PDFs de contratos aprovados para os emails administrativos.</p>
                </div>

                <Button
                    onClick={handleSendBatch}
                    disabled={selectedCount === 0 || isProcessing}
                    className="bg-gold-medium hover:bg-gold-dark text-black font-bold h-12 px-8"
                >
                    {isProcessing ? (
                        <>
                            <Clock className="mr-2 h-5 w-5 animate-spin" />
                            Processando...
                        </>
                    ) : (
                        <>
                            <Send className="mr-2 h-5 w-5" />
                            Enviar {selectedCount} Selecionados
                        </>
                    )}
                </Button>
            </div>

            {isProcessing && (
                <Card className="bg-zinc-900 border-gold-medium/20">
                    <CardContent className="pt-6">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-gold-light">Progresso do Lote</span>
                            <span className="text-sm text-gray-400">{Math.round(progress)}%</span>
                        </div>
                        <Progress value={progress} className="h-2 bg-zinc-800" />
                        <p className="text-xs text-amber-400 mt-2 font-medium bg-amber-400/10 p-2 rounded">
                            Aviso: Estamos enviando um por um com intervalo de 3 segundos para evitar bloqueios de SPAM. Não feche esta página.
                        </p>
                    </CardContent>
                </Card>
            )}

            <Tabs defaultValue="visa" className="w-full" onValueChange={(v) => setCurrentTab(v as any)}>
                <TabsList className="bg-zinc-900 border border-zinc-800 p-1">
                    <TabsTrigger value="visa" className="px-6">Visa Contracts</TabsTrigger>
                    <TabsTrigger value="partner" className="px-6">Global Partners</TabsTrigger>
                </TabsList>

                <div className="mt-6 flex flex-col md:flex-row gap-4 items-center mb-4">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Buscar por nome, email ou número do pedido..."
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-2 pl-10 pr-4 text-white focus:outline-none focus:ring-1 focus:ring-gold-medium"
                            value={activeSearch}
                            onChange={(e) => setActiveSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <Button variant="outline" size="sm" onClick={() => toggleSelectAll(true)} className="border-zinc-800 flex-1 md:flex-none">
                            Selecionar Tudo (Filtrado)
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => toggleSelectAll(false)} className="border-zinc-800 flex-1 md:flex-none">
                            Desmarcar Tudo
                        </Button>
                    </div>
                </div>

                <TabsContent value="visa">
                    <ContractTable items={filteredItems} toggleSelect={toggleSelect} isProcessing={isProcessing} />
                </TabsContent>

                <TabsContent value="partner">
                    <ContractTable items={filteredItems} toggleSelect={toggleSelect} isProcessing={isProcessing} />
                </TabsContent>
            </Tabs>
        </div>
    );
};

const ContractTable = ({ items, toggleSelect, isProcessing }: { items: ContractItem[], toggleSelect: (id: string) => void, isProcessing: boolean }) => (
    <Card className="bg-zinc-950 border-zinc-800">
        <CardContent className="p-0">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-zinc-800 bg-zinc-900/50">
                            <th className="p-4 w-10 text-left">
                                {/* Global toggle is in the header above */}
                            </th>
                            <th className="p-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Documento / Pedido</th>
                            <th className="p-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Cliente / Parceiro</th>
                            <th className="p-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Aprovação</th>
                            <th className="p-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status Envio</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                        {items.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-12 text-center text-gray-500">Nenhum contrato encontrado com os filtros aplicados.</td>
                            </tr>
                        ) : (
                            items.map((item) => (
                                <tr key={item.id} className={`hover:bg-zinc-900/30 transition-colors ${item.selected ? 'bg-gold-medium/5' : ''}`}>
                                    <td className="p-4">
                                        {!item.admin_email_sent && (
                                            <Checkbox
                                                checked={item.selected}
                                                disabled={isProcessing || item.status === 'success'}
                                                onCheckedChange={() => toggleSelect(item.id)}
                                                className="border-zinc-700 data-[state=checked]:bg-gold-medium data-[state=checked]:text-black"
                                            />
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col">
                                            <span className="text-white font-medium">{item.type === 'visa' ? 'Visa Order' : 'Global Partner'}</span>
                                            {item.order_number && <span className="text-xs font-mono text-gold-light mt-0.5">#{item.order_number}</span>}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col">
                                            <span className="text-white text-sm">{item.name}</span>
                                            <span className="text-xs text-gray-500">{item.email}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm text-gray-400">
                                        {new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td className="p-4">
                                        {renderStatus(item)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </CardContent>
    </Card>
);

const renderStatus = (item: ContractItem) => {
    if (item.admin_email_sent && item.status !== 'success') {
        return (
            <Badge className="bg-green-500/10 text-green-400 border-green-500/20 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Enviado
            </Badge>
        );
    }

    switch (item.status) {
        case 'sending':
            return (
                <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 gap-1 animate-pulse">
                    <Clock className="h-3 w-3 animate-spin" />
                    Enviando...
                </Badge>
            );
        case 'success':
            return (
                <Badge className="bg-green-500/20 text-green-300 border-green-500/50 gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Sucesso
                </Badge>
            );
        case 'error':
            return (
                <Badge variant="destructive" className="gap-1" title={item.error}>
                    <AlertCircle className="h-3 w-3" />
                    Erro
                </Badge>
            );
        default:
            return (
                <Badge variant="outline" className="border-zinc-800 text-gray-500">
                    Pendente
                </Badge>
            );
    }
};
