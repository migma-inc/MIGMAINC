import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase';
import { sendTermsAcceptanceConfirmationEmail } from '@/lib/emails';

export const PartnerTerms = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    
    const [accepted, setAccepted] = useState(false);
    const [tokenValid, setTokenValid] = useState<boolean | null>(null);
    const [tokenData, setTokenData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

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

    const handleAccept = async () => {
        if (!accepted || !token || !tokenValid) return;

        try {
            // Obter IP address
            const ipAddress = await getClientIP();

            // Atualizar registro de aceite no banco
            const { error: updateError } = await supabase
                .from('partner_terms_acceptances')
                .update({
                    accepted_at: new Date().toISOString(),
                    ip_address: ipAddress,
                })
                .eq('token', token);

            if (updateError) {
                console.error('Error updating acceptance:', updateError);
                alert("There was an error accepting the terms. Please try again.");
                return;
            }

            // Buscar email da aplicação para enviar confirmação
            if (tokenData?.application_id) {
                try {
                    const { data: applicationData } = await supabase
                        .from('global_partner_applications')
                        .select('email, full_name')
                        .eq('id', tokenData.application_id)
                        .single();

                    if (applicationData) {
                        // Enviar email de confirmação (não bloqueia o fluxo se falhar)
                        try {
                            await sendTermsAcceptanceConfirmationEmail(
                                applicationData.email,
                                applicationData.full_name
                            );
                        } catch (emailError) {
                            console.warn('Failed to send confirmation email:', emailError);
                        }
                    }
                } catch (error) {
                    console.warn('Could not fetch application data for email:', error);
                }
            }

            navigate('/partner-terms/success');
        } catch (error) {
            console.error("Error accepting terms:", error);
            alert("There was an error accepting the terms. Please try again.");
        }
    };

    return (
        <div className="min-h-screen bg-muted/30 font-sans text-foreground py-12">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                <Button variant="ghost" className="mb-6 pl-0 hover:bg-transparent hover:text-primary" onClick={() => navigate('/global-partner')}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Application
                </Button>

                <Card className="shadow-lg border-none">
                    <CardHeader className="text-center border-b bg-white rounded-t-lg pb-8 pt-10">
                        <CardTitle className="text-3xl font-bold">MIGMA Global Independent Contractor Terms & Conditions Agreement</CardTitle>
                        <CardDescription className="text-lg mt-4">
                            Please read this Agreement carefully. By accepting these Terms & Conditions, you agree to work with MIGMA as an independent contractor (not as an employee).
                        </CardDescription>
                        {!loading && !tokenValid && token && (
                            <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-md">
                                <p className="text-destructive text-sm">
                                    Invalid or expired token. Please contact MIGMA for a valid access link.
                                </p>
                            </div>
                        )}
                    </CardHeader>

                    <CardContent className="p-8 sm:p-12 space-y-8 text-justify leading-relaxed text-muted-foreground bg-white">
                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-foreground">1. Parties</h3>
                            <p>
                                This Agreement is entered into between MIGMA INC ("MIGMA" or "Company"), a company incorporated under the laws of the United States, and the Partner identified in the associated application ("Partner" or "Contractor"). Both parties agree to the terms and conditions set forth herein.
                            </p>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-foreground">2. Relationship (Independent Contractor)</h3>
                            <p>
                                The Partner is an independent contractor and not an employee of MIGMA. Nothing in this Agreement shall be construed to create a partnership, joint venture, or employer-employee relationship. The Partner shall be responsible for all taxes, social security contributions, and other obligations arising from payments made under this Agreement. The Partner acknowledges that they are not entitled to any employee benefits, including but not limited to health insurance, retirement benefits, or paid time off.
                            </p>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-foreground">3. Scope of Services</h3>
                            <p>
                                The Partner agrees to perform the services described in specific Statements of Work (SOW) or project assignments agreed upon by both parties. Services shall be performed in a professional manner consistent with industry standards. The Partner shall have the right to determine the method, details, and means of performing the services, subject to the results and deliverables specified by MIGMA.
                            </p>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-foreground">4. Compensation & Invoices</h3>
                            <p>
                                Compensation for services shall be as agreed upon in individual project agreements or SOWs. The Partner shall invoice MIGMA for services rendered in accordance with the payment terms specified in each project agreement. MIGMA shall pay invoices within the agreed payment terms, typically net 30 days from invoice date. The Partner is solely responsible for all taxes, withholdings, and reporting obligations related to compensation received under this Agreement.
                            </p>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-foreground">5. Confidentiality & Data Protection</h3>
                            <p>
                                The Partner agrees to keep confidential all proprietary information of MIGMA and its clients, including but not limited to business strategies, client information, financial data, technical information, and any other information marked as confidential or that would reasonably be considered confidential. The Partner shall comply with all applicable data protection laws, including GDPR, and shall implement appropriate security measures to protect confidential information. This obligation survives the termination of this Agreement.
                            </p>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-foreground">6. Intellectual Property</h3>
                            <p>
                                All work product, deliverables, inventions, improvements, and intellectual property created by the Partner in connection with the Services shall be the sole and exclusive property of MIGMA. The Partner hereby assigns all rights, title, and interest in such work product to MIGMA. The Partner agrees to execute any additional documents necessary to perfect MIGMA's ownership of such intellectual property.
                            </p>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-foreground">7. Non-Solicitation & Ethical Conduct</h3>
                            <p>
                                During the term of this Agreement and for a period of twelve (12) months thereafter, the Partner agrees not to solicit, directly or indirectly, any clients, employees, or contractors of MIGMA. The Partner shall conduct business in an ethical manner and comply with all applicable laws and regulations. The Partner shall not engage in any activity that could damage MIGMA's reputation or business interests.
                            </p>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-foreground">8. Term & Termination</h3>
                            <p>
                                This Agreement shall commence upon acceptance by the Partner and shall continue until terminated by either party with thirty (30) days written notice, or immediately upon breach of any material term of this Agreement. Upon termination, the Partner shall return all confidential information and materials belonging to MIGMA. Sections relating to confidentiality, intellectual property, and non-solicitation shall survive termination.
                            </p>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-foreground">9. No Exclusivity</h3>
                            <p>
                                This Agreement is non-exclusive. The Partner is free to provide services to other clients, provided that such services do not conflict with the Partner's obligations under this Agreement, violate confidentiality provisions, or compete directly with MIGMA's business interests. The Partner shall notify MIGMA of any potential conflicts of interest.
                            </p>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-foreground">10. Compliance & Legal Responsibility</h3>
                            <p>
                                The Partner represents and warrants that they have the legal capacity and authority to enter into this Agreement. The Partner shall comply with all applicable laws, regulations, and professional standards in the performance of services. The Partner shall maintain all necessary licenses, permits, and registrations required to perform the services. The Partner is solely responsible for their own business operations, including tax compliance, insurance, and legal obligations in their jurisdiction.
                            </p>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-foreground">11. Governing Law / Jurisdiction</h3>
                            <p>
                                This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law provisions. Any disputes arising under this Agreement shall be subject to the exclusive jurisdiction of the courts of Delaware. The Partner agrees to submit to the jurisdiction of such courts and waives any objection to venue.
                            </p>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-foreground">12. Digital Acceptance</h3>
                            <p>
                                By clicking "I Agree and Accept These Terms" below, the Partner acknowledges that they have read, understood, and agree to be bound by all terms and conditions of this Agreement. This digital acceptance shall have the same legal effect as a handwritten signature. The Partner acknowledges that they have had the opportunity to review this Agreement and consult with legal counsel if desired.
                            </p>
                        </div>

                        <div className="h-12" /> {/* Spacer */}
                    </CardContent>
                </Card>

                {/* Sticky Footer for Acceptance */}
                {!loading && tokenValid && (
                    <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50">
                        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="accept-terms"
                                    checked={accepted}
                                    onCheckedChange={(checked) => setAccepted(checked as boolean)}
                                />
                                <Label htmlFor="accept-terms" className="cursor-pointer font-medium">
                                    I have read and I agree to the MIGMA Global Independent Contractor Terms & Conditions.
                                </Label>
                            </div>
                            <Button onClick={handleAccept} disabled={!accepted} className="w-full sm:w-auto min-w-[200px]">
                                I Agree and Accept These Terms <Check className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </div>
                )}
                
                {!loading && !tokenValid && (
                    <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50">
                        <div className="max-w-3xl mx-auto text-center">
                            <p className="text-muted-foreground">
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
