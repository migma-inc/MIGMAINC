import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export const Cookies = () => {
    return (
        <div className="min-h-screen bg-gradient-to-b from-black via-[#1a1a1a] to-black font-sans text-foreground">
            <Header />

            <section className="pt-[120px] pb-24">
                <div className="container max-w-4xl">
                    <div className="text-center mb-12">
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tighter migma-gold-text mb-4">
                            Cookies Policy
                        </h1>
                        <p className="text-lg text-gray-400">
                            Last updated: December 17
                        </p>
                    </div>

                    <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border-gold-medium/30">
                        <CardContent className="p-8 md:p-12 space-y-8">
                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">1. What Are Cookies</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    Cookies are small text files stored on your device when you visit a website. They are widely used to ensure websites function properly, improve user experience, and provide information to website owners about how their sites are used.
                                </p>
                            </div>

                            <Separator className="bg-gold-medium/30" />

                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">2. How We Use Cookies</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    MIGMA Inc. uses cookies to operate and maintain our website, analyze website traffic and performance, enhance functionality, and improve the overall user experience. Cookies help us understand how visitors interact with our website so we can improve content and usability.
                                </p>
                            </div>

                            <Separator className="bg-gold-medium/30" />

                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">3. Types of Cookies We Use</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    We may use the following categories of cookies:
                                </p>
                                <div className="space-y-4 mt-4">
                                    <div>
                                        <h3 className="text-xl font-semibold text-gold-medium mb-2">Essential Cookies:</h3>
                                        <p className="text-gray-300 leading-relaxed">
                                            Necessary for the proper functioning of the website. These cookies enable core features such as security, page navigation, and access to protected areas.
                                        </p>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-semibold text-gold-medium mb-2">Analytics Cookies:</h3>
                                        <p className="text-gray-300 leading-relaxed">
                                            Used to collect aggregated and anonymous information about how visitors use the website, such as pages visited and time spent on the site. This data helps us improve website performance and user experience.
                                        </p>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-semibold text-gold-medium mb-2">Functional Cookies:</h3>
                                        <p className="text-gray-300 leading-relaxed">
                                            Allow the website to remember user preferences and settings to provide enhanced and personalized features.
                                        </p>
                                    </div>
                                </div>
                                <p className="text-gray-300 leading-relaxed mt-4">
                                    MIGMA does not use cookies to directly identify individuals or collect sensitive personal data.
                                </p>
                            </div>

                            <Separator className="bg-gold-medium/30" />

                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">4. Managing Cookies</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    You can manage or disable cookies through your browser settings at any time. Please note that disabling certain cookies may affect the functionality and performance of the website.
                                </p>
                            </div>

                            <Separator className="bg-gold-medium/30" />

                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">5. Third-Party Cookies</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    Our website may use third-party cookies provided by trusted service providers for analytics and performance purposes. These third parties process data in accordance with their own privacy policies, and MIGMA does not control or assume responsibility for their cookie practices.
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
