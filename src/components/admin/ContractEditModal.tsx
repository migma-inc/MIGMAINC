import { useState, useEffect } from 'react';
import { X, FileText, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { getContractTemplate } from '@/lib/contract-templates';

interface ContractEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (content: string) => void;
    isLoading?: boolean;
    applicationId?: string;
    applicationName?: string;
    initialContent?: string;
    templateContent?: string;
}

export function ContractEditModal({
    isOpen,
    onClose,
    onConfirm,
    isLoading: parentLoading = false,
    applicationId,
    applicationName,
    initialContent: propInitialContent,
    templateContent: propTemplateContent,
}: ContractEditModalProps) {
    const [content, setContent] = useState('');
    const [templateContent, setTemplateContent] = useState('');
    const [fetching, setFetching] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        async function loadContent() {
            if (applicationId) {
                setFetching(true);
                try {
                    // 1. Tentar buscar conteúdo customizado de tokens anteriores
                    const { data: latestToken } = await supabase
                        .from('partner_terms_acceptances')
                        .select('custom_content, contract_template_id')
                        .eq('application_id', applicationId)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    let baseContent = '';
                    let tempContent = '';
                    let templateId = latestToken?.contract_template_id;

                    if (latestToken?.custom_content) {
                        baseContent = latestToken.custom_content;
                    }

                    // Buscar o conteúdo do template (para reset)
                    if (!templateId) {
                        // Buscar template padrão se não houver ID
                        const { data: templates } = await supabase
                            .from('contract_templates')
                            .select('id, content')
                            .eq('is_active', true)
                            .or('template_type.eq.global_partner,template_type.is.null')
                            .limit(1);

                        if (templates && templates.length > 0) {
                            tempContent = templates[0].content;
                            if (!baseContent) baseContent = tempContent;
                        }
                    } else {
                        const template = await getContractTemplate(templateId);
                        if (template) {
                            tempContent = template.content;
                            if (!baseContent) baseContent = tempContent;
                        }
                    }

                    setContent(baseContent);
                    setTemplateContent(tempContent);
                } catch (err) {
                    console.error('Error fetching contract content:', err);
                } finally {
                    setFetching(false);
                }
            } else {
                // Se não tem applicationId, usa as props (fallback ou modo direto)
                setContent(propInitialContent || propTemplateContent || '');
                setTemplateContent(propTemplateContent || '');
            }
        }

        loadContent();
    }, [isOpen, applicationId, propInitialContent, propTemplateContent]);

    const handleConfirm = () => {
        onConfirm(content);
    };

    const handleReset = () => {
        if (window.confirm('Deseja realmente resetar para o conteúdo original do template? Suas alterações serão perdidas.')) {
            setContent(templateContent);
        }
    };

    if (!isOpen) return null;

    const isLoading = parentLoading || fetching;

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
            onClick={onClose}
        >
            <div
                className="bg-[#0f0f0f] border border-gold-medium/30 rounded-lg shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 flex-shrink-0 border-b border-gold-medium/20 bg-black/40">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h3 className="text-xl font-bold migma-gold-text flex items-center gap-2">
                                <FileText className="w-5 h-5" />
                                Editar Contrato antes de Reenviar
                            </h3>
                            <p className="text-sm text-gray-400 mt-1">
                                Candidato: <span className="text-gold-light font-medium">{applicationName || applicationId}</span>
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            disabled={isLoading}
                            className="text-gray-400 hover:text-white hover:bg-white/5"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-6 bg-zinc-900/30">
                    {fetching ? (
                        <div className="h-full flex flex-col items-center justify-center gap-4">
                            <Loader2 className="w-10 h-10 text-gold-medium animate-spin" />
                            <p className="text-gold-light/60 font-medium">Buscando conteúdo do contrato...</p>
                        </div>
                    ) : (
                        <div className="space-y-4 h-full flex flex-col">
                            <div className="flex justify-between items-center">
                                <Label htmlFor="contract-content" className="text-gray-300 font-medium">
                                    Conteúdo do Contrato (HTML suportado)
                                </Label>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleReset}
                                    className="text-gold-light hover:text-gold-medium hover:bg-gold-light/5 text-xs flex items-center gap-1.5 transition-colors"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Resetar para Template Original
                                </Button>
                            </div>
                            <textarea
                                id="contract-content"
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                className="w-full flex-1 bg-white text-black p-6 rounded-lg border border-gold-medium/30 focus:outline-none focus:ring-2 focus:ring-gold-medium/50 font-mono text-sm leading-relaxed shadow-inner"
                                placeholder="Editando o contrato para este candidato..."
                                disabled={isLoading}
                            />
                            <p className="text-[10px] text-gray-500 italic">
                                * As alterações feitas aqui serão fixadas para este candidato específico.
                            </p>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gold-medium/20 flex gap-3 justify-end flex-shrink-0 bg-black/40">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isLoading}
                        className="border-gold-medium/40 bg-transparent text-gray-300 hover:bg-white/5"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={isLoading || !content.trim()}
                        className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold px-8 shadow-lg shadow-blue-900/20 transition-all border-none"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Processando...
                            </>
                        ) : (
                            'Salvar e Reenviar Link'
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
