import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export const Services = () => {
    return (
        <div className="min-h-screen bg-background font-sans text-foreground">
            <Header />

            {/* Hero Section */}
            <section className="pt-[120px] pb-20 md:pt-24 md:pb-24 overflow-x-clip" style={{ background: "radial-gradient(ellipse 200% 100% at bottom left, #000000, #1a1a1a 100%)" }}>
                <div className="container">
                    <div className="max-w-4xl mx-auto text-center">
                        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter migma-gold-text mb-6">
                            Services for visa & immigration companies
                        </h1>
                        <p className="text-xl md:text-2xl text-gold-light tracking-tight mb-8 max-w-3xl mx-auto">
                            MIGMA connects sales, client support and technology into one integrated operation to help your U.S. visa business grow with more predictability and less chaos.
                        </p>
                        <Link to="/book-a-call">
                            <Button className="btn btn-primary text-lg px-8 py-6">
                                Book a call to discuss your company
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Overview */}
            <section className="bg-gradient-to-b from-black via-[#1a1a1a] to-black py-24">
                <div className="container">
                    <div className="section-heading mb-16">
                        <h2 className="section-title">A single partner for sales, support and tech</h2>
                        <p className="section-description mt-5 text-white max-w-3xl mx-auto">
                            Instead of hiring multiple vendors – one for marketing, another for sales training, another for support and another for tech – you can plug MIGMA into your company and have a single partner responsible for performance, structure and automation.
                        </p>
                    </div>
                </div>
            </section>

            {/* Service 1 - Sales & Conversions */}
            <section className="bg-[#1a1a1a] py-24">
                <div className="container">
                    <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border-gold-medium/30 mb-8">
                        <CardContent className="p-8 md:p-12">
                            <div className="flex items-center gap-3 mb-6">
                                <span className="bg-gold-medium text-black rounded-full w-12 h-12 flex items-center justify-center text-2xl font-bold">1</span>
                                <h2 className="text-3xl md:text-4xl font-bold migma-gold-text">Sales & Conversions</h2>
                            </div>
                            <h3 className="text-xl font-semibold text-gold-light mb-4">We turn your leads into booked calls and paying clients.</h3>
                            <p className="text-gray-300 mb-6 leading-relaxed">
                                Your leads are valuable. Every minute they wait without an answer is lost money. MIGMA builds and operates a sales structure specialized in U.S. visa and immigration offers, acting as an extension of your team.
                            </p>
                            
                            <div className="grid md:grid-cols-2 gap-8 mt-8">
                                <div>
                                    <h4 className="text-lg font-semibold text-gold-light mb-4">Key Features:</h4>
                                    <ul className="space-y-2 text-gray-300">
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>Dedicated sales reps focused on your offers</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>Fast response to new inbound leads</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>Qualification, follow-up and closing</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>Scripts tailored to each type of visa/service</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>Work under your brand (white-label, if needed)</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>Performance reports so you know what's happening</span>
                                        </li>
                                    </ul>
                                </div>
                                <div className="bg-black/50 p-6 rounded-lg border border-gold-medium/20">
                                    <h4 className="text-lg font-semibold text-gold-light mb-4">Ideal for you if:</h4>
                                    <ul className="space-y-2 text-gray-300">
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>You already generate leads but feel you're losing opportunities</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>Your legal/technical team is overloaded and can't handle sales</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>You want a professional sales operation without building it in-house</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Service 2 - Client Support & Operations */}
            <section className="bg-black py-24">
                <div className="container">
                    <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border-gold-medium/30 mb-8">
                        <CardContent className="p-8 md:p-12">
                            <div className="flex items-center gap-3 mb-6">
                                <span className="bg-gold-medium text-black rounded-full w-12 h-12 flex items-center justify-center text-2xl font-bold">2</span>
                                <h2 className="text-3xl md:text-4xl font-bold migma-gold-text">Client Support & Operations</h2>
                            </div>
                            <h3 className="text-xl font-semibold text-gold-light mb-4">We help you deliver a better experience to your clients.</h3>
                            <p className="text-gray-300 mb-6 leading-relaxed">
                                Once a client signs, the relationship is just beginning. MIGMA can handle a big part of the communication and frontline support, so your core team can focus on legal, strategy and high-level decisions.
                            </p>
                            
                            <div className="grid md:grid-cols-2 gap-8 mt-8">
                                <div>
                                    <h4 className="text-lg font-semibold text-gold-light mb-4">Key Features:</h4>
                                    <ul className="space-y-2 text-gray-300">
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>Handling of messages, doubts and basic updates</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>Coordination of information and documents with your internal team</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>Proactive communication to keep clients informed</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>Support in multiple channels (WhatsApp, email, calls, CRM)</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>Structure that grows with your client base</span>
                                        </li>
                                    </ul>
                                </div>
                                <div className="bg-black/50 p-6 rounded-lg border border-gold-medium/20">
                                    <h4 className="text-lg font-semibold text-gold-light mb-4">This solves problems like:</h4>
                                    <ul className="space-y-2 text-gray-300">
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>Clients feeling abandoned after closing</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>Founders/lawyers spending too much time answering basic questions</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>Difficulty scaling support during growth phases</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Service 3 - Tech & AI Solutions */}
            <section className="bg-[#1a1a1a] py-24">
                <div className="container">
                    <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border-gold-medium/30 mb-8">
                        <CardContent className="p-8 md:p-12">
                            <div className="flex items-center gap-3 mb-6">
                                <span className="bg-gold-medium text-black rounded-full w-12 h-12 flex items-center justify-center text-2xl font-bold">3</span>
                                <h2 className="text-3xl md:text-4xl font-bold migma-gold-text">Tech & AI Solutions</h2>
                            </div>
                            <h3 className="text-xl font-semibold text-gold-light mb-4">We build the technology behind your sales and support.</h3>
                            <p className="text-gray-300 mb-6 leading-relaxed">
                                Most immigration companies are great at what they do legally – but don't have time or expertise to build systems and automations. MIGMA takes care of the tech layer that makes everything more efficient.
                            </p>
                            
                            <div className="grid md:grid-cols-2 gap-8 mt-8">
                                <div>
                                    <h4 className="text-lg font-semibold text-gold-light mb-4">Key Features:</h4>
                                    <ul className="space-y-2 text-gray-300">
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>Automations for lead nurture, follow-up and client onboarding</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>AI flows to answer frequent questions and pre-qualify leads</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>Integrations with your existing CRM and tools</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>Dashboards and visibility over pipeline and performance</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>Custom internal tools according to your operation's needs</span>
                                        </li>
                                    </ul>
                                </div>
                                <div className="bg-black/50 p-6 rounded-lg border border-gold-medium/20">
                                    <h4 className="text-lg font-semibold text-gold-light mb-4">Practical results:</h4>
                                    <ul className="space-y-2 text-gray-300">
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>Less manual work</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>Less human error</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>More consistent processes</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-gold-medium mt-1">•</span>
                                            <span>More control over your business</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Engagement Model */}
            <section className="bg-black py-24">
                <div className="container">
                    <div className="section-heading mb-16">
                        <h2 className="section-title">How we work with your company</h2>
                        <p className="section-description mt-5 text-white max-w-3xl mx-auto">
                            Every company has a different model, ticket, volume and team. That's why we don't sell "one-size-fits-all packages". We design how MIGMA will plug into your operation and structure the engagement around that.
                        </p>
                    </div>
                    <div className="max-w-3xl mx-auto">
                        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border-gold-medium/30">
                            <CardContent className="p-8">
                                <ul className="space-y-4 text-gray-300">
                                    <li className="flex items-start gap-3">
                                        <span className="text-gold-medium mt-1">•</span>
                                        <span>Monthly base fee + performance components</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="text-gold-medium mt-1">•</span>
                                        <span>Scope defined around sales, support and tech (you can start with one or more pillars)</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="text-gold-medium mt-1">•</span>
                                        <span>Clear communication, metrics and review routines</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="text-gold-medium mt-1">•</span>
                                        <span>White-label or co-branded, depending on your strategy</span>
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section className="bg-[#1a1a1a] py-24">
                <div className="container max-w-3xl">
                    <div className="section-heading mb-16">
                        <h2 className="section-title">FAQ – Is MIGMA the right fit for us?</h2>
                    </div>
                    <div className="space-y-6">
                        {[
                            {
                                q: "Do you work directly with end clients?",
                                a: "No. MIGMA only works B2B, serving companies in the U.S. visa & immigration ecosystem."
                            },
                            {
                                q: "Will you replace our team?",
                                a: "No. We integrate with your team and structure, taking over parts of the operation so your internal people can focus on what they do best."
                            },
                            {
                                q: "Can you operate under our brand?",
                                a: "Yes, we can work white-label so that all communication appears as coming from your company."
                            },
                            {
                                q: "Do you work with any type of business?",
                                a: "We only work with companies related to U.S. visas and immigration and we evaluate fit during the discovery call."
                            }
                        ].map((faq, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.1 }}
                            >
                                <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border-gold-medium/30">
                                    <CardContent className="p-6">
                                        <h3 className="text-lg font-bold text-gold-light mb-3">Q: {faq.q}</h3>
                                        <Separator className="bg-gold-medium/30 mb-3" />
                                        <p className="text-gray-300">A: {faq.a}</p>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Final */}
            <section className="bg-black py-24">
                <div className="container">
                    <div className="section-heading">
                        <h2 className="section-title">Let's talk about your visa & immigration business</h2>
                        <p className="section-description mt-5 text-white max-w-3xl mx-auto">
                            Share how your operation works today and we'll show you what MIGMA can do for your sales, support and technology.
                        </p>
                    </div>
                    <div className="flex justify-center mt-10">
                        <Link to="/book-a-call">
                            <Button className="btn btn-primary text-lg px-8 py-6">
                                Book a call
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
};


