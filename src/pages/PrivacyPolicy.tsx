import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export const PrivacyPolicy = () => {
    return (
        <div className="min-h-screen bg-gradient-to-b from-black via-[#1a1a1a] to-black font-sans text-foreground">
            <Header />

            <section className="pt-[120px] pb-24">
                <div className="container max-w-4xl">
                    <div className="text-center mb-12">
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tighter migma-gold-text mb-4">
                            Privacy Policy
                        </h1>
                        <p className="text-lg text-gray-400">
                            Last updated: December 17
                        </p>
                    </div>

                    <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border-gold-medium/30">
                        <CardContent className="p-8 md:p-12 space-y-8">
                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">1. Purpose</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    MIGMA Inc. ("MIGMA", "we", "our") respects the privacy of individuals whose personal data we process and is committed to protecting such data in accordance with applicable data protection laws.
                                </p>
                                <p className="text-gray-300 leading-relaxed">
                                    This Privacy Policy explains how we collect, use, store, share, and protect personal data when you access our website, contact us, or use our educational consulting and mentoring services.
                                </p>
                            </div>

                            <Separator className="bg-gold-medium/30" />

                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">2. Data Controller</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    For the purposes of applicable data protection laws, MIGMA Inc. is the data controller responsible for decisions regarding the processing of personal data.
                                </p>
                                <div className="mt-4 space-y-2 text-gray-300">
                                    <p><strong className="text-gold-medium">Company:</strong> MIGMA Inc.</p>
                                    <p><strong className="text-gold-medium">Contact:</strong> adm@migmainc.com</p>
                                </div>
                            </div>

                            <Separator className="bg-gold-medium/30" />

                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">3. Personal Data We Collect</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    We collect only personal data that is necessary and relevant for the provision of our services and for legitimate business purposes. The categories of personal data we may collect include:
                                </p>
                                <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                                    <li>Full name</li>
                                    <li>Email address</li>
                                    <li>Phone number</li>
                                    <li>Country of residence</li>
                                    <li>Professional or academic background (as voluntarily provided)</li>
                                    <li>Payment and billing information (processed by third-party payment providers)</li>
                                    <li>Communications exchanged with us</li>
                                    <li>Technical data such as IP address, browser type, device information, and usage data</li>
                                </ul>
                                <div className="mt-4 p-4 bg-gold-dark/10 border border-gold-medium/20 rounded-lg">
                                    <p className="text-gray-300 leading-relaxed">
                                        <strong className="text-gold-medium">⚠ Note:</strong> MIGMA does not intentionally collect sensitive personal data, such as racial or ethnic origin, religious beliefs, political opinions, health data, biometric or genetic data.
                                    </p>
                                </div>
                            </div>

                            <Separator className="bg-gold-medium/30" />

                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">4. Purpose of Data Processing</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    We process personal data for the following purposes:
                                </p>
                                <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                                    <li>Providing educational consulting, mentoring, and advisory services</li>
                                    <li>Responding to inquiries and providing customer support</li>
                                    <li>Managing contractual relationships and onboarding processes</li>
                                    <li>Processing payments through authorized payment providers</li>
                                    <li>Improving our website, services, and user experience</li>
                                    <li>Fulfilling legal, regulatory, and compliance obligations</li>
                                    <li>Preventing fraud, misuse, and unauthorized access</li>
                                    <li>Exercising or defending legal rights</li>
                                </ul>
                            </div>

                            <Separator className="bg-gold-medium/30" />

                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">5. Legal Basis for Processing</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    Depending on the applicable jurisdiction, personal data is processed based on one or more of the following legal grounds:
                                </p>
                                <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                                    <li>Performance of a contract or pre-contractual measures</li>
                                    <li>Legitimate interests of MIGMA</li>
                                    <li>Compliance with legal or regulatory obligations</li>
                                    <li>Consent, when required</li>
                                </ul>
                            </div>

                            <Separator className="bg-gold-medium/30" />

                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">6. Data Sharing</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    MIGMA may share personal data only when necessary and limited to the purposes described in this Policy, including with:
                                </p>
                                <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                                    <li>Payment processors and financial institutions</li>
                                    <li>Technology and cloud service providers</li>
                                    <li>Professional advisors (legal, accounting, compliance)</li>
                                    <li>Authorities or regulators when legally required</li>
                                    <li>Business partners strictly involved in service delivery</li>
                                </ul>
                                <p className="text-gray-300 leading-relaxed mt-4">
                                    All third parties are subject to contractual confidentiality and data protection obligations.
                                </p>
                            </div>

                            <Separator className="bg-gold-medium/30" />

                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">7. International Data Transfers</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    As an international company, MIGMA may process or store personal data outside the data subject's country of residence, including in the United States and other jurisdictions. Whenever international transfers occur, MIGMA adopts appropriate safeguards to ensure data protection consistent with applicable laws.
                                </p>
                            </div>

                            <Separator className="bg-gold-medium/30" />

                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">8. Data Retention</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    Personal data is retained only for as long as necessary to fulfill the purposes described in this Policy, including compliance with legal, accounting, and regulatory requirements. Data may be deleted or anonymized once it is no longer required, unless retention is legally mandated.
                                </p>
                            </div>

                            <Separator className="bg-gold-medium/30" />

                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">9. Data Security</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    MIGMA implements reasonable technical, administrative, and organizational measures to protect personal data against unauthorized access, loss, misuse, alteration, or disclosure. While we strive to protect personal data, no system is completely secure. Users should notify us immediately of any suspected security incident.
                                </p>
                            </div>

                            <Separator className="bg-gold-medium/30" />

                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">10. Data Subject Rights</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    Depending on applicable law, data subjects may have the right to:
                                </p>
                                <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                                    <li>Access their personal data</li>
                                    <li>Correct inaccurate or incomplete data</li>
                                    <li>Request deletion or restriction of processing</li>
                                    <li>Object to processing</li>
                                    <li>Request data portability</li>
                                    <li>Withdraw consent where applicable</li>
                                </ul>
                                <p className="text-gray-300 leading-relaxed mt-4">
                                    Requests may be submitted via adm@migmainc.com. Certain requests may be limited where legally permitted.
                                </p>
                            </div>

                            <Separator className="bg-gold-medium/30" />

                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">11. Cookies and Tracking Technologies</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    Our website may use cookies and similar technologies to ensure proper functionality, analyze usage, and improve user experience. Users may control cookie preferences through browser settings. Disabling cookies may affect website functionality.
                                </p>
                            </div>

                            <Separator className="bg-gold-medium/30" />

                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">12. Third-Party Websites</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    Our website may contain links to third-party websites. MIGMA is not responsible for the privacy practices or content of such websites. Users are encouraged to review third-party privacy policies.
                                </p>
                            </div>

                            <Separator className="bg-gold-medium/30" />

                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">13. Children's Data</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    MIGMA does not knowingly collect personal data from children under the age of 13. Given the nature of our educational services, clients between the ages of 13 and 18 should review this Privacy Policy with their parents or legal guardians. If we become aware that we have collected personal data from a child under 13 without verification of parental consent, we will take steps to delete that information.
                                </p>
                            </div>

                            <Separator className="bg-gold-medium/30" />

                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">14. Changes to This Policy</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    MIGMA may update this Privacy Policy from time to time. The updated version will be published on our website with the revised date.
                                </p>
                            </div>

                            <Separator className="bg-gold-medium/30" />

                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">15. Contact</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    For questions, requests, or concerns regarding this Privacy Policy or personal data processing, please contact:
                                </p>
                                <p className="text-gray-300 leading-relaxed mt-2">
                                    <strong className="text-gold-medium">📧</strong> <a href="mailto:adm@migmainc.com" className="text-gold-medium hover:text-gold-light transition">adm@migmainc.com</a>
                                </p>
                                <p className="text-gray-400 text-sm mt-6">
                                    © MIGMA Inc. – All rights reserved.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>

            <Footer />
        </div>
    );
};
