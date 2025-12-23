import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, FileText, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useContentProtection } from '@/hooks/useContentProtection';
import { validateContractViewToken, getContractViewData } from '@/lib/contract-view';
import { formatContractTextToHtml } from '@/lib/contract-formatter';
import { supabase } from '@/lib/supabase';

export const ViewSignedContract = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [contractData, setContractData] = useState<any>(null);
  const [contractContent, setContractContent] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<{
    signature?: string;
    documentFront?: string;
    documentBack?: string;
    identityPhoto?: string;
  }>({});

  // Aplicar proteções de conteúdo quando token é válido
  useContentProtection(tokenValid === true);

  // Adicionar proteção de impressão CSS
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
      if (style) {
        style.remove();
      }
    };
  }, [tokenValid]);

  // Validar token e carregar dados
  useEffect(() => {
    const loadContract = async () => {
      setLoading(true);

      if (!token) {
        setTokenValid(false);
        setLoading(false);
        return;
      }

      try {
        // Validar token
        const validation = await validateContractViewToken(token);
        if (!validation) {
          setTokenValid(false);
          setLoading(false);
          return;
        }

        setTokenValid(true);

        // Buscar dados do contrato
        const data = await getContractViewData(validation.acceptance.id);
        if (!data) {
          setTokenValid(false);
          setLoading(false);
          return;
        }

        setContractData(data);

        // Formatar conteúdo do contrato
        if (data.contractContent) {
          const formatted = formatContractTextToHtml(data.contractContent);
          setContractContent(formatted);
        }

        // Obter URLs das imagens
        const urls: typeof imageUrls = {};

        // Assinatura
        if (data.acceptance.signature_image_url) {
          if (data.acceptance.signature_image_url.startsWith('http')) {
            urls.signature = data.acceptance.signature_image_url;
          } else {
            // Assinatura pode estar em 'partner-signatures' ou 'identity-photos'
            // Tentar primeiro partner-signatures (onde é salva)
            let urlData;
            if (data.acceptance.signature_image_url.includes('signatures/')) {
              const result = supabase.storage
                .from('partner-signatures')
                .getPublicUrl(data.acceptance.signature_image_url);
              urlData = result.data;
            } else {
              const result = supabase.storage
                .from('identity-photos')
                .getPublicUrl(data.acceptance.signature_image_url);
              urlData = result.data;
            }
            urls.signature = urlData?.publicUrl;
          }
        }

        // Documento frente
        if (data.acceptance.document_front_url) {
          if (data.acceptance.document_front_url.startsWith('http')) {
            urls.documentFront = data.acceptance.document_front_url;
          } else {
            const { data: urlData } = supabase.storage
              .from('identity-photos')
              .getPublicUrl(data.acceptance.document_front_url);
            urls.documentFront = urlData?.publicUrl;
          }
        }

        // Documento verso
        if (data.acceptance.document_back_url) {
          if (data.acceptance.document_back_url.startsWith('http')) {
            urls.documentBack = data.acceptance.document_back_url;
          } else {
            const { data: urlData } = supabase.storage
              .from('identity-photos')
              .getPublicUrl(data.acceptance.document_back_url);
            urls.documentBack = urlData?.publicUrl;
          }
        }

        // Selfie com documento
        if (data.acceptance.identity_photo_path) {
          if (data.acceptance.identity_photo_path.startsWith('http')) {
            urls.identityPhoto = data.acceptance.identity_photo_path;
          } else {
            const { data: urlData } = supabase.storage
              .from('identity-photos')
              .getPublicUrl(data.acceptance.identity_photo_path);
            urls.identityPhoto = urlData?.publicUrl;
          }
        }

        setImageUrls(urls);
      } catch (error) {
        console.error('[VIEW_CONTRACT] Error loading contract:', error);
        setTokenValid(false);
      } finally {
        setLoading(false);
      }
    };

    loadContract();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black via-[#1a1a1a] to-black flex items-center justify-center py-24 px-4">
        <Card className="max-w-4xl w-full border border-gold-medium/30 shadow-2xl bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 backdrop-blur-sm">
          <CardContent className="p-8 sm:p-12">
            <div className="space-y-6 animate-pulse">
              <div className="h-8 bg-gold-medium/20 rounded w-3/4 mx-auto"></div>
              <div className="h-4 bg-gold-medium/10 rounded w-1/2 mx-auto"></div>
              <div className="space-y-4 mt-8">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="h-4 bg-gold-medium/10 rounded" style={{ width: `${Math.random() * 40 + 60}%` }}></div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!tokenValid || !contractData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black via-[#1a1a1a] to-black flex items-center justify-center py-24 px-4">
        <Card className="max-w-2xl w-full border border-red-500/30 shadow-2xl bg-gradient-to-br from-red-900/10 via-red-800/5 to-red-900/10 backdrop-blur-sm">
          <CardContent className="p-8 sm:p-12 text-center">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-6" />
            <h1 className="text-3xl md:text-4xl font-bold mb-4 text-red-300">
              Invalid or Expired Link
            </h1>
            <p className="text-lg text-gray-300 mb-4">
              This contract viewing link is invalid or has expired.
            </p>
            <p className="text-base text-gray-400 mb-8">
              Please contact MIGMA support for a new access link.
            </p>
            <Button
              onClick={() => navigate('/global-partner')}
              className="bg-gradient-to-b from-gold-light via-gold-medium to-gold-light text-black font-bold hover:from-gold-medium hover:via-gold-light hover:to-gold-medium transition-all shadow-lg"
            >
              Go to MIGMA Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const acceptance = contractData.acceptance;
  const application = contractData.application;

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-[#1a1a1a] to-black py-12 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <Card className="border border-gold-medium/30 shadow-2xl bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 backdrop-blur-sm">
          <CardHeader
            id="contract-header"
            className="text-center border-b border-gold-medium/30 bg-gradient-to-r from-gold-dark via-gold-medium to-gold-dark rounded-t-lg pb-8 pt-10"
            style={{
              userSelect: 'none',
              WebkitUserSelect: 'none',
              MozUserSelect: 'none',
              msUserSelect: 'none',
            }}
          >
            <CardTitle className="text-3xl font-bold flex items-center justify-center gap-2 text-white">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
              Your Signed Contract
            </CardTitle>
            <CardDescription className="text-lg mt-4 text-gold-light">
              This is your signed MIGMA Global Independent Contractor Agreement
            </CardDescription>
          </CardHeader>

          <CardContent
            id="contract-content"
            className="p-8 sm:p-12 space-y-8 text-justify leading-relaxed text-gray-300 contract-protected"
            style={{
              userSelect: 'none',
              WebkitUserSelect: 'none',
              MozUserSelect: 'none',
              msUserSelect: 'none',
            }}
          >
            {/* Contract Information */}
            <div className="mb-8 p-6 bg-black/30 rounded-lg border border-gold-medium/20">
              <h2 className="text-xl font-bold text-gold-light mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Contract Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Contractor Name:</span>
                  <span className="text-white ml-2 font-semibold">{application?.full_name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-400">Email:</span>
                  <span className="text-white ml-2">{application?.email || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-400">Phone:</span>
                  <span className="text-white ml-2">{application?.phone || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-400">Country:</span>
                  <span className="text-white ml-2">{application?.country || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-400">Signed At:</span>
                  <span className="text-white ml-2">
                    {acceptance.accepted_at
                      ? new Date(acceptance.accepted_at).toLocaleString()
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Contract Content */}
            {contractContent ? (
              <div
                className="prose prose-invert max-w-none prose-p:my-4 prose-p:leading-relaxed prose-strong:text-gold-light"
                style={{ lineHeight: '1.75' }}
                dangerouslySetInnerHTML={{ __html: contractContent }}
              />
            ) : (
              <div className="p-6 bg-red-900/30 border-2 border-red-500/50 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-lg font-semibold text-red-300 mb-2">Contract Content Unavailable</h3>
                    <p className="text-red-200">Contract content could not be loaded. Please contact support.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Signature Section */}
            {(acceptance.signature_name || imageUrls.signature) && (
              <div className="mt-12 pt-8 border-t border-gold-medium/30">
                <h3 className="text-xl font-bold text-gold-light mb-6 flex items-center gap-2">
                  <FileText className="w-6 h-6" />
                  Digital Signature
                </h3>
                <div className="space-y-4">
                  {imageUrls.signature ? (
                    <div className="mb-6">
                      <p className="text-sm text-gray-400 mb-3">Signature Image:</p>
                      <div className="border-2 border-gold-medium/50 rounded-lg p-6 bg-black/30 inline-block max-w-full">
                        <img
                          src={imageUrls.signature}
                          alt="Digital Signature"
                          className="max-w-full h-auto"
                          style={{ 
                            userSelect: 'none', 
                            pointerEvents: 'none',
                            maxHeight: '300px',
                            objectFit: 'contain'
                          }}
                          draggable={false}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4 p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                      <p className="text-yellow-300 text-sm">Signature image not available</p>
                    </div>
                  )}
                  {acceptance.signature_name && (
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Signed By:</p>
                      <p className="text-lg font-semibold text-white">{acceptance.signature_name}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Documents Gallery */}
            {(imageUrls.documentFront || imageUrls.documentBack || imageUrls.identityPhoto) && (
              <div className="mt-12 pt-8 border-t border-gold-medium/30">
                <h3 className="text-xl font-bold text-gold-light mb-6 flex items-center gap-2">
                  <ImageIcon className="w-6 h-6" />
                  Identity Documents
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {imageUrls.documentFront && (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-400">Document Front</p>
                      <div className="border border-gold-medium/30 rounded-lg p-2 bg-black/20">
                        <img
                          src={imageUrls.documentFront}
                          alt="Document Front"
                          className="w-full h-auto rounded"
                          style={{ userSelect: 'none', pointerEvents: 'none' }}
                          draggable={false}
                        />
                      </div>
                    </div>
                  )}
                  {imageUrls.documentBack && (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-400">Document Back</p>
                      <div className="border border-gold-medium/30 rounded-lg p-2 bg-black/20">
                        <img
                          src={imageUrls.documentBack}
                          alt="Document Back"
                          className="w-full h-auto rounded"
                          style={{ userSelect: 'none', pointerEvents: 'none' }}
                          draggable={false}
                        />
                      </div>
                    </div>
                  )}
                  {imageUrls.identityPhoto && (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-400">Identity Photo</p>
                      <div className="border border-gold-medium/30 rounded-lg p-2 bg-black/20">
                        <img
                          src={imageUrls.identityPhoto}
                          alt="Identity Photo"
                          className="w-full h-auto rounded"
                          style={{ userSelect: 'none', pointerEvents: 'none' }}
                          draggable={false}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-12 pt-8 border-t border-gold-medium/30 text-center text-sm text-gray-400">
              <p>This document is protected and available exclusively through the MIGMA portal.</p>
              <p className="mt-2">
                Generated on {new Date().toLocaleString()} | Contract ID: {acceptance.id.substring(0, 8)}...
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Back Button */}
        <div className="text-center">
          <Button
            onClick={() => navigate('/global-partner')}
            variant="outline"
            className="border-gold-medium/50 bg-black/50 text-white hover:bg-gold-medium/30 hover:text-gold-light"
          >
            Back to MIGMA Homepage
          </Button>
        </div>
      </div>
    </div>
  );
};

