import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const Home = () => {
    const heroRef = useRef(null);

    return (
        <div className="min-h-screen bg-background font-sans text-foreground">
            {/* Header */}
            <Header />

            {/* Hero Section */}
            <section
                ref={heroRef}
                className="pt-[120px] pb-20 md:pt-24 md:pb-24 overflow-x-clip"
                style={{ background: "radial-gradient(ellipse 200% 100% at bottom left, #000000, #1a1a1a 100%)" }}
            >
                <div className="container">
                    <div className="max-w-4xl mx-auto text-center">
                        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter migma-gold-text mb-6">
                            We power visa & immigration businesses to sell more and serve better.
                        </h1>
                        <p className="text-xl md:text-2xl text-gold-light tracking-tight mb-8 max-w-3xl mx-auto">
                            MIGMA INC is a U.S.-based B2B company that plugs into your visa and immigration operation to convert more leads, handle your clients, and build the technology behind your growth.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-4">
                            <Link to="/book-a-call">
                                <Button className="btn btn-primary text-lg px-8 py-6">
                                    Book a call for your company
                                </Button>
                            </Link>
                            <Link to="/global-partner">
                                <Button className="bg-black border-2 border-gold-medium/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium text-lg px-8 py-6">
                                    Global Partner Program
                                </Button>
                            </Link>
                        </div>
                        <p className="text-sm text-gray-400 mt-4">
                            For companies in the U.S. visa & immigration ecosystem only.
                        </p>
                    </div>
                </div>
            </section>

            {/* Who we work with */}
            <section id="who-we-work-with" className="bg-gradient-to-b from-black via-[#1a1a1a] to-black py-24">
                <div className="container">
                    <div className="section-heading mb-16">
                        <h2 className="section-title">Who we work with</h2>
                        <p className="section-description mt-5 text-white max-w-3xl mx-auto">
                            MIGMA works exclusively with companies that operate in the U.S. visa and immigration ecosystem. We are not another immigration agency – we are the engine behind those agencies.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 }}
                        >
                            <Card className="h-full bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border-gold-medium/30">
                                <CardContent className="p-8">
                                    <h3 className="text-2xl font-bold mb-4 migma-gold-text">Visa Agencies & Consultancies</h3>
                                    <p className="text-gray-300 leading-relaxed">
                                        Companies that sell U.S. visa services and need more consistent conversions and professional sales operations.
                                    </p>
                                </CardContent>
                            </Card>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.2 }}
                        >
                            <Card className="h-full bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border-gold-medium/30">
                                <CardContent className="p-8">
                                    <h3 className="text-2xl font-bold mb-4 migma-gold-text">Immigration Law Firms</h3>
                                    <p className="text-gray-300 leading-relaxed">
                                        Legal teams that want to keep their focus on strategy and cases, while MIGMA handles lead conversion and client communication.
                                    </p>
                                </CardContent>
                            </Card>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.3 }}
                        >
                            <Card className="h-full bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border-gold-medium/30">
                                <CardContent className="p-8">
                                    <h3 className="text-2xl font-bold mb-4 migma-gold-text">Education, Mentorship & Programs</h3>
                                    <p className="text-gray-300 leading-relaxed">
                                        Coaches, mentors and programs that sell immigration-related services and want a scalable sales and support structure.
                                    </p>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* What MIGMA does */}
            <section id="what-migma-does" className="bg-gradient-to-b from-[#1a1a1a] to-black py-24">
                <div className="container">
                    <div className="section-heading mb-16">
                        <h2 className="section-title">What MIGMA does for your business</h2>
                        <p className="section-description mt-5 text-white max-w-3xl mx-auto">
                            We integrate with your operation in three core areas, always with a performance mindset.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Pillar 1 */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 }}
                        >
                            <Card className="h-full bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border-gold-medium/30">
                                <CardContent className="p-8">
                                    <h3 className="text-2xl font-bold mb-4 migma-gold-text">Pillar 1 – Sales & Conversions</h3>
                                    <p className="text-gold-light font-semibold mb-4">We take your leads and turn them into paying clients.</p>
                                    <ul className="space-y-2 text-gray-300">
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>Specialized sales team focused on U.S. visa and immigration offers</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>Lead response, follow-up and closing</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>Tailored scripts and flows for each type of visa or program</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>Performance-driven mindset: more booked calls, more clients, more revenue</span>
                                        </li>
                                    </ul>
                                </CardContent>
                            </Card>
                        </motion.div>

                        {/* Pillar 2 */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.2 }}
                        >
                            <Card className="h-full bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border-gold-medium/30">
                                <CardContent className="p-8">
                                    <h3 className="text-2xl font-bold mb-4 migma-gold-text">Pillar 2 – Client Support & Operations</h3>
                                    <p className="text-gold-light font-semibold mb-4">We help your company deliver a better experience for your clients.</p>
                                    <ul className="space-y-2 text-gray-300">
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>Frontline communication (WhatsApp, email, calls, CRM)</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>Handling of doubts, updates and expectations</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>Post-sale touchpoints to increase trust and retention</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>Structure to support higher demand without burning your internal team</span>
                                        </li>
                                    </ul>
                                </CardContent>
                            </Card>
                        </motion.div>

                        {/* Pillar 3 */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.3 }}
                        >
                            <Card className="h-full bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border-gold-medium/30">
                                <CardContent className="p-8">
                                    <h3 className="text-2xl font-bold mb-4 migma-gold-text">Pillar 3 – Tech & AI Solutions</h3>
                                    <p className="text-gold-light font-semibold mb-4">We build the technology that sustains your growth.</p>
                                    <ul className="space-y-2 text-gray-300">
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>Automations for leads, follow-ups and client journeys</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>AI-powered flows to answer frequent questions and qualify leads</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>Integrations with CRM and tools you already use</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>Custom tools to give you visibility and control over your pipeline</span>
                                        </li>
                                    </ul>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Why MIGMA */}
            <section id="why-migma" className="bg-black py-24">
                <div className="container">
                    <div className="section-heading mb-16">
                        <h2 className="section-title">Why companies choose MIGMA</h2>
                    </div>

                    <div className="max-w-3xl mx-auto space-y-6">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 }}
                            className="flex items-start gap-4"
                        >
                            <div className="w-2 h-2 rounded-full bg-gold-medium mt-2 flex-shrink-0" />
                            <div>
                                <h3 className="text-xl font-bold text-gold-light mb-2">Built for the U.S. visa & immigration market</h3>
                                <p className="text-gray-300">Deep understanding of the client journey, objections and decision-making process.</p>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.2 }}
                            className="flex items-start gap-4"
                        >
                            <div className="w-2 h-2 rounded-full bg-gold-medium mt-2 flex-shrink-0" />
                            <div>
                                <h3 className="text-xl font-bold text-gold-light mb-2">B2B, not B2C</h3>
                                <p className="text-gray-300">We do not compete with you. We only serve companies, not end clients.</p>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.3 }}
                            className="flex items-start gap-4"
                        >
                            <div className="w-2 h-2 rounded-full bg-gold-medium mt-2 flex-shrink-0" />
                            <div>
                                <h3 className="text-xl font-bold text-gold-light mb-2">Global team, U.S. standards</h3>
                                <p className="text-gray-300">Independent contractors around the world, operating under a structured playbook.</p>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.4 }}
                            className="flex items-start gap-4"
                        >
                            <div className="w-2 h-2 rounded-full bg-gold-medium mt-2 flex-shrink-0" />
                            <div>
                                <h3 className="text-xl font-bold text-gold-light mb-2">Tech + people</h3>
                                <p className="text-gray-300">A mix of high-performance human team and smart automations.</p>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.5 }}
                            className="flex items-start gap-4"
                        >
                            <div className="w-2 h-2 rounded-full bg-gold-medium mt-2 flex-shrink-0" />
                            <div>
                                <h3 className="text-xl font-bold text-gold-light mb-2">Confidential and white-label</h3>
                                <p className="text-gray-300">We can operate under your brand and protect your client relationships.</p>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* How it works */}
            <section id="how-it-works" className="bg-[#1a1a1a] py-24">
                <div className="container max-w-3xl">
                    <div className="section-heading mb-16">
                        <h2 className="section-title">How working with MIGMA works</h2>
                    </div>
                    <div className="relative border-l-2 border-gold-medium/30 ml-4 md:ml-0 md:pl-8 space-y-12">
                        {[
                            { 
                                title: 'Discovery call', 
                                desc: 'We understand your business model, lead volume, offers and current bottlenecks.' 
                            },
                            { 
                                title: 'Custom proposal', 
                                desc: 'We design how MIGMA will plug into your operation – sales, support and/or tech.' 
                            },
                            { 
                                title: 'Onboarding & setup', 
                                desc: 'We align scripts, access to tools, tech integrations and communication channels.' 
                            },
                            { 
                                title: 'Go live & optimization', 
                                desc: 'MIGMA starts operating for your company. We track metrics and optimize over time.' 
                            },
                        ].map((step, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, x: -20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.1 }}
                                className="relative pl-8 md:pl-0"
                            >
                                <div className="absolute -left-[9px] md:-left-[33px] top-1 bg-gold-medium w-4 h-4 rounded-full border-4 border-[#1a1a1a] shadow-sm" />
                                <h3 className="text-xl font-bold migma-gold-text">{step.title}</h3>
                                <p className="text-gray-300">{step.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Results */}
            <section id="results" className="bg-gradient-to-b from-black via-[#1a1a1a] to-black py-24">
                <div className="container">
                    <div className="section-heading mb-16">
                        <h2 className="section-title">What happens when MIGMA plugs into your business</h2>
                        <p className="section-description mt-5 text-white max-w-3xl mx-auto">
                            We exist to increase revenue and reduce friction. When MIGMA is operating inside your business, more leads are contacted, more clients feel supported, and your team is free to focus on what really matters.
                        </p>
                    </div>
                    {/* Placeholder for bullets with real numbers */}
                </div>
            </section>

            {/* CTA Final */}
            <section className="bg-black py-24">
                <div className="container">
                    <div className="section-heading">
                        <h2 className="section-title">Ready to scale your visa & immigration business?</h2>
                        <p className="section-description mt-5 text-white max-w-3xl mx-auto">
                            Tell us about your company and we'll show you how MIGMA can plug into your operation.
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-10">
                        <Link to="/book-a-call">
                            <Button className="btn btn-primary text-lg px-8 py-6">
                                Book a call
                            </Button>
                        </Link>
                    </div>
                    <div className="text-center mt-6">
                        <Link to="/global-partner" className="text-gold-light hover:text-gold-medium transition">
                            Want to work with MIGMA as a Global Partner? → Global Partner Program
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <Footer />
        </div>
    );
};

