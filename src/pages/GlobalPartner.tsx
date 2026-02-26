import { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Check, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

// Modular Components
import { GlobalPartnerHeader } from '@/components/global-partner/GlobalPartnerHeader';
import { TestimonialsSection } from '@/components/global-partner/TestimonialsSection';
import { CTASection } from '@/components/global-partner/CTASection';
import { GlobalPartnerFooter } from '@/components/global-partner/GlobalPartnerFooter';
import { ApplicationWizard } from '@/components/global-partner/ApplicationWizard';

export const GlobalPartner = () => {
    const { t } = useTranslation();
    const heroRef = useRef(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToForm = () => {
        const formElement = document.getElementById('application-form');
        if (formElement) {
            formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <div className="min-h-screen bg-black font-sans text-white notranslate" translate="no">
            <GlobalPartnerHeader isScrolled={isScrolled} />

            {/* Section A: Hero */}
            <section
                ref={heroRef}
                className="pt-[100px] pb-20 md:pt-[120px] md:pb-24 overflow-x-clip"
                style={{ background: "radial-gradient(ellipse 200% 100% at bottom left, #000000, #1a1a1a 100%)" }}
            >
                <div className="container">
                    <div className="md:flex items-center">
                        <div className="md:w-[478px]">
                            <div className="tag">{t('global_partner.hero.tag', 'New Program')}</div>
                            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter bg-gradient-to-b from-white to-gold-light bg-clip-text text-transparent mt-6 migma-gold-text">
                                {t('global_partner.hero.title', 'Become a MIGMA Global Partner')}
                            </h1>
                            <p className="text-xl text-gray-300 tracking-tight mt-6">
                                {t('global_partner.hero.description', 'Join our global network of professionals and help people achieve their dreams of living and working in the United States while earning in USD.')}
                            </p>
                            <div className="flex gap-2 items-center mt-[30px]">
                                <button onClick={scrollToForm} className="btn btn-primary">{t('global_partner.hero.cta', 'Apply Now')}</button>
                                <a href="#benefits" className="btn btn-text text-white hover:text-gold-light gap-1">
                                    <span>{t('global_partner.hero.learn_more', 'Learn more')}</span>
                                    <ChevronRight className="h-4 w-4" />
                                </a>
                            </div>
                        </div>
                        <div className="mt-20 md:mt-0 md:h-[648px] md:flex-1 relative">
                            <motion.img
                                src="/foto1.png"
                                alt="Golden professional workspace"
                                className="md:absolute md:h-full md:w-auto md:max-w-none md:-left-6 lg:left-0"
                                animate={{
                                    translateY: [-30, 30],
                                }}
                                transition={{
                                    repeat: Infinity,
                                    repeatType: "mirror",
                                    duration: 3,
                                    ease: "easeInOut",
                                }}
                            />
                            <motion.img
                                src="/foto2.png"
                                alt="Abstract golden flow"
                                width={220}
                                height={220}
                                className="hidden md:block absolute -top-8 -left-32"
                                style={{
                                    rotate: 30,
                                }}
                            />
                            <motion.img
                                src="/foto5.png"
                                alt="Success verification check"
                                width={220}
                                className="hidden lg:block absolute top-[524px] left-[448px]"
                                style={{
                                    rotate: -30,
                                }}
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Foto3 entre seções para efeito 3D */}
            <div className="relative w-full overflow-x-clip -mt-32 mb-32">
                <motion.img
                    src="/foto3.png"
                    alt="Golden particles"
                    width={400}
                    className="absolute -right-20 top-0 opacity-50 z-10"
                    animate={{
                        rotate: 360,
                    }}
                    transition={{
                        duration: 50,
                        repeat: Infinity,
                        ease: "linear",
                    }}
                />
            </div>

            {/* Section B: Benefits Grid */}
            <section id="benefits" className="bg-gradient-to-b from-black via-[#1a1a1a] to-black py-24 overflow-x-clip relative">
                <div className="container relative z-10">
                    <div className="section-heading">
                        <div className="flex justify-center">
                            <div className="tag">{t('global_partner.benefits.tag', 'Benefits')}</div>
                        </div>
                        <h2 className="section-title mt-5">{t('global_partner.benefits.title', 'Why join MIGMA?')}</h2>
                        <p className="section-description mt-5 text-gray-300">
                            {t('global_partner.benefits.description', 'We offer a unique opportunity for professionals who want to grow their international career with flexibility and high earning potential.')}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-16">
                        {/* Benefit 1 */}
                        <div className="benefit-card group">
                            <div className="mb-4 h-12 w-12 rounded-xl bg-gold-medium/20 flex items-center justify-center text-gold-light group-hover:bg-gold-medium group-hover:text-black transition-all">
                                <Check className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">{t('global_partner.benefits.earn_usd_title', 'Earn in USD')}</h3>
                            <p className="text-gray-400">{t('global_partner.benefits.earn_usd_desc', 'Get paid in US Dollars for your services, regardless of where you are in the world.')}</p>
                        </div>
                        {/* Benefit 2 */}
                        <div className="benefit-card group">
                            <div className="mb-4 h-12 w-12 rounded-xl bg-gold-medium/20 flex items-center justify-center text-gold-light group-hover:bg-gold-medium group-hover:text-black transition-all">
                                <Check className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">{t('global_partner.benefits.flexibility_title', 'Total Flexibility')}</h3>
                            <p className="text-gray-400">{t('global_partner.benefits.flexibility_desc', 'Work according to your own schedule and from any location with an internet connection.')}</p>
                        </div>
                        {/* Benefit 3 */}
                        <div className="benefit-card group">
                            <div className="mb-4 h-12 w-12 rounded-xl bg-gold-medium/20 flex items-center justify-center text-gold-light group-hover:bg-gold-medium group-hover:text-black transition-all">
                                <Check className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">{t('global_partner.benefits.expert_support_title', 'Expert Support')}</h3>
                            <p className="text-gray-400">{t('global_partner.benefits.expert_support_desc', 'Access to our experienced team and resources to help you succeed.')}</p>
                        </div>
                        {/* Benefit 4 */}
                        <div className="benefit-card group">
                            <div className="mb-4 h-12 w-12 rounded-xl bg-gold-medium/20 flex items-center justify-center text-gold-light group-hover:bg-gold-medium group-hover:text-black transition-all">
                                <Check className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">{t('global_partner.benefits.global_network_title', 'Global Network')}</h3>
                            <p className="text-gray-400">{t('global_partner.benefits.global_network_desc', 'Be part of a prestigious international organization and expand your professional reach.')}</p>
                        </div>
                        {/* Benefit 5 */}
                        <div className="benefit-card group">
                            <div className="mb-4 h-12 w-12 rounded-xl bg-gold-medium/20 flex items-center justify-center text-gold-light group-hover:bg-gold-medium group-hover:text-black transition-all">
                                <Check className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">{t('global_partner.benefits.training_title', 'Continuous Training')}</h3>
                            <p className="text-gray-400">{t('global_partner.benefits.training_desc', 'Regular updates and specialized training about U.S. visa processes and requirements.')}</p>
                        </div>
                        {/* Benefit 6 */}
                        <div className="benefit-card group">
                            <div className="mb-4 h-12 w-12 rounded-xl bg-gold-medium/20 flex items-center justify-center text-gold-light group-hover:bg-gold-medium group-hover:text-black transition-all">
                                <Check className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">{t('global_partner.benefits.career_growth_title', 'Career Growth')}</h3>
                            <p className="text-gray-400">{t('global_partner.benefits.career_growth_desc', 'Opportunities to take on more responsibilities and lead teams as you grow with us.')}</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Section C: Who is this for? */}
            <section id="who-is-this-for" className="bg-gradient-to-b from-[#1a1a1a] to-black py-24">
                <div className="container">
                    <div className="flex flex-col lg:flex-row items-center gap-12">
                        <div className="lg:w-1/2">
                            <h2 className="section-title text-left">{t('global_partner.who.title', 'Who is this for?')}</h2>
                            <p className="mt-6 text-gray-300 text-lg leading-relaxed">
                                {t('global_partner.who.description', 'We are looking for dedicated professionals who share our passion for excellence and helping others. While we value experience, we also look for potential and cultural fit.')}
                            </p>
                            <ul className="mt-8 space-y-4">
                                {[
                                    t('global_partner.who.item1', 'Visa and immigration consultants'),
                                    t('global_partner.who.item2', 'Sales professionals and closers'),
                                    t('global_partner.who.item3', 'Administrative and operational specialists'),
                                    t('global_partner.who.item4', 'People looking for an international remote career'),
                                ].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-white/90">
                                        <div className="h-5 w-5 rounded-full bg-gold-medium flex items-center justify-center flex-shrink-0">
                                            <Check className="h-3 w-3 text-black" />
                                        </div>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="lg:w-1/2 relative">
                            <div className="rounded-3xl pointer-events-none p-1 bg-gradient-to-br from-gold-light via-gold-medium to-gold-dark shadow-2xl overflow-hidden">
                                <img src="/foto4.png" alt="Collaborative team" className="rounded-[22px] w-full" />
                            </div>
                            <div className="absolute -bottom-6 -right-6 bg-black p-6 rounded-2xl border border-gold-medium/30 shadow-xl hidden md:block">
                                <div className="text-gold-light text-2xl font-bold">{t('global_partner.who.badge_title', 'Worldwide')}</div>
                                <div className="text-gray-400 text-sm">{t('global_partner.who.badge_desc', 'Join partners from 40+ countries')}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Section D: Timeline */}
            <section id="how-it-works" className="bg-[#1a1a1a] py-24">
                <div className="container">
                    <div className="section-heading">
                        <h2 className="section-title">{t('global_partner.how.title', 'How it works')}</h2>
                        <p className="section-description mt-5 text-gray-300">
                            {t('global_partner.how.description', 'Our selection and onboarding process is designed to be efficient and professional.')}
                        </p>
                    </div>

                    <div className="mt-20 relative">
                        {/* Pipeline Connector Line */}
                        <div className="hidden lg:block absolute top-[68px] left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gold-medium/50 to-transparent"></div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 relative z-10">
                            {[
                                { step: '01', title: t('global_partner.how.step1_title', 'Application'), desc: t('global_partner.how.step1_desc', 'Fill out the form below with your details and professional background.') },
                                { step: '02', title: t('global_partner.how.step2_title', 'Review'), desc: t('global_partner.how.step2_desc', 'Our team reviews your profile to see if it matches our current needs.') },
                                { step: '03', title: t('global_partner.how.step3_title', 'Interview'), desc: t('global_partner.how.step3_desc', 'Qualified candidates are invited for a video interview.') },
                                { step: '04', title: t('global_partner.how.step4_title', 'Onboarding'), desc: t('global_partner.how.step4_desc', 'Successful partners begin training and receive access to our platform.') },
                            ].map((item, i) => (
                                <div key={i} className="text-center group">
                                    <div className="mb-6 mx-auto h-[60px] w-[60px] rounded-full bg-black border-2 border-gold-medium flex items-center justify-center text-gold-light font-bold text-xl group-hover:bg-gold-medium group-hover:text-black transition-all">
                                        {item.step}
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                                    <p className="text-gray-400">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Section E: Application Form */}
            <section id="application-form" className="bg-gradient-to-b from-black via-[#1a1a1a] to-black py-24">
                <div className="container max-w-3xl">
                    <div className="text-center mb-8">
                        <h2 className="section-title">{t('global_partner.form.title', 'Apply to become a MIGMA Global Partner')}</h2>
                        <p className="section-description mt-5 text-gray-300">
                            {t('global_partner.form.description', 'Tell us more about you, your experience and why you want to work with MIGMA. If your profile matches what we are looking for, you will receive an email to schedule an interview.')}
                        </p>
                    </div>
                    <Card ref={cardRef} className="border-gold-medium/30 shadow-2xl bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 backdrop-blur-sm">
                        <CardContent className="p-8 sm:p-12">
                            <ApplicationWizard cardRef={cardRef} />
                        </CardContent>
                    </Card>
                </div>
            </section>

            <TestimonialsSection />
            <CTASection scrollToForm={scrollToForm} />
            <GlobalPartnerFooter scrollToForm={scrollToForm} />
        </div>
    );
};
