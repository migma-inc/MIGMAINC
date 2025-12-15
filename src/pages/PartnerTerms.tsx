import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase';
import { DocumentUpload } from '@/components/checkout/DocumentUpload';

export const PartnerTerms = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    
    const [accepted, setAccepted] = useState(false);
    const [tokenValid, setTokenValid] = useState<boolean | null>(null);
    const [tokenData, setTokenData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [identityPhotoPath, setIdentityPhotoPath] = useState<string | null>(null); // selfie URL
    const [identityPhotoName, setIdentityPhotoName] = useState<string | null>(null); // selfie file name
    const [documentFrontUrl, setDocumentFrontUrl] = useState<string | null>(null);
    const [documentBackUrl, setDocumentBackUrl] = useState<string | null>(null);
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
        
        // Verificar se todas as imagens foram enviadas (frente, verso e selfie)
        if (!documentFrontUrl || !documentBackUrl || !currentPhotoPath || !currentPhotoName) {
            setPhotoUploadError('Please upload the front and back of your document and a selfie holding the document before accepting the terms.');
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
                    identity_photo_path: currentPhotoPath, // selfie URL
                    identity_photo_name: currentPhotoName,
                    document_front_url: documentFrontUrl,
                    document_back_url: documentBackUrl,
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
                        <div className="space-y-2">
                            <p>
                                <strong>INDEPENDENT CONTRACTOR AGREEMENT – SALES REPRESENTATIVE CLOSER</strong>
                                <br />
                                Effective Date: Upon electronic acceptance of this Agreement.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">1. Parties</h3>
                            <p>
                                This Agreement is entered into between:
                                <br />
                                MIGMA INC., legal entity headquartered at
                                <br />
                                3435 Wilshire Blvd, Suite 1740, Los Angeles, CA 90010, USA
                                <br />
                                Email: adm@migmainc.com
                                <br />
                                hereinafter referred to as “Client”;
                                <br />
                                and
                                <br />
                                The Independent Contractor accepting this Agreement electronically,
                                <br />
                                hereinafter referred to as “Contractor”.
                                <br />
                                Together, the Parties shall be referred to as the “Parties.”
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">2. Purpose of Services</h3>
                            <p>
                                The Contractor is engaged to perform independent commercial and sales services for
                                MIGMA INC., which include, but are not limited to:
                            </p>
                            <p>
                                (i) Promoting, intermediating, presenting and closing sales of services offered by
                                the Client to leads of any nationality, acting as a closer during live meetings or
                                scheduled calls;
                                <br />
                                (ii) Conducting sales meetings through Zoom, Google Meet, or other videoconference
                                platforms designated by MIGMA, and performing follow-up communications with
                                prospects as needed;
                                <br />
                                (iii) Using technological tools, platforms, CRMs and artificial intelligence
                                systems developed or provided by the Client, accessed exclusively through personal
                                and non-transferable login credentials;
                                <br />
                                (iv) Issuing invoices for each sale completed, following MIGMA’s internal policies,
                                commission structure and billing procedures;
                                <br />
                                (v) Meeting the Client’s requirements for functional English, and where necessary,
                                intermediate or advanced proficiency, depending on the complexity of the sales
                                process and service category;
                                <br />
                                (vi) Performing all sales-related activities independently, without fixed working
                                hours, and delivering results consistent with MIGMA’s commercial standards.
                            </p>
                            <p>
                                The Contractor agrees to perform services in compliance with internal methodology,
                                standards, policies and performance targets established by MIGMA.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">3. Term</h3>
                            <p>
                                3.1 This Agreement begins on the date of Contractor acceptance and remains in force
                                indefinitely, unless terminated in accordance with this Agreement.
                                <br />
                                3.2 Either Party may terminate this Agreement at any time via written notice.
                                <br />
                                3.3 Upon termination, obligations cease as defined herein.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">4. Nature of Relationship</h3>
                            <p>
                                4.1 The Contractor acts as an independent service provider, and nothing in this
                                Agreement shall be construed as employment, joint venture, partnership, franchise or
                                agency. Nothing in this Agreement shall be interpreted as granting the Contractor
                                authority to bind MIGMA, represent MIGMA in legal matters, or act on behalf of MIGMA
                                beyond sales interactions strictly permitted under this Agreement.
                            </p>
                            <p>
                                4.2 The Contractor is responsible for:
                                <br />
                                • local taxes,
                                <br />
                                • compliance obligations,
                                <br />
                                • social contributions,
                                <br />
                                • insurance,
                                <br />
                                • and any applicable governmental filings.
                            </p>
                            <p>4.3 The Contractor acknowledges they do not receive employee benefits.</p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">
                                5. Autonomy and Compliance Obligations
                            </h3>
                            <p>
                                5.1 The Contractor shall have autonomy in organizing the means and methods of
                                performing the Services; however, all communications with clients, prospects or
                                leads must strictly follow MIGMA’s approved guidelines, compliance rules, immigration
                                restrictions, legal limitations, and training materials.
                            </p>
                            <p>
                                5.2 The Contractor is expressly prohibited from:
                                <br />
                                • providing immigration legal advice;
                                <br />
                                • making representations as a lawyer, attorney, agent or government representative;
                                <br />
                                • offering guarantees of visa approval;
                                <br />
                                • advising clients on unlawful or fraudulent practices.
                            </p>
                            <p>
                                5.3 Any violation of this clause constitutes material breach, resulting in immediate
                                termination and full liability for damages, including civil, administrative and
                                criminal exposure.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">6. Performance Requirements</h3>
                            <p>
                                6.1 The Contractor is not subject to fixed working hours. Instead, the Contractor
                                agrees to meet all daily performance requirements, including:
                            </p>
                            <p>
                                a) responding to leads within MIGMA’s required timeframe;
                                <br />
                                b) attending scheduled meetings and calls;
                                <br />
                                c) performing follow-ups and CRM updates promptly;
                                <br />
                                d) reaching daily, weekly and monthly targets established by MIGMA;
                                <br />
                                e) maintaining availability necessary to ensure continuity of service, regardless of
                                weekends, holidays or local schedules.
                            </p>
                            <p>
                                6.2 Failure to meet performance standards constitutes material breach and may result
                                in termination.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">7. Equipment / Costs</h3>
                            <p>
                                7.1 The Contractor provides all equipment, devices, software, tools and internet
                                connection required.
                                <br />
                                7.2 MIGMA will not reimburse operational or personal costs unless expressly agreed.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">
                                8. Compensation &amp; Payment Terms
                            </h3>
                            <p>
                                <strong>8.1 Fixed Compensation</strong>
                                <br />
                                Contractor will receive:
                                <br />
                                US$ 500.00 (five hundred US dollars) fixed monthly.
                            </p>
                            <p>
                                <strong>8.2 Commission – Sales Performance</strong>
                                <br />
                                Commissions are based on gross sales value generated monthly by the Contractor, as
                                follows:
                                <br />
                                Sales Volume (USD) – Commission (%)
                                <br />
                                Up to $4,999.99 – 0.5%
                                <br />
                                $5,000.00 – $9,999.99 – 1%
                                <br />
                                $10,000.00 – $14,999.99 – 2%
                                <br />
                                $15,000.00 – $19,999.99 – 3%
                                <br />
                                $20,000.00 – $24,999.99 – 4%
                                <br />
                                Above $25,000.00 – 5%
                                <br />
                                Commissions apply only upon full payment by the client to MIGMA.
                            </p>
                            <p>
                                <strong>8.3 Billing and Payment Rules</strong>
                                <br />
                                (a) The Contractor shall issue one monthly invoice to MIGMA covering all commissions
                                and service fees earned for the immediately preceding month.
                                <br />
                                (b) MIGMA’s Finance Department shall calculate, verify, and publish the Contractor’s
                                commission results for the period. The Contractor may view the data through the
                                dashboard, but MIGMA’s audited calculation shall prevail as final and binding.
                                <br />
                                (c) MIGMA shall pay the approved invoice within five (5) business days of the
                                following month. No payment shall be made without an issued invoice.
                                <br />
                                (d) Payments shall be made exclusively through international digital payment
                                platforms, including Wise, Stripe, or any other transfer platform selected by MIGMA
                                at its sole discretion. The Contractor must have an active account on the chosen
                                platform and shall provide accurate payment details. MIGMA shall not be responsible
                                for delays or failures caused by incorrect information or issues related to the
                                Contractor’s account.
                                <br />
                                (e) The Contractor is solely responsible for any taxes, transfer fees, platform
                                fees, or financial obligations related to their compensation.
                                <br />
                                (f) MIGMA shall not reimburse the Contractor for any expenses unless expressly
                                authorized in writing and in advance.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">
                                9. Non-Disclosure Agreement (NDA)
                            </h3>
                            <p>
                                The Contractor agrees not to disclose, share, reproduce or provide access to any
                                confidential information, including but not limited to:
                                <br />
                                • client data,
                                <br />
                                • financial records,
                                <br />
                                • procedures and scripts,
                                <br />
                                • training materials,
                                <br />
                                • immigration methodologies,
                                <br />
                                • AI systems and automations,
                                <br />
                                • business strategies,
                                <br />
                                • negotiations,
                                <br />
                                • pricing structures.
                                <br />
                                This obligation is perpetual and survives termination.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">
                                10. Non-Disclosure &amp; Non-Disparagement
                            </h3>
                            <p>
                                The Contractor agrees not to:
                                <br />
                                • disclose internal information,
                                <br />
                                • speak negatively about MIGMA publicly or privately,
                                <br />
                                • use MIGMA data for personal gain.
                                <br />
                                This obligation survives termination.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">
                                11. Confidentiality, Intellectual Property and Legal Penalties
                            </h3>
                            <p>
                                11.1 Any breach of confidentiality, unauthorized disclosure, or misuse of MIGMA’s
                                confidential information, data, client lists, scripts, automations, intellectual
                                property or technological systems constitutes a material breach.
                            </p>
                            <p>
                                11.2 Violations authorize MIGMA to:
                                <br />
                                i) Initiate civil and criminal proceedings in the United States (State of Arizona);
                                <br />
                                ii) Initiate proceedings in the Contractor’s country of residence;
                                <br />
                                iii) Seek damages and injunctive relief;
                                <br />
                                iv) Enforce a liquidated damages penalty of US$ 15,000.00 automatically upon breach.
                            </p>
                            <p>
                                11.3 All intellectual property developed, accessed or used by the Contractor during
                                this Agreement is exclusively owned by MIGMA.
                            </p>
                            <p>
                                11.4 The Contractor agrees not to copy, reproduce, store, transfer, make derivative
                                use of, or distribute any of MIGMA’s intellectual property under penalty of legal
                                action.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">
                                12. Exclusivity and Non-Compete
                            </h3>
                            <p>
                                12.1 During the term of this Agreement, the Contractor shall not provide services of
                                any kind to any immigration, visa consulting, educational placement, or related
                                company, unless such company is an official client, partner, or subcontracted
                                affiliate of MIGMA and expressly authorized in writing. This restriction exists to
                                prevent conflicts of interest, diversion of clients, and the misuse of confidential
                                information acquired through MIGMA.
                            </p>
                            <p>
                                12.2 The Contractor acknowledges that MIGMA will grant access to confidential
                                operational methods, scripts, processes, artificial intelligence systems, CRM
                                structures, and proprietary business strategies. Therefore, performing services for
                                competing entities during the term of this Agreement constitutes a direct
                                competitive conflict.
                            </p>
                            <p>
                                12.3 After termination of this Agreement, the Contractor is free to work for any
                                company in the immigration or visa industry, with no restriction, provided that the
                                Contractor:
                                <br />
                                (a) does not use or reproduce MIGMA’s confidential information, documents, client
                                lists, scripts, manuals, AI systems, workflows, training materials, or intellectual
                                property;
                                <br />
                                (b) does not solicit, contact, divert, or attempt to divert any MIGMA clients,
                                leads, prospects, employees, or partners for personal or third-party benefit;
                                <br />
                                (c) does not replicate or attempt to recreate MIGMA’s internal operational model,
                                artificial intelligence environment, technological framework, or proprietary
                                business methodology;
                                <br />
                                (d) does not establish a new business or entity that, intentionally or by structure,
                                constitutes a reproduction or direct derivation of MIGMA’s business model or
                                intellectual property.
                            </p>
                            <p>
                                12.4 Any violation of this clause, whether during the term of the Agreement or after
                                its termination, shall result in:
                                <br />
                                (i) liquidated damages in the amount of US$ 15,000.00 (fifteen thousand U.S.
                                dollars), automatically due upon breach;
                                <br />
                                (ii) the right of MIGMA to pursue civil and criminal actions both in the United
                                States (State of Arizona) and in the Contractor’s country of residence;
                                <br />
                                (iii) immediate termination of this Agreement, if still active, without prejudice to
                                additional remedies.
                            </p>
                            <p>
                                12.5 The obligations set forth in this clause survive termination of the Agreement
                                for as long as necessary to protect MIGMA’s confidential information, intellectual
                                property, technological assets, and economic interests.
                            </p>
                            <p>
                                12.6 Nothing in this clause shall be interpreted as restricting the Contractor’s
                                general freedom to work for competitors after the termination of this Agreement,
                                provided the restrictions above are fully respected.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">13. Non-Solicitation</h3>
                            <p>
                                13.1 The Contractor shall not, during the term of this Agreement and for 24 months
                                after termination:
                                <br />
                                (a) solicit, contact, divert or attempt to divert any MIGMA client, lead, prospect
                                or partner for personal benefit or for the benefit of third parties;
                                <br />
                                (b) provide services directly or indirectly to any MIGMA client without MIGMA’s
                                written authorization;
                                <br />
                                (c) engage in private negotiations, side deals or agreements with MIGMA clients or
                                leads.
                            </p>
                            <p>
                                13.2 Violation results in:
                                <br />
                                • Automatic penalty of US$ 15,000.00;
                                <br />
                                • Legal action in the United States and abroad;
                                <br />
                                • Permanent ban from MIGMA network.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">
                                14. Indemnity, Liability and Regress
                            </h3>
                            <p>
                                14.1 The Contractor shall fully indemnify and hold MIGMA harmless from any loss,
                                damage, claim, complaint, legal action, penalty, administrative sanction or
                                liability arising from:
                                <br />
                                • errors, omissions, misrepresentations or misconduct;
                                <br />
                                • unlawful advice, fraudulent statements or misguidance to clients;
                                <br />
                                • violations of immigration or consular regulations;
                                <br />
                                • breaches of compliance or operational standards;
                                <br />
                                • acts of negligence or intentional misconduct.
                            </p>
                            <p>
                                14.2 If any client or governmental authority initiates administrative, civil, labor,
                                tax or criminal proceedings against MIGMA due to acts attributable to the
                                Contractor, MIGMA may:
                                <br />
                                i) retain any payments owed to the Contractor until full resolution of the matter;
                                <br />
                                ii) demand immediate reimbursement of any amounts paid by MIGMA;
                                <br />
                                iii) enforce liquidated damages and legal penalties.
                            </p>
                            <p>
                                14.3 The Contractor must reimburse MIGMA for all expenses resulting from such
                                proceedings, including:
                                <br />
                                • attorney fees,
                                <br />
                                • court costs,
                                <br />
                                • settlements,
                                <br />
                                • damages,
                                <br />
                                • fines,
                                <br />
                                • immigration penalties,
                                <br />
                                • appeal deposits.
                                <br />
                                Payment must be made within 72 hours of MIGMA’s written request.
                            </p>
                            <p>
                                14.4 Failure to comply authorizes immediate termination and legal action for
                                recovery.
                            </p>
                            <p>14.5 The Contractor assumes full responsibility for any actions taken by subcontractors or collaborators.</p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">15. Subcontracting</h3>
                            <p>
                                The Contractor may subcontract assistance only with prior written consent, and
                                remains fully liable.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">16. Return of Property</h3>
                            <p>
                                Upon termination, the Contractor must:
                                <br />
                                • return all materials;
                                <br />
                                • delete access credentials;
                                <br />
                                • cease representation of MIGMA immediately.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">17. Termination</h3>
                            <p>
                                17.1 Either Party may terminate this Agreement at any time, with or without cause,
                                by written notice delivered electronically.
                            </p>
                            <p>
                                17.2 Upon termination, the Contractor shall:
                                <br />
                                (a) immediately cease representing MIGMA;
                                <br />
                                (b) return or delete all confidential information, documents, logins and client
                                data;
                                <br />
                                (c) finalize any pending administrative tasks only if expressly authorized by MIGMA;
                                <br />
                                (d) lose entitlement to any unpaid commissions related to sales that were not fully
                                paid to MIGMA by clients.
                            </p>
                            <p>
                                17.3 MIGMA may terminate this Agreement immediately, without prior notice, in cases
                                of:
                                <br />
                                (a) breach of confidentiality, non-compete, compliance or intellectual property
                                clauses;
                                <br />
                                (b) misconduct, misrepresentation or unethical behavior;
                                <br />
                                (c) fraud, unlawful immigration advice or violation of U.S. or foreign laws;
                                <br />
                                (d) reputational risk to MIGMA;
                                <br />
                                (e) client complaints involving negligence or malpractice;
                                <br />
                                (f) failure to meet performance requirements.
                            </p>
                            <p>
                                17.4 Termination does not exempt the Contractor from financial liabilities,
                                indemnities, penalties or damages owed to MIGMA under this Agreement.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">18. Amendments</h3>
                            <p>
                                Any amendment must be:
                                <br />
                                • in writing,
                                <br />
                                • digitally acknowledged by Contractor, and
                                <br />
                                • issued by MIGMA.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">19. Notices</h3>
                            <p>All notices must be sent in writing to: adm@migmainc.com</p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">20. Assignment</h3>
                            <p>The Contractor may not assign obligations without express written consent.</p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">21. Entire Agreement</h3>
                            <p>This document constitutes the entire agreement and supersedes all prior declarations.</p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">22. Governing Law</h3>
                            <p>
                                This Agreement is governed by the laws of the State of Arizona, United States of
                                America.
                            </p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">23. Severability</h3>
                            <p>If any provision becomes invalid, the remaining provisions continue in effect.</p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">24. Waiver</h3>
                            <p>A waiver of breach does not waive future breaches.</p>
                        </div>

                        <Separator className="bg-gold-medium/30" />

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-gold-light">25. Execution</h3>
                            <p>
                                This Agreement is fully effective upon Contractor electronic acceptance, without
                                requiring signature from MIGMA INC.
                            </p>
                        </div>

                        <div className="h-12" /> {/* Spacer */}
                    </CardContent>
                </Card>

                {/* Document + Selfie Upload Section - SECOND */}
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
                                        Upload the front and back of your document and a selfie holding the document before accepting the terms.
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 sm:p-8">
                            <DocumentUpload
                                onComplete={({ documentFront, documentBack, selfie }) => {
                                    console.log('[PARTNER TERMS] Documents uploaded successfully:', {
                                        documentFrontUrl: documentFront.url,
                                        documentBackUrl: documentBack.url,
                                        selfieUrl: selfie.url,
                                    });
                                    setDocumentFrontUrl(documentFront.url);
                                    setDocumentBackUrl(documentBack.url);
                                    setIdentityPhotoPath(selfie.url);
                                    setIdentityPhotoName(selfie.file.name);
                                    identityPhotoPathRef.current = selfie.url;
                                    identityPhotoNameRef.current = selfie.file.name;
                                    setPhotoUploadError(null);
                                }}
                                onCancel={() => {
                                    console.log('[PARTNER TERMS] Documents upload canceled, clearing state');
                                    setDocumentFrontUrl(null);
                                    setDocumentBackUrl(null);
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
                                        
                                        // If user checks the box but hasn't uploaded all photos, smoothly scroll to photo section
                                        if (isChecked && (!documentFrontUrl || !documentBackUrl || !identityPhotoPath)) {
                                            setTimeout(() => {
                                                const photoSection = document.getElementById('photo-upload-section');
                                                if (photoSection) {
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
                                    disabled={!accepted || !documentFrontUrl || !documentBackUrl || !identityPhotoPath} 
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
