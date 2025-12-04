import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase';
import { IdentityPhotoUpload } from '@/components/IdentityPhotoUpload';

export const PartnerTerms = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    
    const [accepted, setAccepted] = useState(false);
    const [tokenValid, setTokenValid] = useState<boolean | null>(null);
    const [tokenData, setTokenData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [identityPhotoPath, setIdentityPhotoPath] = useState<string | null>(null);
    const [identityPhotoName, setIdentityPhotoName] = useState<string | null>(null);
    const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);
    
    // Use refs to always have the latest values
    const identityPhotoPathRef = useRef<string | null>(null);
    const identityPhotoNameRef = useRef<string | null>(null);
    
    // Keep refs in sync with state
    useEffect(() => {
        identityPhotoPathRef.current = identityPhotoPath;
        identityPhotoNameRef.current = identityPhotoName;
    }, [identityPhotoPath, identityPhotoName]);

    // Validar token ao carregar a página
    useEffect(() => {
        const validateToken = async () => {
            if (!token) {
                setTokenValid(false);
                setLoading(false);
                return;
            }

            try {
                // Buscar token no banco
                const { data, error } = await supabase
                    .from('partner_terms_acceptances')
                    .select('*, application_id')
                    .eq('token', token)
                    .single();

                if (error || !data) {
                    setTokenValid(false);
                    setLoading(false);
                    return;
                }

                // Verificar se token expirou
                const now = new Date();
                const expiresAt = new Date(data.expires_at);
                if (now > expiresAt) {
                    setTokenValid(false);
                    setLoading(false);
                    return;
                }

                // Verificar se já foi aceito
                if (data.accepted_at) {
                    setTokenValid(false);
                    setLoading(false);
                    return;
                }

                setTokenValid(true);
                setTokenData(data);
            } catch (error) {
                console.error('Error validating token:', error);
                setTokenValid(false);
            } finally {
                setLoading(false);
            }
        };

        validateToken();
    }, [token]);

    const getClientIP = async (): Promise<string | null> => {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip || null;
        } catch (error) {
            console.warn('Could not fetch IP address:', error);
            return null;
        }
    };

    // Smooth scroll animation function
    const smoothScrollTo = (targetElement: HTMLElement, duration: number = 800) => {
        const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset;
        const startPosition = window.pageYOffset;
        const distance = targetPosition - startPosition;
        let startTime: number | null = null;

        const easeInOutCubic = (t: number): number => {
            return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        };

        const animation = (currentTime: number) => {
            if (startTime === null) startTime = currentTime;
            const timeElapsed = currentTime - startTime;
            const progress = Math.min(timeElapsed / duration, 1);
            const ease = easeInOutCubic(progress);

            window.scrollTo(0, startPosition + distance * ease);

            if (timeElapsed < duration) {
                requestAnimationFrame(animation);
            }
        };

        requestAnimationFrame(animation);
    };

    const handleAccept = async () => {
        if (!accepted || !token || !tokenValid) return;

        // Use refs to get the latest values (avoid closure issues)
        const currentPhotoPath = identityPhotoPathRef.current;
        const currentPhotoName = identityPhotoNameRef.current;
        
        // Verificar se foto foi enviada
        if (!currentPhotoPath || !currentPhotoName) {
            setPhotoUploadError('Please upload a photo with your identity document before accepting the terms.');
            return;
        }

        try {
            // Obter IP address e user agent
            const ipAddress = await getClientIP();
            const userAgent = navigator.userAgent;

            // Atualizar registro de aceite no banco
            console.log('[PARTNER TERMS] Updating acceptance with photo:', { 
                identityPhotoPath: currentPhotoPath, 
                identityPhotoName: currentPhotoName,
                token,
                termAcceptanceId: tokenData.id,
                stateIdentityPhotoPath: identityPhotoPath,
                stateIdentityPhotoName: identityPhotoName
            });
            

            const { data: updatedAcceptance, error: updateError } = await supabase
                .from('partner_terms_acceptances')
                .update({
                    accepted_at: new Date().toISOString(),
                    ip_address: ipAddress,
                    user_agent: userAgent,
                    identity_photo_path: currentPhotoPath,
                    identity_photo_name: currentPhotoName,
                })
                .eq('token', token)
                .select()
                .single();

            if (updateError) {
                console.error('[PARTNER TERMS] Error updating acceptance:', updateError);
                console.error('[PARTNER TERMS] Update error details:', {
                    code: updateError.code,
                    message: updateError.message,
                    details: updateError.details,
                    hint: updateError.hint
                });
                alert("There was an error accepting the terms. Please try again.");
                return;
            }

            console.log('[PARTNER TERMS] Acceptance updated successfully:', updatedAcceptance);
            console.log('[PARTNER TERMS] Updated fields:', {
                identity_photo_path: updatedAcceptance?.identity_photo_path,
                identity_photo_name: updatedAcceptance?.identity_photo_name,
                accepted_at: updatedAcceptance?.accepted_at
            });

            // Verify that the saved photo path matches what we just set
            if (updatedAcceptance?.identity_photo_path !== currentPhotoPath) {
                console.error('[PARTNER TERMS] Photo path mismatch!', {
                    expected: currentPhotoPath,
                    saved: updatedAcceptance?.identity_photo_path
                });
                alert('There was an error saving your photo. Please try uploading again.');
                return;
            }

            // Aguardar um pouco para garantir que o update foi persistido no banco
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Chamar Edge Function para gerar PDF do contrato (em background)
            if (tokenData?.application_id) {
                const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
                try {
                    console.log('[PARTNER TERMS] Triggering PDF generation:', {
                        application_id: tokenData.application_id,
                        term_acceptance_id: updatedAcceptance.id,
                        identity_photo_path: updatedAcceptance.identity_photo_path,
                        expected_photo_path: currentPhotoPath
                    });

                    fetch(`${SUPABASE_URL}/functions/v1/generate-contract-pdf`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                        },
                        body: JSON.stringify({
                            application_id: tokenData.application_id,
                            term_acceptance_id: updatedAcceptance.id,
                        }),
                        keepalive: true, // Mantém a requisição mesmo após navegação
                    }).catch(err => {
                        console.warn('Failed to trigger PDF generation:', err);
                    });
                } catch (pdfError) {
                    console.warn('Error triggering PDF generation:', pdfError);
                }
            }

            navigate('/partner-terms/success');
        } catch (error) {
            console.error("Error accepting terms:", error);
            alert("There was an error accepting the terms. Please try again.");
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-black via-[#1a1a1a] to-black font-sans text-foreground py-12">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                <Button variant="ghost" className="mb-6 pl-0 hover:bg-transparent text-gold-light hover:text-gold-medium" onClick={() => navigate('/global-partner')}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Application
                </Button>

                {/* Terms & Conditions Agreement - FIRST */}
                <Card className="mb-6 shadow-lg border border-gold-medium/30 bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10">
                    <CardHeader className="text-center border-b border-gold-medium/30 bg-gradient-to-r from-gold-dark via-gold-medium to-gold-dark rounded-t-lg pb-8 pt-10">
                        <CardTitle className="text-3xl font-bold flex items-center justify-center gap-2 text-white">
                            <span className="bg-white text-black rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold border border-gold-medium/50">1</span>
                            MIGMA Global Independent Contractor Terms & Conditions Agreement
                        </CardTitle>
                        <CardDescription className="text-lg mt-4 text-gold-light">
                            Please read this Agreement carefully. By accepting these Terms & Conditions, you agree to work with MIGMA as an independent contractor (not as an employee).
                        </CardDescription>
                        {!loading && !tokenValid && token && (
                            <div className="mt-4 p-4 bg-red-900/30 border border-red-500/50 rounded-md">
                                <p className="text-red-300 text-sm">
                                    Invalid or expired token. Please contact MIGMA for a valid access link.
                                </p>
                            </div>
                        )}
                    </CardHeader>

                    <CardContent className="p-8 sm:p-12 space-y-8 text-justify leading-relaxed text-gray-300">
                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-gold-light">1. Parties</h3>
                            <p>
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-gold-light">2. Relationship (Independent Contractor)</h3>
                            <p>
                                Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-gold-light">3. Scope of Services</h3>
                            <p>
                                Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-gold-light">4. Compensation & Invoices</h3>
                            <p>
                                Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur. Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-gold-light">5. Confidentiality & Data Protection</h3>
                            <p>
                                At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-gold-light">6. Intellectual Property</h3>
                            <p>
                                Et harum quidem rerum facilis est et expedita distinctio. Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor repellendus.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-gold-light">7. Non-Solicitation & Ethical Conduct</h3>
                            <p>
                                Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae. Itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-gold-light">8. Term & Termination</h3>
                            <p>
                                Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-gold-light">9. No Exclusivity</h3>
                            <p>
                                Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-gold-light">10. Compliance & Legal Responsibility</h3>
                            <p>
                                Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-gold-light">11. Governing Law / Jurisdiction</h3>
                            <p>
                                Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur. Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-gold-light">12. Digital Acceptance</h3>
                            <p>
                                At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi.
                            </p>
                        </div>

                        <div className="h-12" /> {/* Spacer */}
                    </CardContent>
                </Card>

                {/* Photo Upload Section - SECOND */}
                {!loading && tokenValid && (
                    <Card id="photo-upload-section" className="mb-6 shadow-xl border-2 border-gold-medium/50 bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10">
                        <CardHeader className="pb-6 bg-gradient-to-r from-gold-dark via-gold-medium to-gold-dark text-white rounded-t-lg">
                            <div className="flex items-center gap-3">
                                <span className="bg-white text-gold-medium rounded-full w-10 h-10 flex items-center justify-center text-xl font-bold shadow-lg">2</span>
                                <div>
                                    <CardTitle className="text-2xl font-bold text-white">
                                        Identity Verification Required
                                    </CardTitle>
                                    <CardDescription className="text-gold-light mt-1 text-base">
                                        Upload your photo before accepting the terms
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 sm:p-8">
                            <IdentityPhotoUpload
                                onUploadSuccess={(filePath, fileName) => {
                                    console.log('[PARTNER TERMS] Photo uploaded successfully:', { 
                                        filePath, 
                                        fileName,
                                        previousPath: identityPhotoPathRef.current,
                                        previousName: identityPhotoNameRef.current
                                    });
                                    // Update both state and refs to ensure we always have the latest value
                                    setIdentityPhotoPath(filePath);
                                    setIdentityPhotoName(fileName);
                                    identityPhotoPathRef.current = filePath;
                                    identityPhotoNameRef.current = fileName;
                                    setPhotoUploadError(null);
                                    console.log('[PARTNER TERMS] State and refs updated with new photo:', { filePath, fileName });
                                }}
                                onUploadError={(error) => {
                                    setPhotoUploadError(error);
                                }}
                                onRemove={() => {
                                    console.log('[PARTNER TERMS] Photo removed, clearing state');
                                    setIdentityPhotoPath(null);
                                    setIdentityPhotoName(null);
                                    identityPhotoPathRef.current = null;
                                    identityPhotoNameRef.current = null;
                                    setPhotoUploadError(null);
                                }}
                            />
                            
                            {photoUploadError && (
                                <div className="mt-4 p-4 bg-red-900/30 border-2 border-red-500/50 rounded-md">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="w-5 h-5 text-red-300 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-red-300 font-semibold">Upload Error</p>
                                            <p className="text-red-200 text-sm mt-1">{photoUploadError}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                        </CardContent>
                    </Card>
                )}

                {/* Sticky Footer for Acceptance */}
                {!loading && tokenValid && (
                    <div className="fixed bottom-0 left-0 right-0 bg-black/95 border-t border-gold-medium/30 p-4 shadow-[0_-4px_6px_-1px_rgba(206,159,72,0.3)] z-50">
                        <div className="max-w-3xl mx-auto">
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="accept-terms"
                                    checked={accepted}
                                    onCheckedChange={(checked) => {
                                        const isChecked = checked as boolean;
                                        setAccepted(isChecked);
                                        
                                        // If user checks the box but hasn't uploaded photo, smoothly scroll to photo section
                                        if (isChecked && !identityPhotoPath) {
                                            setTimeout(() => {
                                                const photoSection = document.getElementById('photo-upload-section');
                                                if (photoSection) {
                                                    // Use custom smooth scroll animation
                                                    smoothScrollTo(photoSection, 1000);
                                                }
                                            }, 150);
                                        }
                                    }}
                                />
                                    <Label htmlFor="accept-terms" className="cursor-pointer font-medium text-white">
                                    I have read and I agree to the MIGMA Global Independent Contractor Terms & Conditions.
                                </Label>
                            </div>
                                <Button 
                                    onClick={handleAccept} 
                                    disabled={!accepted || !identityPhotoPath} 
                                    className="w-full sm:w-auto min-w-[200px] bg-gradient-to-b from-gold-light via-gold-medium to-gold-light text-black font-bold hover:from-gold-medium hover:via-gold-light hover:to-gold-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg disabled:shadow-none"
                                >
                                I Agree and Accept These Terms <Check className="w-4 h-4 ml-2" />
                            </Button>
                            </div>
                        </div>
                    </div>
                )}
                
                {!loading && !tokenValid && (
                    <div className="fixed bottom-0 left-0 right-0 bg-black/95 border-t border-gold-medium/30 p-4 shadow-[0_-4px_6px_-1px_rgba(206,159,72,0.3)] z-50">
                        <div className="max-w-3xl mx-auto text-center">
                            <p className="text-gray-400">
                                {token ? 'Invalid or expired token. Please contact MIGMA for a valid access link.' : 'A valid token is required to accept these terms. Please contact MIGMA for access.'}
                            </p>
                        </div>
                    </div>
                )}

                {/* Spacer for sticky footer */}
                <div className="h-24" />
            </div>
        </div>
    );
};
