import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, TrendingUp, Lock } from 'lucide-react';

export const About = () => {
    const values = [
        {
            icon: Shield,
            title: 'Compliance First',
            desc: 'We operate with strict standards for confidentiality, documentation and audit trails. Every critical action is tracked and executed with clarity and accountability.'
        },
        {
            icon: TrendingUp,
            title: 'Performance & Execution',
            desc: 'We believe in measurable results. Clear processes, fast response times and high-quality execution — with a focus on conversion, client experience and operational excellence.'
        },
        {
            icon: Lock,
            title: 'Trust & Security',
            desc: 'Payments, data and workflows must be secure. We use controlled access, structured communication and responsible data handling to protect clients, partners and businesses.'
        }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-b from-black via-[#1a1a1a] to-black font-sans text-foreground">
            <Header />

            {/* Hero Section */}
            <section className="pt-[120px] pb-20 md:pt-24 md:pb-24 overflow-x-clip" style={{ background: "radial-gradient(ellipse 200% 100% at bottom left, #000000, #1a1a1a 100%)" }}>
                <div className="container">
                    <div className="max-w-4xl mx-auto text-center">
                        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter migma-gold-text mb-6">
                            About MIGMA
                        </h1>
                        <p className="text-xl md:text-2xl text-gold-light tracking-tight max-w-3xl mx-auto">
                            MIGMA INC is a U.S.-based operations and technology partner that supports visa and immigration companies worldwide — with structured workflows, secure payments, and compliance-first execution.
                        </p>
                    </div>
                </div>
            </section>

            {/* Section 1 — Who We Are */}
            <section className="bg-gradient-to-b from-black via-[#1a1a1a] to-black py-24">
                <div className="container max-w-4xl">
                    <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border-gold-medium/30">
                        <CardContent className="p-8 md:p-12">
                            <h2 className="text-3xl font-bold migma-gold-text mb-6">Who We Are</h2>
                            <div className="space-y-4 text-gray-300 leading-relaxed">
                                <p>
                                    MIGMA INC works behind established visa and immigration businesses to help them deliver a better client experience — from intake and organization to secure payment flows, service coordination, and operational support.
                                </p>
                                <p>
                                    If you reached MIGMA through a payment link, it means the company assisting you uses MIGMA as part of its operational infrastructure.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Section 2 — Why Clients See MIGMA */}
            <section className="bg-[#1a1a1a] py-24">
                <div className="container max-w-4xl">
                    <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border-gold-medium/30">
                        <CardContent className="p-8 md:p-12">
                            <h2 className="text-3xl font-bold migma-gold-text mb-6">Why You May See MIGMA During Your Process</h2>
                            <div className="space-y-4 text-gray-300 leading-relaxed">
                                <p>Some partner companies use MIGMA to manage specific steps such as:</p>
                                <ul className="list-disc list-inside space-y-2 ml-4">
                                    <li>secure payment processing</li>
                                    <li>service onboarding and data collection</li>
                                    <li>operational coordination and documentation requests</li>
                                    <li>client communication structure and tracking</li>
                                </ul>
                                <p className="pt-4">
                                    Your service is still handled under your provider's guidance — MIGMA supports the process and infrastructure.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Section 3 — Trust & Compliance */}
            <section className="bg-black py-24">
                <div className="container max-w-4xl">
                    <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border-gold-medium/30">
                        <CardContent className="p-8 md:p-12">
                            <h2 className="text-3xl font-bold migma-gold-text mb-6">Trust, Security & Compliance</h2>
                            <div className="space-y-4 text-gray-300 leading-relaxed">
                                <p>We take compliance seriously. MIGMA is built with:</p>
                                <ul className="list-disc list-inside space-y-2 ml-4">
                                    <li>secure systems and controlled access</li>
                                    <li>audit logs for critical actions (payments, acceptances, onboarding)</li>
                                    <li>data handling practices aligned with international standards</li>
                                    <li>structured workflows designed to reduce errors and improve clarity</li>
                                </ul>
                                <p className="pt-4">
                                    We never share client data without authorization and only operate within the scope of each partner relationship.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Section 4 — What MIGMA Is (and isn't) */}
            <section className="bg-[#1a1a1a] py-24">
                <div className="container max-w-4xl">
                    <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border-gold-medium/30">
                        <CardContent className="p-8 md:p-12">
                            <h2 className="text-3xl font-bold migma-gold-text mb-6">What MIGMA Is (and Isn't)</h2>
                            <div className="space-y-3 text-gray-300 leading-relaxed">
                                <p className="flex items-start gap-2">
                                    <span className="text-green-400 text-xl">✅</span>
                                    <span>We are a B2B operational and technology partner for visa and immigration companies.</span>
                                </p>
                                <p className="flex items-start gap-2">
                                    <span className="text-green-400 text-xl">✅</span>
                                    <span>We provide structured processes, tools, and execution support.</span>
                                </p>
                                <p className="flex items-start gap-2">
                                    <span className="text-red-400 text-xl">❌</span>
                                    <span>We are not a government entity and we do not issue visas.</span>
                                </p>
                                <p className="flex items-start gap-2">
                                    <span className="text-red-400 text-xl">❌</span>
                                    <span>We do not guarantee approvals — visa decisions are always made by the relevant authorities.</span>
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Section 5 — Work With Us */}
            <section className="bg-black py-24">
                <div className="container max-w-4xl">
                    <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border-gold-medium/30">
                        <CardContent className="p-8 md:p-12">
                            <h2 className="text-3xl font-bold migma-gold-text mb-6">Work With MIGMA</h2>
                            <div className="space-y-4 text-gray-300 leading-relaxed">
                                <p>
                                    MIGMA operates with global partners across multiple countries in roles such as sales, operations, and visa support.
                                </p>
                                <p>
                                    If you are interested in joining the ecosystem, visit the <a href="/global-partner" className="text-gold-light hover:text-gold-medium underline">Global Partner section</a> to apply.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Values Section */}
            <section className="bg-[#1a1a1a] py-24">
                <div className="container">
                    <div className="section-heading mb-16">
                        <h2 className="section-title">Our Values</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {values.map((value, index) => {
                            const Icon = value.icon;
                            return (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: index * 0.1 }}
                                >
                                    <Card className="h-full bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border-gold-medium/30">
                                        <CardContent className="p-8">
                                            <div className="flex items-center gap-3 mb-4">
                                                <Icon className="w-8 h-8 text-gold-light" />
                                                <h3 className="text-2xl font-bold migma-gold-text">{value.title}</h3>
                                            </div>
                                            <p className="text-gray-300 leading-relaxed">{value.desc}</p>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Team Section */}
            <section className="bg-black py-24">
                <div className="container max-w-4xl">
                    <div className="section-heading mb-16">
                        <h2 className="section-title">Our Team</h2>
                    </div>
                    <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border-gold-medium/30">
                        <CardContent className="p-8 md:p-12">
                            <div className="space-y-4 text-gray-300 leading-relaxed">
                                <p>
                                    MIGMA operates with a distributed team of specialists across sales, visa support, operations and technology.
                                </p>
                                <p>
                                    We work with vetted independent contractors and partner companies to deliver reliable execution — always under clear processes, confidentiality standards and performance metrics.
                                </p>
                                <p className="pt-4 font-semibold text-gold-light">What this means for you:</p>
                                <ul className="list-disc list-inside space-y-2 ml-4">
                                    <li>
                                        If you're a client who reached MIGMA through a payment link, you're interacting with a structured operational layer that supports your provider.
                                    </li>
                                    <li>
                                        If you're applying as a Global Partner, you'll be evaluated, onboarded and trained to operate under MIGMA's standards.
                                    </li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>

            <Footer />
        </div>
    );
};
