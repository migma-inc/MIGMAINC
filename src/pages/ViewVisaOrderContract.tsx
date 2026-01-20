import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, FileText, Router, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useContentProtection } from '@/hooks/useContentProtection';
import { validateVisaContractViewToken, getVisaContractViewData } from '@/lib/visa-contract-view';
import { formatContractTextToHtml } from '@/lib/contract-formatter';

export const ViewVisaOrderContract = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const [tokenValid, setTokenValid] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);
    const [orderData, setOrderData] = useState<any>(null);
    const [contractContent, setContractContent] = useState<string | null>(null);
    const [imageUrls, setImageUrls] = useState<{
        signature?: string | null;
        documentFront?: string | null;
        documentBack?: string | null;
        selfieDoc?: string | null;
    }>({});

    // Apply content protection (no copy/paste) when token is valid
    useContentProtection(tokenValid === true);

    // Add CSS print protection
    useEffect(() => {
        if (!tokenValid) return;

        const styleId = 'contract-view-print-protection';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
        @media print {
          #contract-content,
          #contract-content * {
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

    // Validate token and load data
    useEffect(() => {
        const loadContract = async () => {
            setLoading(true);

            if (!token) {
                setTokenValid(false);
                setLoading(false);
                return;
            }

            try {
                // Validate token
                const tokenData = await validateVisaContractViewToken(token);
                if (!tokenData) {
                    setTokenValid(false);
                    setLoading(false);
                    return;
                }

                setTokenValid(true);

                // Fetch contract data
                const data = await getVisaContractViewData(tokenData.order_id);
                if (!data) {
                    setTokenValid(false);
                    setLoading(false);
                    return;
                }

                setOrderData(data);
                setImageUrls(data.imageUrls);

                // Format contract content
                if (data.contractContent) {
                    const formatted = formatContractTextToHtml(data.contractContent);
                    setContractContent(formatted);
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

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="w-12 h-12 border-4 border-gold-medium border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-gold-light">Loading Secure Contract...</p>
                </div>
            </div>
        );
    }

    if (!tokenValid || !orderData) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <Card className="max-w-md w-full border border-red-900/50 bg-red-950/10">
                    <CardContent className="p-8 text-center">
                        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
                        <h1 className="text-2xl font-bold mb-4 text-red-400">Invalid or Expired Link</h1>
                        <p className="text-gray-400 mb-8">
                            This contract viewing link is invalid or has expired. Please contact support if you believe this is an error.
                        </p>
                        <Button
                            onClick={() => navigate('/')}
                            className="bg-gold-medium text-black hover:bg-gold-light w-full"
                        >
                            Go to Homepage
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
        <div className="min-h-screen bg-black py-12 px-4 md:px-8">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <Card className="border border-gold-medium/30 bg-gradient-to-br from-gray-900 to-black">
                    <CardHeader className="text-center border-b border-gold-medium/20 pb-8 pt-10">
                        <CardTitle className="text-3xl font-bold flex items-center justify-center gap-3 text-white">
                            <CheckCircle2 className="w-8 h-8 text-green-500" />
                            Signed Visa Service Contract
                        </CardTitle>
                        <CardDescription className="text-lg mt-2 text-gold-light">
                            Agreement for {product?.name || 'Visa Service'}
                        </CardDescription>
                    </CardHeader>

                    <CardContent id="contract-content" className="p-6 md:p-10 space-y-10 text-justify text-gray-300">

                        {/* Status Banner */}
                        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="bg-green-500/20 p-2 rounded-full">
                                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                                </div>
                                <div>
                                    <p className="text-green-400 font-semibold">Payment Confirmed</p>
                                    <p className="text-xs text-green-300/70">Order #{order.order_number}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-gray-400">Method</p>
                                <p className="text-gold-light font-mono text-sm">{paymentMethodDisplay}</p>
                            </div>
                        </div>

                        {/* Client Info Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-gray-900/50 rounded-xl border border-gray-800">
                            <div className="space-y-1">
                                <p className="text-xs text-gray-500 uppercase tracking-wider">Client Name</p>
                                <p className="text-white font-medium text-lg">{order.client_name}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs text-gray-500 uppercase tracking-wider">Email</p>
                                <p className="text-white font-medium">{order.client_email}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs text-gray-500 uppercase tracking-wider">Nationality</p>
                                <p className="text-white font-medium">{order.client_nationality || 'N/A'}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs text-gray-500 uppercase tracking-wider">Signed At</p>
                                <p className="text-white font-medium">{signedDate}</p>
                            </div>
                        </div>

                        {/* Contract Body */}
                        <div>
                            <h2 className="text-xl font-bold text-gold-light mb-6 flex items-center gap-2 border-b border-gray-800 pb-2">
                                <FileText className="w-5 h-5" />
                                Terms and Conditions
                            </h2>
                            {contractContent ? (
                                <div
                                    className="prose prose-invert max-w-none prose-p:text-gray-300 hover:prose-a:text-gold-light"
                                    dangerouslySetInnerHTML={{ __html: contractContent }}
                                />
                            ) : (
                                <p className="text-red-400 italic">Content unavailable.</p>
                            )}
                        </div>

                        {/* Signature Section */}
                        <div className="pt-8 border-t border-gray-800">
                            <h3 className="text-lg font-semibold text-white mb-6">Digital Signature</h3>

                            <div className="flex flex-col md:flex-row gap-8 items-start">
                                {/* Visual Signature */}
                                <div className="flex-1">
                                    <p className="text-sm text-gray-500 mb-2">Signature</p>
                                    <div className="border border-gray-700 bg-white/5 rounded-lg p-6 inline-block min-w-[200px]">
                                        {imageUrls.signature ? (
                                            <img
                                                src={imageUrls.signature}
                                                alt="Client Signature"
                                                className="max-h-24 object-contain filter invert"
                                                draggable={false}
                                            />
                                        ) : (
                                            <p className="text-xl font-script text-white italic">{order.client_name}</p>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-600 mt-2">Digitally signed by IP: {order.ip_address || 'Unknown'}</p>
                                </div>

                                {/* Selfie Verification */}
                                {imageUrls.selfieDoc && (
                                    <div>
                                        <p className="text-sm text-gray-500 mb-2">Identity Verification (Selfie)</p>
                                        <div className="border border-gray-700 bg-black rounded-lg p-2 inline-block">
                                            <img
                                                src={imageUrls.selfieDoc}
                                                alt="Identity Verification"
                                                className="h-32 w-auto object-cover rounded"
                                                draggable={false}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Document Gallery (Compact) */}
                        {(imageUrls.documentFront || imageUrls.documentBack) && (
                            <div className="pt-8 border-t border-gray-800">
                                <h3 className="text-sm text-gray-500 uppercase tracking-wider mb-4">Submitted Documents</h3>
                                <div className="flex gap-4 overflow-x-auto pb-2">
                                    {imageUrls.documentFront && (
                                        <img
                                            src={imageUrls.documentFront}
                                            alt="ID Front"
                                            className="h-20 w-auto rounded border border-gray-700 hover:scale-150 transition-transform origin-bottom-left cursor-zoom-in bg-black"
                                        />
                                    )}
                                    {imageUrls.documentBack && (
                                        <img
                                            src={imageUrls.documentBack}
                                            alt="ID Back"
                                            className="h-20 w-auto rounded border border-gray-700 hover:scale-150 transition-transform origin-bottom-left cursor-zoom-in bg-black"
                                        />
                                    )}
                                </div>
                            </div>
                        )}

                    </CardContent>

                    <div className="bg-black/50 p-6 text-center border-t border-gold-medium/20 rounded-b-lg">
                        <p className="text-xs text-gray-500">
                            This document is securely stored and protected. Access is restricted to the authorized recipient.
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                            Contract ID: {order.id}
                        </p>
                    </div>
                </Card>
            </div>
        </div>
    );
};
