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
                            Last updated: {new Date().toLocaleDateString()}
                        </p>
                    </div>

                    <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border-gold-medium/30">
                        <CardContent className="p-8 md:p-12 space-y-8">
                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">1. Introduction</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                                </p>
                            </div>

                            <Separator className="bg-gold-medium/30" />

                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">2. Information We Collect</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
                                </p>
                                <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
                                    <li>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</li>
                                    <li>Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</li>
                                    <li>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.</li>
                                </ul>
                            </div>

                            <Separator className="bg-gold-medium/30" />

                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">3. How We Use Your Information</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.
                                </p>
                            </div>

                            <Separator className="bg-gold-medium/30" />

                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">4. Data Sharing and Disclosure</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.
                                </p>
                            </div>

                            <Separator className="bg-gold-medium/30" />

                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">5. Your Rights</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.
                                </p>
                            </div>

                            <Separator className="bg-gold-medium/30" />

                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">6. Data Security</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur.
                                </p>
                            </div>

                            <Separator className="bg-gold-medium/30" />

                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gold-light">7. Contact Us</h2>
                                <p className="text-gray-300 leading-relaxed">
                                    If you have any questions about this Privacy Policy, please contact us at lorem@ipsum.com.
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




