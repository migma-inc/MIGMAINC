import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, FileText, CheckCircle2, ShieldCheck, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useContentProtection } from '@/hooks/useContentProtection';
import { validateVisaContractViewToken, getVisaContractViewData } from '@/lib/visa-contract-view';
import { formatContractTextToHtml } from '@/lib/contract-formatter';
import { motion } from 'framer-motion';
import { getSecureUrl } from '@/lib/storage';

export const ViewVisaOrderContract = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    // Pass true for allowSelection to enable text selection
    const [tokenValid, setTokenValid] = useState<boolean | null>(null);
    useContentProtection(tokenValid === true, true);

    const [loading, setLoading] = useState(true);
    const [orderData, setOrderData] = useState<any>(null);
    const [contractContent, setContractContent] = useState<string | null>(null);
    const [annexContent, setAnnexContent] = useState<string | null>(null);
    const [imageUrls, setImageUrls] = useState<{
        signature?: string | null;
        documentFront?: string | null;
        documentBack?: string | null;
        selfieDoc?: string | null;
    }>({});

    const annexRef = useRef<HTMLDivElement>(null);

    // CSS print protection remains (good practice for contracts)
    useEffect(() => {
        if (!tokenValid) return;

        const styleId = 'contract-view-print-protection';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
        @media print {
          #contract-content-area,
          #contract-content-area * {
            display: none !important;
            visibility: hidden !important;
          }
          
          body::before {
            content: "This document cannot be printed. It is available exclusively through the MIGMA portal.";
            display: block !important;
            visibility: visible !important;
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 18px;
            font-weight: bold;
            text-align: center;
            color: #000;
            background: #fff;
            padding: 40px;
            border: 3px solid #CE9F48;
            border-radius: 8px;
            z-index: 999999;
            width: 80%;
            max-width: 600px;
          }
        }
      `;
            document.head.appendChild(style);
        }

        return () => {
            const style = document.getElementById(styleId);
            if (style) style.remove();
        };
    }, [tokenValid]);

    useEffect(() => {
        const loadContract = async () => {
            setLoading(true);

            if (!token) {
                setTokenValid(false);
                setLoading(false);
                return;
            }

            try {
                const tokenData = await validateVisaContractViewToken(token);
                if (!tokenData) {
                    setTokenValid(false);
                    setLoading(false);
                    return;
                }

                setTokenValid(true);

                const data = await getVisaContractViewData(tokenData.order_id);
                if (!data) {
                    setTokenValid(false);
                    setLoading(false);
                    return;
                }

                setOrderData(data);

                // Obter URLs seguras injetando o token de visualização se necessário
                const secureUrls: typeof imageUrls = {};
                for (const [key, path] of Object.entries(data.imageUrls)) {
                    if (path) {
                        let finalUrl = await getSecureUrl(path as string);
                        // Se o getSecureUrl retornou uma URL do Proxy, precisamos anexar o token para autorizar o acesso deslogado
                        if (finalUrl && finalUrl.includes('/functions/v1/document-proxy')) {
                            finalUrl += `&token=${token}`;
                        }
                        (secureUrls as any)[key] = finalUrl;
                    }
                }
                setImageUrls(secureUrls);

                if (data.contractContent) {
                    const formatted = formatContractTextToHtml(data.contractContent);
                    setContractContent(formatted);
                }

                if (data.annexContent && data.order.annex_approval_status === 'approved') {
                    const formattedAnnex = formatContractTextToHtml(data.annexContent);
                    setAnnexContent(formattedAnnex);
                }

            } catch (error) {
                console.error('[VIEW_VISA_CONTRACT] Error loading contract:', error);
                setTokenValid(false);
            } finally {
                setLoading(false);
            }
        };

        loadContract();
    }, [token]);

    const scrollToAnnex = () => {
        annexRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <div className="flex flex-col items-center">
                    <div className="w-12 h-12 border-4 border-gold-medium border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_15px_rgba(206,159,72,0.5)]"></div>
                    <p className="text-gold-light tracking-wide font-light">Loading Secure Contract...</p>
                </div>
            </div>
        );
    }

    if (!tokenValid || !orderData) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <Card className="max-w-md w-full border border-red-900/50 bg-red-950/10 backdrop-blur-sm">
                    <CardContent className="p-8 text-center">
                        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6 opacity-80" />
                        <h1 className="text-2xl font-bold mb-4 text-red-400 font-serif">Link Expired</h1>
                        <p className="text-gray-400 mb-8 font-light leading-relaxed">
                            This secure link is invalid or has expired. Please contact support if you believe this is an error.
                        </p>
                        <Button
                            onClick={() => navigate('/')}
                            className="bg-gold-medium text-black hover:bg-gold-light w-full font-bold tracking-wide"
                        >
                            Return Home
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const { order, product } = orderData;
    const paymentMethodDisplay = order.payment_method?.replace('_', ' ').toUpperCase() || 'N/A';
    const signedDate = order.contract_signed_at ? new Date(order.contract_signed_at).toLocaleString() : 'N/A';

    return (
        <div className="min-h-screen font-sans text-gray-200 selection:bg-gold-medium/30 selection:text-gold-light">
            {/* Background Gradient similar to Global Partner */}
            <div className="fixed inset-0 z-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 150% 100% at top center, #1a1a1a 0%, #000000 100%)" }}></div>

            <div className="relative z-10 py-12 px-4 md:px-8 max-w-5xl mx-auto space-y-8">

                {/* Header Section */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center space-y-4"
                >
                    <div className="inline-flex items-center justify-center p-3 bg-green-500/10 rounded-full border border-green-500/20 mb-2">
                        <ShieldCheck className="w-8 h-8 text-green-400" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold migma-gold-text tracking-tight">
                        Secure Contract View
                    </h1>
                    <p className="text-gold-light/70 text-lg font-light tracking-wide">
                        Verified Agreement for {product?.name || 'Visa Service'}
                    </p>
                </motion.div>

                {/* Main Content Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <Card className="border border-gold-medium/30 bg-black/40 backdrop-blur-md shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden">

                        {/* Order Status Bar */}
                        <div className="bg-gradient-to-r from-gold-dark/20 to-transparent border-b border-gold-medium/20 p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                                <div>
                                    <p className="text-gold-light font-semibold tracking-wide">Payment Confirmed & Verified</p>
                                    <p className="text-xs text-gray-400 font-mono">ID: {order.order_number}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-6 text-sm">
                                <div>
                                    <span className="text-gray-500 block text-[10px] uppercase tracking-wider">Method</span>
                                    <span className="text-white font-medium">{paymentMethodDisplay}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500 block text-[10px] uppercase tracking-wider">Signed On</span>
                                    <span className="text-white font-medium">{signedDate}</span>
                                </div>
                            </div>
                        </div>

                        <CardContent id="contract-content-area" className="p-8 md:p-12 space-y-12">

                            {/* Client Summary */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 bg-white/5 rounded-xl border border-white/10">
                                <div className="space-y-1">
                                    <p className="text-xs text-gold-medium/70 uppercase tracking-widest font-semibold">Client Name</p>
                                    <p className="text-white font-medium text-lg">{order.client_name}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-gold-medium/70 uppercase tracking-widest font-semibold">Email Address</p>
                                    <p className="text-gray-300 font-medium">{order.client_email}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-gold-medium/70 uppercase tracking-widest font-semibold">Nationality</p>
                                    <p className="text-gray-300 font-medium">{order.client_nationality || 'N/A'}</p>
                                </div>
                            </div>

                            {/* Jump to Annex Button if available */}
                            {annexContent && (
                                <div className="flex justify-end">
                                    <Button
                                        variant="outline"
                                        onClick={scrollToAnnex}
                                        className="border-gold-medium/30 text-gold-light hover:bg-gold-medium/10 gap-2 text-xs uppercase tracking-wider"
                                    >
                                        Jump to Annex I <ChevronDown className="w-4 h-4" />
                                    </Button>
                                </div>
                            )}

                            {/* Main Contract Text */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-3 border-b border-gold-medium/30 pb-4">
                                    <FileText className="w-6 h-6 text-gold-medium" />
                                    <h2 className="text-2xl font-bold text-white tracking-tight">Terms of Service Agreement</h2>
                                </div>

                                {contractContent ? (
                                    <div
                                        className="prose prose-invert prose-lg max-w-none 
                                            prose-headings:text-gold-light prose-headings:font-bold
                                            prose-p:text-gray-300 prose-p:leading-relaxed
                                            prose-li:text-gray-300
                                            prose-strong:text-white"
                                        dangerouslySetInnerHTML={{ __html: contractContent }}
                                    />
                                ) : (
                                    <div className="p-8 text-center border border-dashed border-red-900/50 rounded-lg bg-red-950/10">
                                        <p className="text-red-400 italic">Contract content unavailable.</p>
                                    </div>
                                )}
                            </div>

                            {/* Annex Section */}
                            {annexContent && (
                                <div ref={annexRef} className="pt-12 border-t border-gold-medium/20 space-y-6 scroll-mt-24">
                                    <div className="flex items-center gap-3 border-b border-gold-medium/30 pb-4">
                                        <FileText className="w-6 h-6 text-gold-medium" />
                                        <h2 className="text-2xl font-bold text-white tracking-tight">ANNEX I - Statement of Responsibility</h2>
                                    </div>
                                    <div
                                        className="prose prose-invert prose-lg max-w-none 
                                            prose-headings:text-gold-light prose-headings:font-bold
                                            prose-p:text-gray-300 prose-p:leading-relaxed
                                            prose-li:text-gray-300
                                            prose-strong:text-white"
                                        dangerouslySetInnerHTML={{ __html: annexContent }}
                                    />
                                </div>
                            )}

                            {/* Signatures */}
                            <div className="pt-12 border-t border-gold-medium/20">
                                <h3 className="text-lg font-bold text-gold-light uppercase tracking-widest mb-8">Digital Authentication</h3>

                                <div className="flex flex-col md:flex-row gap-10">
                                    {/* Client Signature */}
                                    <div className="flex-1 space-y-4">
                                        <p className="text-sm text-gray-400 font-medium">Authorized Signature</p>
                                        <div className="border border-gold-medium/30 bg-white/5 rounded-xl p-8 flex items-center justify-center min-h-[160px]">
                                            {imageUrls.signature ? (
                                                <img
                                                    src={imageUrls.signature}
                                                    alt="Client Signature"
                                                    className="max-h-24 max-w-full object-contain filter invert opacity-90"
                                                    draggable={false}
                                                />
                                            ) : (
                                                <p className="text-3xl font-script text-white/80 italic">{order.client_name}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Selfie (if present) */}
                                    {imageUrls.selfieDoc && (
                                        <div className="flex-1 space-y-4">
                                            <p className="text-sm text-gray-400 font-medium">Biometric Verification</p>
                                            <div className="border border-gold-medium/30 bg-black rounded-xl p-2 flex items-center justify-center min-h-[160px] max-w-[200px]">
                                                <img
                                                    src={imageUrls.selfieDoc}
                                                    alt="Identity Verification"
                                                    className="h-32 w-auto object-cover rounded shadow-lg"
                                                    draggable={false}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-6 flex items-center gap-2 text-gold-dark/40 text-xs font-mono uppercase tracking-widest">
                                    <ShieldCheck className="w-3 h-3" />
                                    <span>Digitally Signed & Encrypted • {signedDate}</span>
                                </div>
                            </div>

                        </CardContent>
                    </Card>
                </motion.div>

                <div className="text-center pb-8">
                    <p className="text-gray-600 text-xs max-w-md mx-auto">
                        This document is protected by international copyright laws. Unauthorized reproduction or distribution of this contract is strictly prohibited.
                        <br />&copy; {new Date().getFullYear()} MIGMA INC.
                    </p>
                </div>

            </div>
        </div>
    );
};
