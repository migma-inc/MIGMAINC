import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export const WebsiteTerms = () => {
    return (
        <div className="min-h-screen bg-gradient-to-b from-black via-[#1a1a1a] to-black font-sans text-foreground">
            <Header />

            <section className="pt-[120px] pb-24">
                <div className="container max-w-4xl">
                    <div className="text-center mb-12">
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tighter migma-gold-text mb-4">
                            Website Terms of Use
                        </h1>
                        <p className="text-lg text-gray-400">
                            MIGMA Inc.
                        </p>
                    </div>

                    <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border-gold-medium/30">
                        <CardContent className="p-8 md:p-12 space-y-8">
                            <div className="space-y-4">
                                <p className="text-gray-300 leading-relaxed">
                                    These Website Terms of Use ("Terms") govern your access to and use of the website operated by MIGMA Inc. ("MIGMA", "we", "our", or "us"). By accessing or using this website, you agree to be bound by these Terms. If you do not agree, you must discontinue use of the website.
                                </p>
                            </div>

                            <Separator className="bg-gold-medium/30" />

                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">1. Acceptance of Terms</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    By accessing, browsing, or using this website, you acknowledge that you have read, understood, and agreed to these Terms, as well as our Privacy Policy and any other legal notices published on the website.
                                </p>
                            </div>

                            <Separator className="bg-gold-medium/30" />

                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">2. Use License</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    MIGMA grants you a limited, non-exclusive, non-transferable, and revocable license to access and use the website for informational and personal purposes only.
                                </p>
                                <p className="text-gray-300 leading-relaxed mt-4">
                                    You may not:
                                </p>
                                <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                                    <li>Modify, copy, reproduce, distribute, or republish website content without prior written consent</li>
                                    <li>Use the website for unlawful or prohibited purposes</li>
                                    <li>Attempt to gain unauthorized access to systems or data</li>
                                    <li>Use the website in a manner that could damage, disable, or impair its operation</li>
                                </ul>
                                <p className="text-gray-300 leading-relaxed mt-4">
                                    All intellectual property rights remain the exclusive property of MIGMA or its licensors.
                                </p>
                            </div>

                            <Separator className="bg-gold-medium/30" />

                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">3. Disclaimer</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    The content on this website is provided for general informational purposes only. MIGMA makes no warranties or representations regarding the accuracy, completeness, or reliability of any content.
                                </p>
                                <p className="text-gray-300 leading-relaxed mt-4">
                                    MIGMA does not provide legal, immigration, governmental, or regulatory services, and nothing on this website constitutes professional advice of any kind.
                                </p>
                                <p className="text-gray-300 leading-relaxed mt-4">
                                    Use of the website and reliance on its content is at your own risk.
                                </p>
                            </div>

                            <Separator className="bg-gold-medium/30" />

                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">4. Limitations of Liability</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    To the fullest extent permitted by law, MIGMA shall not be liable for any direct, indirect, incidental, consequential, or special damages arising out of or related to the use or inability to use this website, including but not limited to loss of data, revenue, or business opportunities.
                                </p>
                            </div>

                            <Separator className="bg-gold-medium/30" />

                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">5. Accuracy of Materials</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    While MIGMA strives to keep website content accurate and up to date, we do not warrant that all materials are current, complete, or free from errors. MIGMA reserves the right to modify content at any time without notice.
                                </p>
                            </div>

                            <Separator className="bg-gold-medium/30" />

                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">6. Links to Third-Party Websites</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    This website may contain links to third-party websites for convenience or informational purposes. MIGMA does not control, endorse, or assume responsibility for the content, policies, or practices of third-party websites.
                                </p>
                                <p className="text-gray-300 leading-relaxed mt-4">
                                    Access to third-party websites is at your own discretion and risk.
                                </p>
                            </div>

                            <Separator className="bg-gold-medium/30" />

                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">7. Modifications</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    MIGMA reserves the right to revise or update these Terms at any time without prior notice. Changes become effective upon publication on the website. Continued use of the website after updates constitutes acceptance of the revised Terms.
                                </p>
                            </div>

                            <Separator className="bg-gold-medium/30" />

                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">8. Governing Law</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    These Terms shall be governed by and construed in accordance with the laws of the State of Arizona, United States, without regard to conflict of law principles.
                                </p>
                            </div>

                            <Separator className="bg-gold-medium/30" />

                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">9. Contact</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    For questions regarding these Terms, please contact:
                                </p>
                                <p className="text-gray-300 leading-relaxed mt-2">
                                    <a href="mailto:adm@migmainc.com" className="text-gold-medium hover:text-gold-light transition">adm@migmainc.com</a>
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
