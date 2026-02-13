import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, useScroll, useTransform } from 'framer-motion';

interface CTASectionProps {
    scrollToForm: () => void;
}

export const CTASection = ({ scrollToForm }: CTASectionProps) => {
    const { t } = useTranslation();
    const sectionRef = useRef(null);
    const { scrollYProgress } = useScroll({
        target: sectionRef,
        offset: ["start end", "end start"],
    });

    const translateY = useTransform(scrollYProgress, [0, 1], [150, -150]);

    return (
        <section ref={sectionRef} className="bg-black py-24 overflow-x-clip">
            <div className="container">
                <div className="section-heading relative">
                    <h2 className="section-title">{t('global_partner.cta.title', 'Ready to join our global team?')}</h2>
                    <p className="section-description mt-5 migma-gold-text">
                        {t('global_partner.cta.description', 'Start your journey as a MIGMA Global Partner and work with freedom, earn in USD, and collaborate with a world-class team.')}
                    </p>

                    <motion.img
                        src="/foto6.png"
                        alt="Check Verification"
                        width={360}
                        className="hidden lg:block absolute -left-[350px] -top-[137px]"
                        style={{
                            translateY: translateY,
                        }}
                    />
                    <motion.img
                        src="/foto7.png"
                        alt="Golden diamond representing valuable opportunity"
                        width={360}
                        className="hidden lg:block absolute -right-[331px] -top-[100px] -rotate-[15deg]"
                        style={{
                            translateY: translateY,
                            rotate: 15,
                        }}
                    />
                </div>

                <div className="flex gap-2 mt-10 justify-center">
                    <button onClick={scrollToForm} className="btn btn-primary">{t('global_partner.cta.apply_button', 'Apply now')}</button>
                </div>
            </div>
        </section>
    );
};
