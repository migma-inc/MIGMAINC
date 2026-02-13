import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

export const TestimonialsSection = () => {
    const { t } = useTranslation();
    const testimonials = [
        {
            text: t('global_partner.testimonials.testimonial1_text', "Working with MIGMA as a Global Partner has been an incredible experience. The flexibility and support are unmatched."),
            imageSrc: "/avatar-1.png",
            name: "Sarah Chen",
            username: "@sarahchen_dev",
        },
        {
            text: t('global_partner.testimonials.testimonial2_text', "The opportunity to work remotely while earning in USD has transformed my career. Highly recommend joining the program."),
            imageSrc: "/avatar-2.png",
            name: "Marcus Rodriguez",
            username: "@marcus_tech",
        },
        {
            text: t('global_partner.testimonials.testimonial3_text', "MIGMA's Global Partner Program offers the perfect balance of independence and collaboration."),
            imageSrc: "/avatar-3.png",
            name: "Priya Patel",
            username: "@priya_design",
        },
        {
            text: t('global_partner.testimonials.testimonial4_text', "As a contractor, I appreciate the professional structure and competitive compensation MIGMA provides."),
            imageSrc: "/avatar-4.png",
            name: "David Kim",
            username: "@davidkim_dev",
        },
        {
            text: t('global_partner.testimonials.testimonial5_text', "The onboarding process was smooth, and the team is always available to help. Great experience overall."),
            imageSrc: "/avatar-5.png",
            name: "Emma Wilson",
            username: "@emmawilson",
        },
        {
            text: t('global_partner.testimonials.testimonial6_text', "Working with MIGMA has opened doors to exciting projects I wouldn't have access to otherwise."),
            imageSrc: "/avatar-6.png",
            name: "James Taylor",
            username: "@jamestaylor",
        },
        {
            text: t('global_partner.testimonials.testimonial7_text', "The freedom to work from anywhere combined with USD payments makes this program ideal for global professionals."),
            imageSrc: "/avatar-7.png",
            name: "Luna Martinez",
            username: "@lunamartinez",
        },
        {
            text: t('global_partner.testimonials.testimonial8_text', "MIGMA values quality work and provides the resources needed to deliver exceptional results."),
            imageSrc: "/avatar-8.png",
            name: "Alex Johnson",
            username: "@alexjohnson",
        },
        {
            text: t('global_partner.testimonials.testimonial9_text', "Being part of MIGMA's global network has expanded my professional horizons significantly."),
            imageSrc: "/avatar-9.png",
            name: "Sofia Anderson",
            username: "@sofiaanderson",
        },
    ];

    const firstColumn = testimonials.slice(0, 3);
    const secondColumn = testimonials.slice(3, 6);
    const thirdColumn = testimonials.slice(6, 9);

    const TestimonialsColumn = ({ testimonials: columnTestimonials, duration = 15, className = "" }: { testimonials: typeof testimonials, duration?: number, className?: string }) => {
        return (
            <div className={className}>
                <motion.div
                    animate={{
                        translateY: "-50%",
                    }}
                    transition={{
                        duration: duration,
                        repeat: Infinity,
                        ease: "linear",
                        repeatType: "loop",
                    }}
                    className="flex flex-col gap-6 pb-6"
                >
                    {[
                        ...new Array(2).fill(0).map((_, index) => (
                            <Fragment key={index}>
                                {columnTestimonials.map(({ text, imageSrc, name, username }) => (
                                    <div className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 rounded-2xl p-6 shadow-[0_7px_14px_rgba(206,159,72,0.1)] border border-gold-medium/30" key={username}>
                                        <div className="text-gray-300">{text}</div>
                                        <div className="flex items-center gap-2 mt-5">
                                            <img
                                                src={imageSrc}
                                                alt={name}
                                                className="h-10 w-10 rounded-full object-cover"
                                            />
                                            <div className="flex flex-col">
                                                <div className="font-medium tracking-tight leading-5 text-gold-light">{name}</div>
                                                <div className="leading-5 tracking-tight text-gray-400 text-sm">{username}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </Fragment>
                        )),
                    ]}
                </motion.div>
            </div>
        );
    };

    return (
        <section className="bg-black py-24">
            <div className="container">
                <div className="section-heading">
                    <div className="flex justify-center">
                        <div className="tag">{t('global_partner.testimonials.tag', 'Testimonials')}</div>
                    </div>
                    <h2 className="section-title mt-5">{t('global_partner.testimonials.title', 'What our partners say')}</h2>
                    <p className="section-description mt-5 text-gray-300">
                        {t('global_partner.testimonials.description', 'Join a community of talented professionals who have found success working with MIGMA as Global Partners.')}
                    </p>
                </div>

                <div className="flex justify-center gap-6 mt-10 [mask-image:linear-gradient(to_bottom,transparent,black_25%,black_75%,transparent)] max-h-[740px] overflow-hidden">
                    <TestimonialsColumn testimonials={firstColumn} duration={15} />
                    <TestimonialsColumn testimonials={secondColumn} className="hidden md:block" duration={19} />
                    <TestimonialsColumn testimonials={thirdColumn} className="hidden lg:block" duration={17} />
                </div>
            </div>
        </section>
    );
};
