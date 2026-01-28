import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, FileText, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useContentProtection } from '@/hooks/useContentProtection';
import { validateVisaContractViewToken, getVisaContractViewData } from '@/lib/visa-contract-view';
import { formatContractTextToHtml } from '@/lib/contract-formatter';
import { motion } from 'framer-motion';
import { getSecureUrl } from '@/lib/storage';

export const ViewVisaOrderContract = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

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

    useEffect(() => {
        if (!tokenValid) return;
        const styleId = 'contract-view-print-protection';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                @media print {
                  #contract-content-area, #contract-content-area * { display: none !important; }
                  body::before {
                    content: "Locked Document - View Only";
                    display: block !important;
                    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                    font-size: 24px; font-weight: bold; color: #CE9F48;
                  }
                }
            `;
            document.head.appendChild(style);
        }
        return () => { document.getElementById(styleId)?.remove(); };
    }, [tokenValid]);

    useEffect(() => {
        const loadContract = async () => {
            setLoading(true);
            if (!token) { setTokenValid(false); setLoading(false); return; }
            try {
                const tokenData = await validateVisaContractViewToken(token);
                if (!tokenData) { setTokenValid(false); setLoading(false); return; }
                setTokenValid(true);
                const data = await getVisaContractViewData(tokenData.order_id);
                if (!data) { setTokenValid(false); setLoading(false); return; }
                setOrderData(data);

                const secureUrls: typeof imageUrls = {};
                for (const [key, path] of Object.entries(data.imageUrls)) {
                    if (path) {
                        let finalUrl = await getSecureUrl(path as string);
                        if (finalUrl && finalUrl.includes('/functions/v1/document-proxy')) {
                            finalUrl += `&token=${token}`;
                        }
                        (secureUrls as any)[key] = finalUrl;
                    }
                }
                setImageUrls(secureUrls);

                if (data.contractContent) setContractContent(formatContractTextToHtml(data.contractContent));
                if (data.annexContent && data.order.annex_approval_status === 'approved') setAnnexContent(formatContractTextToHtml(data.annexContent));
            } catch (error) {
                console.error('[VIEW_VISA_CONTRACT] Error:', error);
                setTokenValid(false);
            } finally { setLoading(false); }
        };
        loadContract();
    }, [token]);

    if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="w-12 h-12 border-4 border-gold-medium border-t-transparent rounded-full animate-spin"></div></div>;

    if (!tokenValid || !orderData) return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            <Card className="max-w-md w-full border border-red-900/50 bg-red-950/10 text-center p-8">
                <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h1 className="text-2xl font-bold text-red-400 mb-2">Access Denied</h1>
                <p className="text-gray-400 mb-6">This legal link has expired or is invalid.</p>
                <Button onClick={() => navigate('/')} className="bg-gold-medium text-black w-full font-bold">Return Home</Button>
            </Card>
        </div>
    );

    const { order, product } = orderData;
    const signedDate = order.contract_signed_at ? new Date(order.contract_signed_at).toLocaleString() : 'N/A';

    return (
        <div className="min-h-screen bg-gradient-to-b from-black via-[#1a1a1a] to-black py-12 px-4 shadow-[inset_0_0_100px_rgba(0,0,0,0.9)]">
            <div className="max-w-5xl mx-auto space-y-6">
                <Card className="border border-gold-medium/30 shadow-2xl bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 backdrop-blur-sm overflow-hidden">
                    <CardHeader className="text-center border-b border-gold-medium/30 bg-gradient-to-r from-gold-dark via-gold-medium to-gold-dark pb-8 pt-10">
                        <CardTitle className="text-3xl font-bold flex items-center justify-center gap-2 text-white drop-shadow-md">
                            <ShieldCheck className="w-8 h-8 text-black/80" />
                            Authenticated Agreement
                        </CardTitle>
                        <CardDescription className="text-lg mt-4 text-black/80 font-medium font-serif italic">
                            {product?.name || 'Visa Support Agreement'}
                        </CardDescription>
                    </CardHeader>

                    <CardContent id="contract-content-area" className="p-8 sm:p-12 space-y-12 text-justify leading-relaxed text-gray-200">
                        {/* Info Bar */}
                        <div className="p-6 bg-black/40 rounded-lg border border-gold-medium/30 shadow-inner grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                            <div className="flex flex-col gap-1">
                                <span className="text-gray-500 uppercase text-[10px] tracking-widest font-bold">Client</span>
                                <span className="text-white font-semibold text-base">{order.client_name}</span>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-gray-500 uppercase text-[10px] tracking-widest font-bold">Order Number</span>
                                <span className="text-white font-mono">{order.order_number}</span>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-gray-500 uppercase text-[10px] tracking-widest font-bold">Signed At</span>
                                <span className="text-gold-light font-bold">{signedDate}</span>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-gray-500 uppercase text-[10px] tracking-widest font-bold">Status</span>
                                <span className="text-green-400 font-bold uppercase tracking-widest">VALID & ENFORCEABLE</span>
                            </div>
                        </div>

                        {/* Contract Content */}
                        <div className="prose prose-invert max-w-none 
                            prose-p:my-6 prose-p:leading-[1.8] prose-p:text-gray-300 
                            prose-strong:text-gold-medium prose-strong:font-bold
                            prose-headings:text-gold-light prose-headings:font-bold prose-headings:border-l-2 prose-headings:border-gold-medium prose-headings:pl-4">
                            {contractContent && <div dangerouslySetInnerHTML={{ __html: contractContent }} />}

                            {annexContent && (
                                <div ref={annexRef} className="mt-24 pt-20 border-t border-gold-medium/20">
                                    <div className="text-center mb-10">
                                        <span className="px-6 py-1 bg-gold-medium text-black text-[10px] font-bold rounded-full uppercase tracking-[0.2em]">Legal Annex I</span>
                                        <h2 className="text-2xl font-bold mt-4 text-gold-light uppercase tracking-tight">Statement of Responsibility</h2>
                                    </div>
                                    <div dangerouslySetInnerHTML={{ __html: annexContent }} />
                                </div>
                            )}
                        </div>

                        {/* Digital Certification Section */}
                        <div className="mt-12 pt-12 border-t border-gold-medium/20">
                            <h3 className="text-sm font-bold text-gold-medium uppercase tracking-[0.2em] mb-10 text-center underline underline-offset-8">Digital Authentication Record</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                {/* Signature */}
                                <div className="space-y-4">
                                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Client Digital Signature</p>
                                    <div className="border border-gold-medium/30 rounded-xl p-8 bg-white/5 backdrop-blur-sm min-h-[160px] flex items-center justify-center relative">
                                        {imageUrls.signature ? (
                                            <img src={imageUrls.signature} alt="Signature" className="max-h-24 max-w-full object-contain filter invert opacity-90" draggable={false} />
                                        ) : (
                                            <p className="text-3xl font-serif italic text-white/10 select-none">/ {order.client_name} /</p>
                                        )}
                                    </div>
                                    <div className="pt-2">
                                        <p className="text-sm font-bold text-white uppercase">{order.client_name}</p>
                                        <p className="text-[10px] text-gray-500 font-mono">RECORD_ID: {order.id?.substring(0, 16).toUpperCase()}</p>
                                    </div>
                                </div>

                                {/* Identity Photos */}
                                <div className="space-y-4">
                                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Identity Evidence (Originals)</p>
                                    <div className="flex flex-wrap gap-3">
                                        {imageUrls.documentFront && (
                                            <div className="relative group bg-zinc-900 p-1 rounded-lg border border-gold-medium/20 shadow-xl">
                                                <img src={imageUrls.documentFront} alt="Front" className="w-20 h-28 object-cover rounded" />
                                                <div className="absolute inset-x-0 bottom-0 bg-black/60 text-[7px] text-center font-bold uppercase py-0.5 rounded-b text-white">Front</div>
                                            </div>
                                        )}
                                        {imageUrls.documentBack && (
                                            <div className="relative group bg-zinc-900 p-1 rounded-lg border border-gold-medium/20 shadow-xl">
                                                <img src={imageUrls.documentBack} alt="Back" className="w-20 h-28 object-cover rounded" />
                                                <div className="absolute inset-x-0 bottom-0 bg-black/60 text-[7px] text-center font-bold uppercase py-0.5 rounded-b text-white">Back</div>
                                            </div>
                                        )}
                                        {imageUrls.selfieDoc && (
                                            <div className="relative group bg-zinc-900 p-1 rounded-lg border border-gold-medium/20 shadow-xl">
                                                <img src={imageUrls.selfieDoc} alt="Selfie" className="w-20 h-28 object-cover rounded" />
                                                <div className="absolute inset-x-0 bottom-0 bg-gold-medium/80 text-[7px] text-center font-bold uppercase py-0.5 rounded-b text-black">Selfie</div>
                                            </div>
                                        )}
                                        <div className="flex flex-col justify-center">
                                            <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-[9px] font-bold border border-green-500/30 uppercase mb-2">
                                                <CheckCircle2 className="w-2 h-2" /> Verified
                                            </div>
                                            <p className="text-[8px] text-gray-500 font-mono leading-tight">AUTH: SECURE<br />MATCH: PREMIUM</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Seals */}
                        <div className="mt-20 pt-10 border-t border-gold-medium/10 text-center space-y-6">
                            <div className="flex justify-center gap-12 opacity-20 contrast-125">
                                <ShieldCheck className="w-10 h-10 text-gold-medium" />
                                <div className="border-r border-gold-medium/30 h-10"></div>
                                <FileText className="w-10 h-10 text-gold-medium" />
                            </div>
                            <p className="text-[9px] text-gray-500 uppercase tracking-[0.2em] max-w-xl mx-auto leading-relaxed">
                                This agreement is a legally binding digital instrument. All signatures
                                and verification data are stored in the MIGMA private secure vault.
                            </p>
                            <p className="text-gold-medium/40 text-[10px] font-bold tracking-[0.4em]">
                                &copy; {new Date().getFullYear()} MIGMA INC • ALL RIGHTS RESERVED
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-center pb-10">
                    <Button onClick={() => navigate('/')} className="bg-gold-medium text-black hover:bg-gold-light px-10 py-6 rounded-xl font-bold uppercase tracking-[0.2em] shadow-xl transition-transform hover:scale-105">
                        Return Home
                    </Button>
                </div>
            </div>
        </div>
    );
};
