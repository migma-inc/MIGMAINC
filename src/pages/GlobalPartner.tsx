import React, { useRef, useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Check, ChevronRight, ChevronLeft, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { uploadCV } from '@/lib/storage';
import { sendApplicationConfirmationEmail, sendAdminNewApplicationNotification } from '@/lib/emails';
import { getAllAdminEmails } from '@/lib/auth';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Function to check if email already exists
const checkEmailExists = async (email: string): Promise<boolean> => {
    try {
        const { data, error } = await supabase
            .from('global_partner_applications')
            .select('id')
            .eq('email', email.toLowerCase().trim())
            .maybeSingle();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error('Error checking email:', error);
            return false; // If error, don't block (let database constraint handle it)
        }

        return !!data; // Return true if email exists
    } catch (error) {
        console.error('Error checking email:', error);
        return false; // If error, don't block
    }
};

// --- Zod Schemas ---
const personalSchema = z.object({
    fullName: z.string().min(2, "Name is required"),
    email: z.string().email("Invalid email"),
    phone: z.string().min(5, "Phone is required"),
    country: z.string().min(2, "Country is required"),
    city: z.string().optional(),
});

const legalSchema = z.object({
    hasBusiness: z.enum(["Yes", "No"]).refine((val) => val !== undefined, {
        message: "Please select if you have a business registration",
    }),
    registrationType: z.string().optional(),
    businessName: z.string().optional(),
    businessId: z.string().optional(),
    taxId: z.string().optional(),
}).refine((data) => {
    if (data.hasBusiness === "Yes") {
        return data.businessId && data.businessId.length >= 3;
    }
    return true;
}, {
    message: "Business ID (CNPJ/NIF) is required when you have a business registration",
    path: ["businessId"],
});

const experienceSchema = z.object({
    currentOccupation: z.string().optional(),
    areaOfExpertise: z.array(z.string()).min(1, "Select at least one expertise"),
    otherAreaOfExpertise: z.string().optional(),
    yearsOfExperience: z.string().min(1, "Years of experience is required"),
    interestedRoles: z.array(z.string()).min(1, "Select at least one role"),
    visaExperience: z.string().min(1, "Please select your visa experience"),
    englishLevel: z.string().min(1, "English level is required"),
    clientExperience: z.enum(["Yes", "No"]).refine((val) => val !== undefined, {
        message: "Please select if you have client experience",
    }),
    clientExperienceDescription: z.string().optional(),
}).refine((data) => {
    if (data.clientExperience === "Yes") {
        return data.clientExperienceDescription && data.clientExperienceDescription.length >= 10;
    }
    return true;
}, {
    message: "Please describe your client experience",
    path: ["clientExperienceDescription"],
}).refine((data) => {
    if (data.areaOfExpertise?.includes("Other")) {
        return data.otherAreaOfExpertise && data.otherAreaOfExpertise.trim().length >= 3;
    }
    return true;
}, {
    message: "Please specify your area of expertise",
    path: ["otherAreaOfExpertise"],
});

const fitSchema = z.object({
    weeklyAvailability: z.string().min(1, "Availability is required"),
    whyMigma: z.string()
        .min(1, "This field is required")
        .refine((val) => val.trim().length >= 10, {
            message: "Please tell us more about why you want to join (minimum 10 characters)",
        }),
    comfortableModel: z.boolean().refine(val => val === true, "You must acknowledge the contractor status"),
});

const finalizeSchema = z.object({
    linkedin: z.string().optional().refine((val) => !val || z.string().url().safeParse(val).success, {
        message: "Invalid URL",
    }),
    otherLinks: z.string().optional(),
    cv: z.any().refine((val) => val !== undefined && val !== null, {
        message: "CV file is required",
    }),
});

const consentSchema = z.object({
    infoAccurate: z.boolean()
        .default(false)
        .refine(val => val === true, {
            message: "You must confirm that all information is accurate",
        }),
    marketingConsent: z.boolean().optional().default(false),
});

// Combined schema for type inference (though we validate step-by-step)
const formSchema = personalSchema.merge(legalSchema).merge(experienceSchema).merge(fitSchema).merge(finalizeSchema).merge(consentSchema);
type FormData = z.infer<typeof formSchema>;

export const GlobalPartner = () => {
    const heroRef = useRef(null);
    const cardRef = React.useRef<HTMLDivElement>(null);
    const [isScrolled, setIsScrolled] = useState(false);
    const { scrollYProgress } = useScroll({
        target: heroRef,
        offset: ["start end", "end start"],
    });

    const translateY = useTransform(scrollYProgress, [0, 1], [150, -150]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleScroll = () => {
            const scrollPosition = window.scrollY;
            setIsScrolled(scrollPosition > 50);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToForm = () => {
        const element = document.getElementById('application-form');
        element?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="min-h-screen bg-background font-sans text-foreground">
            {/* Wrapper com gradiente azul para Header + Hero */}
            <div style={{ background: "radial-gradient(ellipse 200% 100% at bottom left, #000000, #1a1a1a 100%)" }} className="pt-[80px]">
                {/* Header - Replicado do Template */}
                <header className={`fixed top-0 left-0 right-0 backdrop-blur-sm z-50 transition-colors duration-300 ${isScrolled ? 'bg-black/95' : 'bg-transparent'}`}>
                    <div className={`py-3 transition-colors duration-300 ${isScrolled ? 'bg-black/95' : 'bg-transparent'}`}>
                        <div className="container">
                            <div className="flex items-center justify-between">
                                <Link to="/" className="flex items-center gap-2">
                                    <img
                                        src="/logo2.png"
                                        alt="MIGMA INC"
                                        className="h-16 md:h-20 w-auto"
                                    />
                                </Link>
                                <svg className={`h-5 w-5 md:hidden transition-colors duration-300 ${isScrolled ? 'text-gold-light' : 'text-white'}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M3 12H21M3 6H21M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <nav className={`hidden md:flex gap-6 items-center transition-colors duration-300 ${isScrolled ? 'text-gold-light' : 'text-gold-light'}`}>
                                    <a href="#benefits" className="transition hover:text-gold-medium">Benefits</a>
                                    <a href="#how-it-works" className="transition hover:text-gold-medium">How it works</a>
                                    <button onClick={scrollToForm} className="px-4 py-2 rounded-lg font-bold inline-flex items-center justify-center tracking-tight hover:opacity-90 transition shadow-lg" style={{ background: 'linear-gradient(180deg, #F3E196 0%, #CE9F48 50%, #F3E196 100%)', color: '#000', WebkitTextFillColor: '#000', boxShadow: '0 4px 12px rgba(206, 159, 72, 0.4)' }}>
                                        Get started
                                    </button>
                                </nav>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Section A: Hero - Replicado do Template */}
                <section
                    ref={heroRef}
                    className="pt-8 pb-20 md:pt-5 md:pb-10 overflow-x-clip"
                >
                    <div className="container">
                        <div className="md:flex items-center">
                            <div className="md:w-[478px]">
                                <div className="text-sm inline-flex border border-gold-medium/30 bg-gold-dark/20 text-gold-light px-3 py-1 rounded-lg tracking-tight">
                                    Global Partner Program
                                </div>
                                <h1 className="text-5xl md:text-7xl font-bold tracking-tighter migma-gold-text mt-6">
                                    Work with MIGMA from anywhere in the world
                                </h1>
                                <p className="text-xl text-gold-light tracking-tight mt-6">
                                    Join the MIGMA Global Partner Program and collaborate with us as a Global Independent Contractor Partner.
                                </p>
                                <div className="flex gap-1 items-center mt-[30px]">
                                    <button onClick={scrollToForm} className="btn btn-primary">Apply to Become a Global Partner</button>
                                </div>
                            </div>
                            <div className="mt-20 md:mt-0 md:h-[648px] md:flex-1 relative">
                                <motion.img
                                    src="/foto1.png"
                                    alt="Global Network"
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
                                    width={220}
                                    height={220}
                                    alt="USD Symbol"
                                    className="hidden md:block -top-8 -left-32 md:absolute rotate-[15deg]"
                                    style={{
                                        translateY: translateY,
                                        rotate: 15,
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            {/* Foto3 entre seções para efeito 3D */}
            <div className="relative w-full overflow-x-clip -mt-32 mb-32">
                <motion.img
                    src="/foto3.png"
                    width={250}
                    alt="Global Network Connections"
                    className="hidden lg:block absolute top-1/2 right-[18%] -translate-y-1/2 rotate-[30deg]"
                    style={{
                        rotate: 30,
                        translateY: translateY,
                        zIndex: 10,
                    }}
                />
            </div>

            {/* Section B: Benefits Grid */}
            <section id="benefits" className="bg-gradient-to-b from-black via-[#1a1a1a] to-black py-24 overflow-x-clip relative">
                <div className="container">
                    {/* Heading centralizado inspirado no template */}
                    <div className="section-heading mb-16">
                        <div className="flex justify-center">
                            <div className="tag">Why join MIGMA</div>
                        </div>
                        <h2 className="section-title mt-5">
                            Work with freedom and earn in USD
                        </h2>
                        <p className="section-description mt-5 text-white">
                            Join a global team of talented professionals and enjoy the benefits of working remotely with competitive compensation.
                        </p>
                    </div>

                    {/* Elementos 3D decorativos com parallax */}
                    <motion.img
                        src="/foto4.png"
                        alt="Trophy Success"
                        width={262}
                        height={262}
                        className="hidden md:block absolute right-4 top-16 rotate-[15deg]"
                        style={{
                            translateY: translateY,
                            rotate: 15,
                        }}
                    />
                    <motion.img
                        src="/foto5.png"
                        alt="Global Location"
                        width={248}
                        height={248}
                        className="hidden md:block absolute bottom-8 left-0"
                        style={{
                            translateY: translateY,
                        }}
                    />

                    {/* Grid de benefícios */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
                        {/* Card 1: Earn in USD */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 }}
                            className="group"
                        >
                            <div className="relative h-full bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 rounded-2xl p-8 shadow-[0_7px_14px_rgba(206,159,72,0.1)] hover:shadow-[0_14px_28px_rgba(206,159,72,0.2)] transition-all duration-300 border border-gold-medium/30">
                                <div className="w-16 h-16 mb-6 group-hover:scale-110 transition-transform duration-300">
                                    <img src="/money-icon.svg" alt="Money" className="w-full h-full" />
                                </div>
                                <h3 className="text-2xl font-bold mb-4 migma-gold-text">Earn in USD</h3>
                                <p className="text-gray-300 leading-relaxed">
                                    Competitive compensation paid in US Dollars, regardless of your location.
                                </p>
                            </div>
                        </motion.div>

                        {/* Card 2: Work Remotely */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.2 }}
                            className="group"
                        >
                            <div className="relative h-full bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 rounded-2xl p-8 shadow-[0_7px_14px_rgba(206,159,72,0.1)] hover:shadow-[0_14px_28px_rgba(206,159,72,0.2)] transition-all duration-300 border border-gold-medium/30">
                                <div className="w-16 h-16 mb-6 group-hover:scale-110 transition-transform duration-300">
                                    <img src="/remote-work-icon.svg" alt="Remote Work" className="w-full h-full" />
                                </div>
                                <h3 className="text-2xl font-bold mb-4 migma-gold-text">Work Remotely</h3>
                                <p className="text-gray-300 leading-relaxed">
                                    Complete freedom to work from anywhere. All you need is a reliable internet connection.
                                </p>
                            </div>
                        </motion.div>

                        {/* Card 3: Business Registration */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.3 }}
                            className="group"
                        >
                            <div className="relative h-full bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 rounded-2xl p-8 shadow-[0_7px_14px_rgba(206,159,72,0.1)] hover:shadow-[0_14px_28px_rgba(206,159,72,0.2)] transition-all duration-300 border border-gold-medium/30">
                                <div className="w-16 h-16 mb-6 group-hover:scale-110 transition-transform duration-300">
                                    <img src="/business-icon.svg" alt="Business" className="w-full h-full" />
                                </div>
                                <h3 className="text-2xl font-bold mb-4 migma-gold-text">Business Entity Required</h3>
                                <p className="text-gray-300 leading-relaxed">
                                    You must have a valid business entity (CNPJ, NIF, or equivalent) to invoice us.
                                </p>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Section C: Who is this for? */}
            <section id="who-is-this-for" className="bg-gradient-to-b from-[#1a1a1a] to-black py-24">
                <div className="container max-w-3xl">
                    <div className="section-heading mb-16">
                        <h2 className="section-title">Who is the MIGMA Global Partner Program for?</h2>
                        <p className="section-description mt-5 text-gray-300">
                            We are looking for ambitious people and companies who want to work with MIGMA as independent contractors and help us expand globally.
                        </p>
                    </div>
                    <div className="space-y-4">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 }}
                            className="flex items-start gap-3"
                        >
                            <div className="w-2 h-2 rounded-full bg-gold-medium mt-2 flex-shrink-0" />
                            <p className="text-gray-400">You live in Brazil, Portugal, Angola, Mozambique, Cape Verde or any other country.</p>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.2 }}
                            className="flex items-start gap-3"
                        >
                            <div className="w-2 h-2 rounded-full bg-gold-medium mt-2 flex-shrink-0" />
                            <p className="text-gray-400">You have (or are able to obtain) a valid business or tax registration (CNPJ, NIF or equivalent).</p>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.3 }}
                            className="flex items-start gap-3"
                        >
                            <div className="w-2 h-2 rounded-full bg-gold-medium mt-2 flex-shrink-0" />
                            <p className="text-gray-400">You are comfortable working with clients, sales, service, operations or consulting.</p>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.4 }}
                            className="flex items-start gap-3"
                        >
                            <div className="w-2 h-2 rounded-full bg-gold-medium mt-2 flex-shrink-0" />
                            <p className="text-gray-400">You are open to being paid per result, commission or project.</p>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.5 }}
                            className="flex items-start gap-3"
                        >
                            <div className="w-2 h-2 rounded-full bg-gold-medium mt-2 flex-shrink-0" />
                            <p className="text-gray-400">You like the idea of growing with an international ecosystem instead of a traditional job.</p>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.6 }}
                            className="flex items-start gap-3"
                        >
                            <div className="w-2 h-2 rounded-full bg-gold-medium mt-2 flex-shrink-0" />
                            <p className="text-gray-400">You like to receive payments in USD.</p>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.7 }}
                            className="flex items-start gap-3"
                        >
                            <div className="w-2 h-2 rounded-full bg-gold-medium mt-2 flex-shrink-0" />
                            <p className="text-gray-400">You enjoy working with the United States visa process.</p>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Section D: Timeline */}
            <section id="how-it-works" className="bg-[#1a1a1a] py-24">
                <div className="container max-w-3xl">
                    <div className="section-heading mb-16">
                        <h2 className="section-title">How it works</h2>
                        <p className="section-description mt-5 text-gray-300">Join our global team in four simple steps</p>
                    </div>
                    <div className="relative border-l-2 border-gold-medium/30 ml-4 md:ml-0 md:pl-8 space-y-12">
                        {[
                            { title: 'Apply', desc: 'Submit your application with your professional details.' },
                            { title: 'Profile Review', desc: 'Our team reviews your experience and qualifications.' },
                            { title: 'Interview', desc: 'A brief call to discuss your fit and opportunities.' },
                            { title: 'Onboarding', desc: 'Get set up with our systems and start working.' },
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

            {/* Section E: Application Form */}
            <section id="application-form" className="bg-gradient-to-b from-black via-[#1a1a1a] to-black py-24">
                <div className="container max-w-3xl">
                    <div className="text-center mb-8">
                        <h2 className="section-title">Apply to become a MIGMA Global Partner</h2>
                        <p className="section-description mt-5 text-gray-300">
                            Tell us more about you, your experience and why you want to work with MIGMA. If your profile matches what we are looking for, you will receive an email to schedule an interview.
                        </p>
                    </div>
                    <Card ref={cardRef} className="border-gold-medium/30 shadow-2xl bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 backdrop-blur-sm">
                        <CardContent className="p-8 sm:p-12">
                            <ApplicationWizard cardRef={cardRef} />
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Section F: Testimonials */}
            <TestimonialsSection />

            {/* Section G: Call to Action */}
            <CallToActionSection scrollToForm={scrollToForm} />

            {/* Footer */}
            <FooterSection />
        </div>
    );
};

// Testimonials Section
const TestimonialsSection = () => {
    const testimonials = [
        {
            text: "Working with MIGMA as a Global Partner has been an incredible experience. The flexibility and support are unmatched.",
            imageSrc: "/avatar-1.png",
            name: "Sarah Chen",
            username: "@sarahchen_dev",
        },
        {
            text: "The opportunity to work remotely while earning in USD has transformed my career. Highly recommend joining the program.",
            imageSrc: "/avatar-2.png",
            name: "Marcus Rodriguez",
            username: "@marcus_tech",
        },
        {
            text: "MIGMA's Global Partner Program offers the perfect balance of independence and collaboration.",
            imageSrc: "/avatar-3.png",
            name: "Priya Patel",
            username: "@priya_design",
        },
        {
            text: "As a contractor, I appreciate the professional structure and competitive compensation MIGMA provides.",
            imageSrc: "/avatar-4.png",
            name: "David Kim",
            username: "@davidkim_dev",
        },
        {
            text: "The onboarding process was smooth, and the team is always available to help. Great experience overall.",
            imageSrc: "/avatar-5.png",
            name: "Emma Wilson",
            username: "@emmawilson",
        },
        {
            text: "Working with MIGMA has opened doors to exciting projects I wouldn't have access to otherwise.",
            imageSrc: "/avatar-6.png",
            name: "James Taylor",
            username: "@jamestaylor",
        },
        {
            text: "The freedom to work from anywhere combined with USD payments makes this program ideal for global professionals.",
            imageSrc: "/avatar-7.png",
            name: "Luna Martinez",
            username: "@lunamartinez",
        },
        {
            text: "MIGMA values quality work and provides the resources needed to deliver exceptional results.",
            imageSrc: "/avatar-8.png",
            name: "Alex Johnson",
            username: "@alexjohnson",
        },
        {
            text: "Being part of MIGMA's global network has expanded my professional horizons significantly.",
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
                            <React.Fragment key={index}>
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
                            </React.Fragment>
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
                        <div className="tag">Testimonials</div>
                    </div>
                    <h2 className="section-title mt-5">What our partners say</h2>
                    <p className="section-description mt-5 text-gray-300">
                        Join a community of talented professionals who have found success working with MIGMA as Global Partners.
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

// Call to Action Section
const CallToActionSection = ({ scrollToForm }: { scrollToForm: () => void }) => {
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
                    <h2 className="section-title">Ready to join our global team?</h2>
                    <p className="section-description mt-5 migma-gold-text">
                        Start your journey as a MIGMA Global Partner and work with freedom, earn in USD, and collaborate with a world-class team.
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
                    <button onClick={scrollToForm} className="btn btn-primary">Apply now</button>
                </div>
            </div>
        </section>
    );
};

// Footer Section
const FooterSection = () => {
    return (
        <footer className="bg-black text-gold-light/70 text-sm py-10">
            <div className="container">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
                    {/* Logo and Copyright */}
                    <div className="flex flex-col items-center md:items-start">
                        <Link to="/" className="inline-flex mb-4">
                            <img src="/logo2.png" alt="MIGMA INC" className="h-16 md:h-20 w-auto" />
                        </Link>
                        <p className="text-gray-400">&copy; 2025 MIGMA INC. All rights reserved.</p>
                    </div>

                    {/* Navigation Links */}
                    <nav className="flex flex-col md:flex-row gap-6 md:gap-8">
                        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                            <Link to="/" className="transition hover:text-gold-medium text-center md:text-left">
                                Home
                            </Link>
                            <Link to="/services" className="transition hover:text-gold-medium text-center md:text-left">
                                Services
                            </Link>
                            <Link to="/about" className="transition hover:text-gold-medium text-center md:text-left">
                                About
                            </Link>
                            <Link to="/contact" className="transition hover:text-gold-medium text-center md:text-left">
                                Contact
                            </Link>
                            <a href="#benefits" className="transition hover:text-gold-medium text-center md:text-left">
                                Benefits
                            </a>
                            <a href="#how-it-works" className="transition hover:text-gold-medium text-center md:text-left">
                                How it works
                            </a>
                            <a href="#application-form" className="transition hover:text-gold-medium text-center md:text-left">
                                Apply
                            </a>
                        </div>
                        <div className="flex flex-col md:flex-row gap-4 md:gap-6 border-t md:border-t-0 md:border-l border-gold-medium/30 pt-4 md:pt-0 md:pl-6">
                            <Link to="/legal/privacy-policy" className="transition hover:text-gold-medium text-center md:text-left">
                                Privacy Policy
                            </Link>
                            <Link to="/legal/website-terms" className="transition hover:text-gold-medium text-center md:text-left">
                                Website Terms
                            </Link>
                            <Link to="/legal/cookies" className="transition hover:text-gold-medium text-center md:text-left">
                                Cookies
                            </Link>
                        </div>
                    </nav>
                </div>
            </div>
        </footer>
    );
};

// Lista de países
const countries = [
    'Brazil', 'Portugal', 'Angola', 'Mozambique', 'Cape Verde', 'United States', 'United Kingdom',
    'Canada', 'Australia', 'Germany', 'France', 'Spain', 'Italy', 'Netherlands', 'Belgium',
    'Switzerland', 'Austria', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Poland', 'Czech Republic',
    'Ireland', 'New Zealand', 'Japan', 'South Korea', 'Singapore', 'Hong Kong', 'Mexico', 'Argentina',
    'Chile', 'Colombia', 'Peru', 'Ecuador', 'Uruguay', 'Paraguay', 'Venezuela', 'Other'
];

// Mapeamento de países para códigos de telefone
const countryPhoneCodes: Record<string, string> = {
    'Brazil': '+55',
    'Portugal': '+351',
    'Angola': '+244',
    'Mozambique': '+258',
    'Cape Verde': '+238',
    'United States': '+1',
    'United Kingdom': '+44',
    'Canada': '+1',
    'Australia': '+61',
    'Germany': '+49',
    'France': '+33',
    'Spain': '+34',
    'Italy': '+39',
    'Netherlands': '+31',
    'Belgium': '+32',
    'Switzerland': '+41',
    'Austria': '+43',
    'Sweden': '+46',
    'Norway': '+47',
    'Denmark': '+45',
    'Finland': '+358',
    'Poland': '+48',
    'Czech Republic': '+420',
    'Ireland': '+353',
    'New Zealand': '+64',
    'Japan': '+81',
    'South Korea': '+82',
    'Singapore': '+65',
    'Hong Kong': '+852',
    'Mexico': '+52',
    'Argentina': '+54',
    'Chile': '+56',
    'Colombia': '+57',
    'Peru': '+51',
    'Ecuador': '+593',
    'Uruguay': '+598',
    'Paraguay': '+595',
    'Venezuela': '+58',
    'Other': '+',
};

const STORAGE_KEY = 'migma_application_form';

interface ApplicationWizardProps {
    cardRef?: React.RefObject<HTMLDivElement | null>;
}

const ApplicationWizard = ({ cardRef }: ApplicationWizardProps) => {
    // Função para mostrar aviso visual (similar ao useContentProtection)
    const showWarning = (message: string) => {
        // Adicionar estilos de animação se não existirem
        if (!document.getElementById('global-partner-warning-styles')) {
            const style = document.createElement('style');
            style.id = 'global-partner-warning-styles';
            style.textContent = `
                @keyframes slideInWarning {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes slideOutWarning {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        // Criar elemento de aviso temporário
        const warning = document.createElement('div');
        warning.textContent = message;
        warning.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(206, 159, 72, 0.95);
            color: #000;
            padding: 12px 20px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            animation: slideInWarning 0.3s ease-out;
            max-width: 400px;
            word-wrap: break-word;
        `;
        document.body.appendChild(warning);

        setTimeout(() => {
            warning.style.animation = 'slideOutWarning 0.3s ease-out';
            setTimeout(() => {
                if (warning.parentNode) {
                    warning.parentNode.removeChild(warning);
                }
            }, 300);
        }, 3000); // Mostrar por 3 segundos
    };
    const navigate = useNavigate();

    // Load saved form data first to check if we should redirect to step 5
    const savedFormData = React.useMemo(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                return parsed;
            }
        } catch (error) {
            console.warn('Failed to load saved form data:', error);
        }
        return null;
    }, []);

    // Helper function to check if previous steps (1-4) are filled
    const arePreviousStepsFilled = (data: any): boolean => {
        if (!data) return false;

        // Check Step 1 (Personal Info) - required fields
        const step1Filled =
            data.fullName && data.fullName.trim().length >= 2 &&
            data.email && data.email.includes('@') &&
            data.phone && data.phone.trim().length >= 5 &&
            data.country && data.country.trim().length >= 2;

        // Check Step 2 (Legal) - required fields
        const step2Filled = data.hasBusiness !== undefined && data.hasBusiness !== null;
        // If hasBusiness is "Yes", also check businessId
        const step2Complete = data.hasBusiness === "Yes"
            ? (data.businessId && data.businessId.trim().length >= 3)
            : true;

        // Check Step 3 (Experience) - required fields
        const step3Filled =
            Array.isArray(data.areaOfExpertise) && data.areaOfExpertise.length > 0 &&
            data.yearsOfExperience &&
            Array.isArray(data.interestedRoles) && data.interestedRoles.length > 0 &&
            data.englishLevel &&
            data.visaExperience && // <- required select that caused issues when empty
            data.clientExperience !== undefined && data.clientExperience !== null;
        // If clientExperience is "Yes", also check description
        const step3Complete = data.clientExperience === "Yes"
            ? (data.clientExperienceDescription && data.clientExperienceDescription.trim().length >= 10)
            : true;
        // If "Other" is selected, check otherAreaOfExpertise
        const step3OtherComplete = data.areaOfExpertise?.includes("Other")
            ? (data.otherAreaOfExpertise && data.otherAreaOfExpertise.trim().length >= 3)
            : true;

        // Check Step 4 (Fit) - required fields
        const step4Filled =
            data.weeklyAvailability &&
            data.whyMigma && data.whyMigma.trim().length >= 10 &&
            data.comfortableModel === true;

        // All previous steps (1-4) must be filled
        return step1Filled &&
            step2Filled && step2Complete &&
            step3Filled && step3Complete && step3OtherComplete &&
            step4Filled;
    };

    // Always start at step 1, then check if we should redirect to step 5
    const [step, setStep] = React.useState(1);
    const [triedToSubmit, setTriedToSubmit] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const isSubmittingRef = React.useRef(false); // Ref para evitar race conditions
    const formRef = React.useRef<HTMLDivElement>(null); // Ref para o formulário
    const totalSteps = 6;

    // Scroll to top of form when step changes (especially important on mobile)
    React.useEffect(() => {
        // Skip scroll on initial mount (step 1)
        if (step === 1) return;

        // Small delay to ensure DOM is updated and step content is rendered
        const timer = setTimeout(() => {
            // Priorizar cardRef se disponível (aponta para o Card)
            if (cardRef?.current) {
                const element = cardRef.current;
                const rect = element.getBoundingClientRect();
                const elementTop = rect.top + window.scrollY;

                // Sempre fazer scroll para o topo do Card quando o step muda
                // Calcular a posição absoluta do elemento e fazer scroll manual
                // Isso garante que o scroll aconteça mesmo quando rect.top está próximo de 0
                const targetScroll = elementTop - 120; // 120px de offset do topo para melhor visualização
                window.scrollTo({ top: targetScroll, behavior: 'smooth' });
            } else if (formRef.current) {
                // Fallback para formRef (div interno)
                formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                // Fallback final: section application-form
                const formElement = document.getElementById('application-form');
                if (formElement) {
                    formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        }, 100); // Small delay to ensure step animation starts

        return () => clearTimeout(timer);
    }, [step, cardRef]);

    // Load saved form data from localStorage
    const loadSavedFormData = (): Partial<FormData> => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Remove cv file and cvInfo from saved data (can't be serialized)
                const { cv, cvInfo, ...rest } = parsed;
                return rest;
            }
        } catch (error) {
            console.warn('Failed to load saved form data:', error);
        }
        return {};
    };

    // We use a single form for all steps, but validate per step
    const form = useForm<FormData>({
        resolver: zodResolver(formSchema) as any,
        mode: 'onBlur', // Validate on blur for better UX
        reValidateMode: 'onChange', // Re-validate on change after first validation
        shouldFocusError: false, // Don't auto-focus on error
        defaultValues: {
            areaOfExpertise: [],
            otherAreaOfExpertise: '',
            interestedRoles: [],
            hasBusiness: undefined,
            clientExperience: undefined,
            infoAccurate: false,
            marketingConsent: false,
            ...loadSavedFormData(), // Merge saved data
        }
    });

    const { register, trigger, formState: { errors }, setValue, watch } = form;
    const areaOfExpertise = watch('areaOfExpertise') || [];
    const interestedRoles = watch('interestedRoles') || [];

    // Ensure complex array fields are registered so validation runs correctly
    React.useEffect(() => {
        register('areaOfExpertise');
        register('interestedRoles');
    }, [register]);

    // Watch all form values to save to localStorage
    const formValues = watch();
    const cvFile = watch('cv');

    // Save form data to localStorage whenever it changes
    React.useEffect(() => {
        try {
            // Don't save the CV file (can't be serialized), but save CV info
            const { cv, ...dataToSave } = formValues;

            // Save CV metadata if CV file is selected
            if (cvFile && cvFile instanceof File) {
                (dataToSave as any).cvInfo = {
                    name: cvFile.name,
                    size: cvFile.size,
                    type: cvFile.type,
                    lastModified: cvFile.lastModified,
                };
            } else {
                // Remove cvInfo if CV is not set
                delete (dataToSave as any).cvInfo;
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
        } catch (error) {
            console.warn('Failed to save form data to localStorage:', error);
        }
    }, [formValues, cvFile]);

    // Check on mount if we should redirect to step 5
    // This happens after form is initialized with saved data
    React.useEffect(() => {
        if (!savedFormData) return;

        // Check if steps 1-4 are filled
        if (arePreviousStepsFilled(savedFormData)) {
            // Wait a moment for form to initialize, then check CV
            const timer = setTimeout(() => {
                const currentCvFile = form.getValues('cv');

                // If no CV file is currently selected, redirect to step 5
                // Note: cvInfo in savedFormData indicates there was a CV before, but File objects can't be restored from localStorage
                // So we always need to redirect to step 5 if steps 1-4 are complete and no file is selected
                if (!currentCvFile || !(currentCvFile instanceof File)) {
                    setStep(5);
                }
            }, 50);

            return () => clearTimeout(timer);
        }
    }, []); // Only run once on mount

    const hasBusiness = watch('hasBusiness');
    const clientExperience = watch('clientExperience');
    const selectedCountry = watch('country');
    const hasOtherSelected = areaOfExpertise?.includes('Other');

    // Função para atualizar código do país no telefone
    const updatePhoneWithCountryCode = (country: string) => {
        if (country && countryPhoneCodes[country]) {
            const countryCode = countryPhoneCodes[country];
            const currentPhoneValue = watch('phone') || '';
            // Se o telefone não começar com o código do país, adiciona automaticamente
            if (!currentPhoneValue.startsWith(countryCode)) {
                // Remove qualquer código de país existente e adiciona o novo
                const phoneWithoutCode = currentPhoneValue.replace(/^\+\d{1,4}\s?/, '');
                setValue('phone', countryCode + (phoneWithoutCode ? ' ' + phoneWithoutCode : ''));
            }
        }
    };

    const validateStep = async (currentStep: number) => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/28ab7e6c-aff6-477c-b6d9-0ba600b33f6d', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: 'debug-session',
                runId: 'pre-fix-1',
                hypothesisId: 'H1',
                location: 'GlobalPartner.tsx:validateStep:entry',
                message: 'validateStep called',
                data: { currentStep },
                timestamp: Date.now(),
            }),
        }).catch(() => { });
        // #endregion agent log
        let fieldsToValidate: (keyof FormData)[] = [];
        switch (currentStep) {
            case 1:
                fieldsToValidate = ['fullName', 'email', 'phone', 'country'];
                // Validate email format first
                const emailValid = await trigger(['email']);
                if (emailValid) {
                    // If email format is valid, check if it already exists
                    const emailValue = watch('email');
                    if (emailValue) {
                        try {
                            // Adicionar timeout para evitar que a validação trave
                            const emailExists = await Promise.race([
                                checkEmailExists(emailValue),
                                new Promise<boolean>((resolve) =>
                                    setTimeout(() => resolve(false), 5000) // Timeout de 5 segundos
                                )
                            ]);
                            if (emailExists) {
                                form.setError('email', {
                                    type: 'manual',
                                    message: 'This email is already registered. Please use a different email address.',
                                });
                                return false;
                            }
                        } catch (error) {
                            console.warn('Error checking email (continuing anyway):', error);
                            // Se houver erro, continua (deixa o banco de dados validar)
                        }
                    }
                }
                break;
            case 2: fieldsToValidate = ['hasBusiness', 'businessId']; break;
            case 3:
                fieldsToValidate = [
                    'areaOfExpertise',
                    'otherAreaOfExpertise',
                    'yearsOfExperience',
                    'interestedRoles',
                    'visaExperience',
                    'englishLevel',
                    'clientExperience',
                    'clientExperienceDescription',
                ];
                break;
            case 4: fieldsToValidate = ['weeklyAvailability', 'whyMigma', 'comfortableModel']; break;
            case 5: fieldsToValidate = ['cv']; break;
            case 6: fieldsToValidate = ['infoAccurate']; break;
        }

        const result = await trigger(fieldsToValidate);

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/28ab7e6c-aff6-477c-b6d9-0ba600b33f6d', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: 'debug-session',
                runId: 'pre-fix-1',
                hypothesisId: 'H2',
                location: 'GlobalPartner.tsx:validateStep:afterTrigger',
                message: 'After trigger validation',
                data: { currentStep, result, fieldsToValidate },
                timestamp: Date.now(),
            }),
        }).catch(() => { });
        // #endregion agent log

        // Hard guard for multi-select arrays on step 3, to avoid any edge cases
        if (currentStep === 3) {
            const values = form.getValues();

            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/28ab7e6c-aff6-477c-b6d9-0ba600b33f6d', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: 'debug-session',
                    runId: 'pre-fix-1',
                    hypothesisId: 'H3',
                    location: 'GlobalPartner.tsx:validateStep:step3Values',
                    message: 'Step 3 values before hard guard',
                    data: {
                        areaOfExpertise: values.areaOfExpertise,
                        interestedRoles: values.interestedRoles,
                        yearsOfExperience: values.yearsOfExperience,
                        visaExperience: values.visaExperience,
                        englishLevel: values.englishLevel,
                    },
                    timestamp: Date.now(),
                }),
            }).catch(() => { });
            // #endregion agent log

            if (!values.areaOfExpertise || !Array.isArray(values.areaOfExpertise) || values.areaOfExpertise.length === 0) {
                form.setError('areaOfExpertise', {
                    type: 'manual',
                    message: 'Select at least one expertise',
                });

                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/28ab7e6c-aff6-477c-b6d9-0ba600b33f6d', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: 'debug-session',
                        runId: 'pre-fix-1',
                        hypothesisId: 'H4',
                        location: 'GlobalPartner.tsx:validateStep:areaOfExpertiseFail',
                        message: 'Blocking step advance: areaOfExpertise empty',
                        data: { areaOfExpertise: values.areaOfExpertise },
                        timestamp: Date.now(),
                    }),
                }).catch(() => { });
                // #endregion agent log

                return false;
            }

            if (!values.interestedRoles || !Array.isArray(values.interestedRoles) || values.interestedRoles.length === 0) {
                form.setError('interestedRoles', {
                    type: 'manual',
                    message: 'Select at least one role',
                });

                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/28ab7e6c-aff6-477c-b6d9-0ba600b33f6d', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: 'debug-session',
                        runId: 'pre-fix-1',
                        hypothesisId: 'H5',
                        location: 'GlobalPartner.tsx:validateStep:interestedRolesFail',
                        message: 'Blocking step advance: interestedRoles empty',
                        data: { interestedRoles: values.interestedRoles },
                        timestamp: Date.now(),
                    }),
                }).catch(() => { });
                // #endregion agent log

                return false;
            }
        }

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/28ab7e6c-aff6-477c-b6d9-0ba600b33f6d', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: 'debug-session',
                runId: 'pre-fix-1',
                hypothesisId: 'H6',
                location: 'GlobalPartner.tsx:validateStep:return',
                message: 'validateStep returning',
                data: { currentStep, result },
                timestamp: Date.now(),
            }),
        }).catch(() => { });
        // #endregion agent log

        return result;
    };

    const handleNext = async (e?: React.MouseEvent) => {
        // Prevent form submission
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        // Mark that user tried to advance (for step 6, this means they tried to submit)
        if (step === 6) {
            setTriedToSubmit(true);
        }

        const isStepValid = await validateStep(step);

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/28ab7e6c-aff6-477c-b6d9-0ba600b33f6d', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: 'debug-session',
                runId: 'pre-fix-1',
                hypothesisId: 'H7',
                location: 'GlobalPartner.tsx:handleNext:afterValidate',
                message: 'Result of validateStep',
                data: { step, isStepValid },
                timestamp: Date.now(),
            }),
        }).catch(() => { });
        // #endregion agent log

        if (isStepValid) {
            // Only advance if not on the last step
            if (step < totalSteps) {
                setStep((s) => Math.min(s + 1, totalSteps));
            }
        }
    };

    const handlePrev = () => setStep((s) => Math.max(s - 1, 1));

    const progress = (step / totalSteps) * 100;

    const getClientIP = async (): Promise<string | null> => {
        try {
            // Try to get IP from a public API
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip || null;
        } catch (error) {
            console.warn('Could not fetch IP address:', error);
            return null;
        }
    };

    // Find the first step with missing required fields
    const findFirstInvalidStep = async (): Promise<number | null> => {
        // Validar steps em paralelo para ser mais rápido (exceto step 1 que precisa validar email primeiro)
        // Step 1 primeiro (pode ter validação de email assíncrona)
        const step1Valid = await validateStep(1);
        if (!step1Valid) return 1;

        // Validar steps 2-6 em paralelo
        const validationPromises = [];
        for (let stepNum = 2; stepNum <= totalSteps; stepNum++) {
            validationPromises.push(validateStep(stepNum).then(isValid => ({ stepNum, isValid })));
        }

        const results = await Promise.all(validationPromises);
        for (const { stepNum, isValid } of results) {
            if (!isValid) {
                return stepNum;
            }
        }

        return null;
    };

    const onSubmit = async (data: FormData) => {
        // Only allow submission from step 6 (Consents step)
        if (step !== 6) {
            // If not on step 6, just advance to next step instead
            await handleNext();
            return;
        }

        // Proteção contra múltiplos cliques (race condition)
        if (isSubmittingRef.current || isSubmitting) {
            console.log('[FORM] Submit already in progress, ignoring duplicate click');
            return;
        }

        isSubmittingRef.current = true;
        setIsSubmitting(true);
        try {
            // First, validate all steps to find any missing required fields
            const firstInvalidStep = await findFirstInvalidStep();
            if (firstInvalidStep !== null) {
                // Get step name for better user feedback
                const stepNames: Record<number, string> = {
                    1: 'Personal Information',
                    2: 'Legal & Business',
                    3: 'Experience & Expertise',
                    4: 'Availability & Fit',
                    5: 'CV & Links',
                    6: 'Consents'
                };

                const stepName = stepNames[firstInvalidStep] || `Step ${firstInvalidStep}`;

                // Show warning message
                showWarning(`Please complete all required fields in "${stepName}" before submitting.`);

                // Redirect to the step with missing required field
                setStep(firstInvalidStep);
                setTriedToSubmit(true);
                setIsSubmitting(false);
                isSubmittingRef.current = false;

                // Small delay to ensure step change is visible before scrolling
                setTimeout(() => {
                    // Scroll to top of form to ensure user sees the step
                    const formElement = document.getElementById('application-form');
                    if (formElement) {
                        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                    // Trigger validation to show errors
                    validateStep(firstInvalidStep);
                }, 100);

                return;
            }

            // Step 1: Upload CV file
            let cvFilePath: string | undefined;
            let cvFileName: string | undefined;

            if (data.cv && data.cv instanceof File) {
                const uploadResult = await uploadCV(data.cv);
                if (!uploadResult.success) {
                    showWarning(`Error uploading CV: ${uploadResult.error}`);
                    setIsSubmitting(false);
                    isSubmittingRef.current = false;
                    return;
                }
                cvFilePath = uploadResult.filePath;
                cvFileName = uploadResult.fileName;
            }

            // Step 2: Get client IP address
            const ipAddress = await getClientIP();

            // Step 3: Prepare data for database
            // Ensure boolean fields are actual booleans, not strings
            // Process area_of_expertise: if "Other" is selected, replace it with the custom value
            let processedAreaOfExpertise = [...(data.areaOfExpertise || [])];
            if (processedAreaOfExpertise.includes('Other') && data.otherAreaOfExpertise?.trim()) {
                // Remove "Other" and add the custom value
                processedAreaOfExpertise = processedAreaOfExpertise.filter(area => area !== 'Other');
                processedAreaOfExpertise.push(`Other: ${data.otherAreaOfExpertise.trim()}`);
            }

            const applicationData = {
                full_name: data.fullName,
                email: data.email,
                phone: data.phone,
                country: data.country,
                city: data.city || null,
                has_business_registration: data.hasBusiness,
                registration_type: data.registrationType || null,
                business_name: data.businessName || null,
                business_id: data.businessId || null,
                tax_id: data.taxId || null,
                current_occupation: data.currentOccupation || null,
                area_of_expertise: processedAreaOfExpertise,
                interested_roles: data.interestedRoles || [],
                visa_experience: data.visaExperience || null,
                years_of_experience: data.yearsOfExperience,
                english_level: data.englishLevel,
                client_experience: data.clientExperience,
                client_experience_description: data.clientExperienceDescription || null,
                weekly_availability: data.weeklyAvailability,
                why_migma: data.whyMigma,
                comfortable_model: data.comfortableModel === true,
                linkedin_url: data.linkedin || null,
                other_links: data.otherLinks || null,
                cv_file_path: cvFilePath || null,
                cv_file_name: cvFileName || null,
                info_accurate: data.infoAccurate === true,
                marketing_consent: data.marketingConsent === true,
                ip_address: ipAddress || null,
            };

            console.log('[FORM DEBUG] Boolean values check:', {
                comfortableModel: data.comfortableModel,
                comfortableModelType: typeof data.comfortableModel,
                comfortableModelFinal: applicationData.comfortable_model,
                infoAccurate: data.infoAccurate,
                infoAccurateType: typeof data.infoAccurate,
                infoAccurateFinal: applicationData.info_accurate,
                marketingConsent: data.marketingConsent,
                marketingConsentType: typeof data.marketingConsent,
                marketingConsentFinal: applicationData.marketing_consent,
            });

            // Step 4: Insert into Supabase
            console.log('[FORM DEBUG] Inserting application data:', {
                email: data.email,
                fullName: data.fullName,
                country: data.country,
                hasBusiness: data.hasBusiness,
            });

            const { data: insertedData, error: insertError } = await supabase
                .from('global_partner_applications')
                .insert([applicationData])
                .select();

            if (insertError) {
                console.error('[FORM DEBUG] Error inserting application:', insertError);
                console.error('[FORM DEBUG] Error details:', {
                    code: insertError.code,
                    message: insertError.message,
                    details: insertError.details,
                });

                // Tratamento específico para email duplicado - set error on email field
                if (insertError.code === '23505' && insertError.message.includes('email')) {
                    form.setError('email', {
                        type: 'manual',
                        message: 'This email is already registered. Please use a different email address.',
                    });
                    // Go back to step 1 to show the error
                    setStep(1);
                } else {
                    showWarning(`Error submitting application: ${insertError.message}`);
                }
                setIsSubmitting(false);
                isSubmittingRef.current = false;
                return;
            }

            console.log('[FORM DEBUG] Application inserted successfully:', insertedData);

            // Step 5: Send confirmation email (não bloqueia o fluxo se falhar)
            console.log('[FORM DEBUG] Attempting to send confirmation email to:', data.email);
            try {
                const emailSent = await sendApplicationConfirmationEmail(data.email, data.fullName);
                if (emailSent) {
                    console.log('[FORM DEBUG] ✅ Confirmation email sent successfully');
                } else {
                    console.warn('[FORM DEBUG] ⚠️ Failed to send confirmation email (returned false)');
                }
            } catch (emailError) {
                console.error('[FORM DEBUG] ❌ Exception sending confirmation email:', emailError);
                // Não bloqueia o fluxo se o email falhar
            }

            // Step 6: Send notification emails to all admins (não bloqueia o fluxo se falhar)
            console.log('[FORM DEBUG] Attempting to notify admins...');
            try {
                const adminEmails = await getAllAdminEmails();

                if (adminEmails.length === 0) {
                    console.warn('[FORM DEBUG] ⚠️ No admin emails found to notify');
                } else {
                    // If running on localhost, skip the protected admin email
                    const isLocalhost = typeof window !== 'undefined' && (
                        window.location.hostname === 'localhost' ||
                        window.location.hostname === '127.0.0.1' ||
                        window.location.hostname === '::1' ||
                        window.location.hostname.includes('local')
                    );

                    const protectedAdminEmail = 'adm@migmainc.com';
                    let filteredAdminEmails = Array.isArray(adminEmails) ? [...adminEmails] : [];

                    if (isLocalhost) {
                        const beforeCount = filteredAdminEmails.length;
                        filteredAdminEmails = filteredAdminEmails.filter(e => !(e && e.toLowerCase() === protectedAdminEmail));
                        const removedCount = beforeCount - filteredAdminEmails.length;
                        if (removedCount > 0) {
                            console.log(`[FORM DEBUG] Localhost detected - skipping ${removedCount} protected admin email(s) (e.g. ${protectedAdminEmail})`);
                        }
                    }

                    console.log(`[FORM DEBUG] Sending notifications to ${filteredAdminEmails.length} admin(s)...`);

                    // Get application ID from inserted data
                    const applicationId = insertedData?.[0]?.id;

                    if (!applicationId) {
                        console.error('[FORM DEBUG] ❌ No application ID found, cannot notify admins');
                    } else {
                        // Send emails to all admins in parallel (use filtered list)
                        const adminNotificationPromises = filteredAdminEmails.map(adminEmail =>
                            sendAdminNewApplicationNotification(adminEmail, {
                                fullName: data.fullName,
                                email: data.email,
                                country: data.country,
                                applicationId: applicationId,
                            }).catch(error => {
                                console.error(`[FORM DEBUG] ❌ Failed to send notification to ${adminEmail}:`, error);
                                return false;
                            })
                        );

                        const results = await Promise.all(adminNotificationPromises);
                        const successCount = results.filter(result => result === true).length;

                        console.log(`[FORM DEBUG] ✅ Sent ${successCount} of ${filteredAdminEmails.length} admin notification(s)`);
                    }
                }
            } catch (adminNotificationError) {
                console.error('[FORM DEBUG] ❌ Exception notifying admins:', adminNotificationError);
                // Não bloqueia o fluxo se as notificações falharem
            }

            console.log('[FORM DEBUG] ✅ Application submitted successfully');

            // Clear localStorage after successful submission
            try {
                localStorage.removeItem(STORAGE_KEY);
            } catch (error) {
                console.warn('Failed to clear localStorage:', error);
            }

            // Redirect to thank you page
            navigate('/global-partner/thank-you');
        } catch (error) {
            console.error("Error submitting form:", error);
            showWarning("There was an error submitting your application. Please try again.");
            setIsSubmitting(false);
            isSubmittingRef.current = false;
        }
    };

    return (
        <div ref={formRef}>
            {/* Loading Overlay */}
            {isSubmitting && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="text-center">
                        <div className="loader-gold mx-auto mb-4"></div>
                        <p className="text-gold-light text-lg font-semibold">Submitting your application...</p>
                        <p className="text-gray-400 text-sm mt-2">Please wait</p>
                    </div>
                </div>
            )}

            <div className="mb-8">
                <div className="flex justify-between text-sm font-medium text-white mb-2">
                    <span>Step {step} of {totalSteps}</span>
                    <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {step === 1 && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                        <h3 className="text-2xl font-bold mb-4 text-white">Personal Information</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="fullName" className="text-white">Full Name *</Label>
                                <Input id="fullName" {...register('fullName')} className="bg-white text-black" />
                                {errors.fullName && <p className="text-sm text-destructive">{errors.fullName.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-white">Email *</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    {...register('email', {
                                        onBlur: async () => {
                                            const emailValue = watch('email');
                                            if (emailValue && emailValue.includes('@')) {
                                                await trigger('email');
                                            }
                                        }
                                    })}
                                    className="bg-white text-black"
                                />
                                {errors.email && (
                                    <p className="text-sm text-red-400 font-medium">{errors.email.message}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="country" className="text-white">Country *</Label>
                                <Select
                                    value={watch('country') || ''}
                                    onValueChange={(val) => {
                                        setValue('country', val);
                                        updatePhoneWithCountryCode(val);
                                    }}
                                >
                                    <SelectTrigger className="bg-white text-black">
                                        <SelectValue placeholder="Select a country" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {countries.map((country) => (
                                            <SelectItem key={country} value={country}>{country}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.country && <p className="text-sm text-destructive">{errors.country.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone" className="text-white">Phone * (include country code)</Label>
                                <Input
                                    id="phone"
                                    type="tel"
                                    placeholder={selectedCountry && countryPhoneCodes[selectedCountry] ? countryPhoneCodes[selectedCountry] + ' ...' : '+...'}
                                    {...register('phone')}
                                    className="bg-white text-black"
                                />
                                {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="city" className="text-white">City</Label>
                                <Input id="city" {...register('city')} className="bg-white text-black" />
                                {errors.city && <p className="text-sm text-destructive">{errors.city.message}</p>}
                            </div>
                        </div>
                    </motion.div>
                )}

                {step === 2 && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                        <h3 className="text-2xl font-bold mb-4 text-white">Legal / Tax Information</h3>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-white">Do you have a valid business or tax registration (CNPJ, NIF or equivalent)? *</Label>
                                <div className="flex gap-6">
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="radio"
                                            id="hasBusinessYes"
                                            value="Yes"
                                            {...register('hasBusiness')}
                                            className="w-4 h-4"
                                        />
                                        <Label htmlFor="hasBusinessYes" className="font-normal cursor-pointer text-white">Yes</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="radio"
                                            id="hasBusinessNo"
                                            value="No"
                                            {...register('hasBusiness')}
                                            className="w-4 h-4"
                                        />
                                        <Label htmlFor="hasBusinessNo" className="font-normal cursor-pointer text-white">No</Label>
                                    </div>
                                </div>
                                {errors.hasBusiness && <p className="text-sm text-destructive">{errors.hasBusiness.message}</p>}
                            </div>

                            {hasBusiness === "Yes" && (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="registrationType" className="text-white">Registration Type (CNPJ, NIF or equivalent)</Label>
                                        <Input id="registrationType" placeholder="CNPJ, NIF or equivalent" {...register('registrationType')} className="bg-white text-black" />
                                        {errors.registrationType && <p className="text-sm text-destructive">{errors.registrationType.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="businessId" className="text-white">Business Registration Number (CNPJ/NIF) *</Label>
                                        <Input id="businessId" {...register('businessId')} className="bg-white text-black" />
                                        {errors.businessId && <p className="text-sm text-destructive">{errors.businessId.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="businessName" className="text-white">Business Name</Label>
                                        <Input id="businessName" {...register('businessName')} className="bg-white text-black" />
                                        {errors.businessName && <p className="text-sm text-destructive">{errors.businessName.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="taxId" className="text-white">Tax ID</Label>
                                        <Input id="taxId" {...register('taxId')} className="bg-white text-black" />
                                        {errors.taxId && <p className="text-sm text-destructive">{errors.taxId.message}</p>}
                                    </div>
                                </>
                            )}
                        </div>
                    </motion.div>
                )}

                {step === 3 && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                        <h3 className="text-2xl font-bold mb-4 text-white">Professional Background</h3>

                        <div className="space-y-2">
                            <Label htmlFor="currentOccupation" className="text-white">Current Occupation</Label>
                            <Input id="currentOccupation" {...register('currentOccupation')} placeholder="e.g., Visa Consultant, Sales Closer, Assistant, Student, Administrator" className="bg-white text-black" />
                            {errors.currentOccupation && <p className="text-sm text-destructive">{errors.currentOccupation.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label className="text-white">Area of Expertise * (Select all that apply)</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {['Visa Consulting / Immigration Support', 'Sales – Closer', 'Sales – Pre-Sales / SDR / Lead Qualification', 'Sales Coordinator / Sales Operations', 'Customer Success / Client Support', 'Team Leadership / Management', 'Operations / Administrative Support', 'Other'].map((skill) => (
                                    <div key={skill} className="flex items-center space-x-2 border border-gold-medium/30 bg-white/10 p-3 rounded-md hover:bg-white/20 transition">
                                        <Checkbox
                                            id={`skill-${skill}`}
                                            checked={areaOfExpertise?.includes(skill)}
                                            onCheckedChange={(checked) => {
                                                const current = areaOfExpertise || [];
                                                const updated = checked
                                                    ? [...current, skill]
                                                    : current.filter((s) => s !== skill);
                                                setValue('areaOfExpertise', updated);
                                                // Clear other area if "Other" is unchecked
                                                if (!checked && skill === 'Other') {
                                                    setValue('otherAreaOfExpertise', '');
                                                }
                                            }}
                                        />
                                        <Label htmlFor={`skill-${skill}`} className="cursor-pointer flex-1 text-sm text-white">{skill}</Label>
                                    </div>
                                ))}
                            </div>
                            {errors.areaOfExpertise && <p className="text-sm text-destructive">{errors.areaOfExpertise.message}</p>}

                            {/* Campo condicional para "Other" */}
                            {hasOtherSelected && (
                                <div className="mt-3 space-y-2">
                                    <Label htmlFor="otherAreaOfExpertise" className="text-white">Please specify your area of expertise *</Label>
                                    <Input
                                        id="otherAreaOfExpertise"
                                        {...register('otherAreaOfExpertise')}
                                        placeholder="Enter your area of expertise"
                                        className="w-full bg-white text-black"
                                    />
                                    {errors.otherAreaOfExpertise && (
                                        <p className="text-sm text-destructive">{errors.otherAreaOfExpertise.message}</p>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label className="text-white">Years of Experience *</Label>
                            <Select
                                value={watch('yearsOfExperience') || ''}
                                onValueChange={(val) => setValue('yearsOfExperience', val)}
                            >
                                <SelectTrigger className="bg-white text-black">
                                    <SelectValue placeholder="Select years of experience" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Less than 1 year">Less than 1 year</SelectItem>
                                    <SelectItem value="1–3 years">1–3 years</SelectItem>
                                    <SelectItem value="3–5 years">3–5 years</SelectItem>
                                    <SelectItem value="5+ years">5+ years</SelectItem>
                                </SelectContent>
                            </Select>
                            {errors.yearsOfExperience && <p className="text-sm text-destructive">{errors.yearsOfExperience.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label className="text-white">Which role(s) are you interested in? (multi-select)</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {['Visa Consultant / Immigration Consultant', 'Sales Closer', 'Sales Pre-Sales / SDR', 'Sales Coordinator', 'Customer Support', 'Operational Assistant', 'Manager / Supervisor', 'Any role where MIGMA believes I am a good fit'].map((role) => (
                                    <div key={role} className="flex items-center space-x-2 border border-gold-medium/30 bg-white/10 p-3 rounded-md hover:bg-white/20 transition">
                                        <Checkbox
                                            id={`role-${role}`}
                                            checked={interestedRoles?.includes(role)}
                                            onCheckedChange={(checked) => {
                                                const current = interestedRoles || [];
                                                const updated = checked
                                                    ? [...current, role]
                                                    : current.filter((r) => r !== role);
                                                setValue('interestedRoles', updated);
                                            }}
                                        />
                                        <Label htmlFor={`role-${role}`} className="cursor-pointer flex-1 text-sm text-white">{role}</Label>
                                    </div>
                                ))}
                            </div>
                            {errors.interestedRoles && <p className="text-sm text-destructive">{errors.interestedRoles.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label className="text-white">Do you have experience with U.S. visa processes? *</Label>
                            <Select
                                value={watch('visaExperience') || ''}
                                onValueChange={(val) => setValue('visaExperience', val)}
                            >
                                <SelectTrigger className="bg-white text-black">
                                    <SelectValue placeholder="Select your experience" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Yes, professional experience">Yes, professional experience</SelectItem>
                                    <SelectItem value="Yes, informal experience">Yes, informal experience</SelectItem>
                                    <SelectItem value="No, but I learn fast">No, but I learn fast</SelectItem>
                                    <SelectItem value="No experience">No experience</SelectItem>
                                </SelectContent>
                            </Select>
                            {errors.visaExperience && <p className="text-sm text-destructive">{errors.visaExperience.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label className="text-white">English Level *</Label>
                            <Select
                                value={watch('englishLevel') || ''}
                                onValueChange={(val) => setValue('englishLevel', val)}
                            >
                                <SelectTrigger className="bg-white text-black">
                                    <SelectValue placeholder="Select English level" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Basic">Basic</SelectItem>
                                    <SelectItem value="Intermediate">Intermediate</SelectItem>
                                    <SelectItem value="Advanced">Advanced</SelectItem>
                                    <SelectItem value="Fluent / Native">Fluent / Native</SelectItem>
                                </SelectContent>
                            </Select>
                            {errors.englishLevel && <p className="text-sm text-destructive">{errors.englishLevel.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label className="text-white">Do you have experience working with clients, sales or business development? *</Label>
                            <div className="flex gap-6">
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="radio"
                                        id="clientExperienceYes"
                                        value="Yes"
                                        {...register('clientExperience')}
                                        className="w-4 h-4"
                                    />
                                    <Label htmlFor="clientExperienceYes" className="font-normal cursor-pointer text-white">Yes</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="radio"
                                        id="clientExperienceNo"
                                        value="No"
                                        {...register('clientExperience')}
                                        className="w-4 h-4"
                                    />
                                    <Label htmlFor="clientExperienceNo" className="font-normal cursor-pointer text-white">No</Label>
                                </div>
                            </div>
                            {errors.clientExperience && <p className="text-sm text-destructive">{errors.clientExperience.message}</p>}
                        </div>

                        {clientExperience === "Yes" && (
                            <div className="space-y-2">
                                <Label htmlFor="clientExperienceDescription" className="text-white">Please briefly describe your experience working with clients, sales or business development *</Label>
                                <Textarea id="clientExperienceDescription" className="min-h-[100px] bg-white text-black" {...register('clientExperienceDescription')} />
                                {errors.clientExperienceDescription && <p className="text-sm text-destructive">{errors.clientExperienceDescription.message}</p>}
                            </div>
                        )}
                    </motion.div>
                )}

                {step === 4 && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                        <h3 className="text-2xl font-bold mb-4 text-white">Availability & Fit</h3>
                        <div className="space-y-2">
                            <Label className="text-white">Weekly Availability *</Label>
                            <Select
                                value={watch('weeklyAvailability') || ''}
                                onValueChange={(val) => setValue('weeklyAvailability', val)}
                            >
                                <SelectTrigger className="bg-white text-black">
                                    <SelectValue placeholder="Select availability" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Up to 10 hours / week">Up to 10 hours / week</SelectItem>
                                    <SelectItem value="10–20 hours / week">10–20 hours / week</SelectItem>
                                    <SelectItem value="20–30 hours / week">20–30 hours / week</SelectItem>
                                    <SelectItem value="Full-time availability">Full-time availability</SelectItem>
                                </SelectContent>
                            </Select>
                            {errors.weeklyAvailability && <p className="text-sm text-destructive">{errors.weeklyAvailability.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="whyMigma" className="text-white">Why do you want to work with MIGMA as a Global Partner? *</Label>
                            <Textarea
                                id="whyMigma"
                                className="min-h-[120px] bg-white text-black"
                                {...register('whyMigma')}
                            />
                            {errors.whyMigma && <p className="text-sm text-destructive">{errors.whyMigma.message}</p>}
                        </div>

                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="comfortableModel"
                                checked={watch('comfortableModel') || false}
                                onCheckedChange={(checked) => {
                                    const boolValue = checked === true;
                                    setValue('comfortableModel', boolValue, { shouldValidate: true });
                                }}
                            />
                            <Label htmlFor="comfortableModel" className="font-normal text-white">I understand that this is not an employment offer and that the collaboration with MIGMA is as an independent contractor. *</Label>
                        </div>
                        {errors.comfortableModel && <p className="text-sm text-destructive">{errors.comfortableModel.message}</p>}
                    </motion.div>
                )}

                {step === 5 && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                        <h3 className="text-2xl font-bold mb-4 text-white">CV & Links</h3>
                        <div className="space-y-2">
                            <Label htmlFor="cv" className="text-white">Upload CV (PDF) *</Label>
                            <div className="border-2 border-dashed border-gold-medium/50 rounded-md p-8 text-center hover:bg-white/10 transition cursor-pointer flex flex-col items-center justify-center gap-2 relative bg-white/5">
                                <input
                                    type="file"
                                    id="cv"
                                    accept=".pdf"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            // Validar tipo de arquivo
                                            if (file.type !== 'application/pdf') {
                                                form.setError('cv', {
                                                    type: 'manual',
                                                    message: 'Only PDF files are allowed'
                                                });
                                                e.target.value = ''; // Limpar input
                                                return;
                                            }

                                            // Validar tamanho (3MB = 3 * 1024 * 1024 bytes)
                                            const MAX_FILE_SIZE = 3 * 1024 * 1024;
                                            if (file.size > MAX_FILE_SIZE) {
                                                form.setError('cv', {
                                                    type: 'manual',
                                                    message: `File too large. Please reduce the file size to under 3MB. Current size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`
                                                });
                                                e.target.value = ''; // Limpar input
                                                return;
                                            }

                                            // Limpar erro se validação passar
                                            form.clearErrors('cv');
                                            setValue('cv', file);
                                        }
                                    }}
                                />
                                <Upload className="h-8 w-8 text-gold-light" />
                                <p className="text-white">Click to upload or drag and drop</p>
                                <p className="text-xs text-gray-300">PDF only, max 3MB</p>
                                {watch('cv') && (
                                    <p className="text-sm text-gold-light mt-2">✓ File selected: {(watch('cv') as File)?.name}</p>
                                )}
                            </div>
                            {errors.cv && <p className="text-sm text-destructive">{errors.cv.message as string}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="linkedin" className="text-white">LinkedIn Profile URL</Label>
                            <Input id="linkedin" type="url" {...register('linkedin')} className="bg-white text-black" />
                            {errors.linkedin && <p className="text-sm text-destructive">{errors.linkedin.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="otherLinks" className="text-white">Other Links</Label>
                            <Input id="otherLinks" type="url" {...register('otherLinks')} className="bg-white text-black" />
                            {errors.otherLinks && <p className="text-sm text-destructive">{errors.otherLinks.message as string}</p>}
                        </div>
                    </motion.div>
                )}

                {step === 6 && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                        <h3 className="text-2xl font-bold mb-4 text-white">Consents</h3>
                        <div className="space-y-4">
                            <div className="flex items-start space-x-2">
                                <Checkbox
                                    id="infoAccurate"
                                    checked={watch('infoAccurate') || false}
                                    onCheckedChange={(checked) => {
                                        const boolValue = checked === true;
                                        setValue('infoAccurate', boolValue, { shouldValidate: false });
                                    }}
                                />
                                <Label htmlFor="infoAccurate" className="font-normal cursor-pointer text-white">I confirm that all the information provided is true and accurate. *</Label>
                            </div>
                            {errors.infoAccurate && triedToSubmit && <p className="text-sm text-destructive">{errors.infoAccurate.message}</p>}

                            <div className="flex items-start space-x-2">
                                <Checkbox
                                    id="marketingConsent"
                                    checked={watch('marketingConsent') || false}
                                    onCheckedChange={(checked) => {
                                        const boolValue = checked === true;
                                        setValue('marketingConsent', boolValue, { shouldValidate: false });
                                    }}
                                />
                                <Label htmlFor="marketingConsent" className="font-normal cursor-pointer text-white">I agree to receive relevant updates and opportunities from MIGMA by email.</Label>
                            </div>
                        </div>
                    </motion.div>
                )}

                <div className="flex justify-between pt-6 border-t mt-8">
                    {step > 1 ? (
                        <Button type="button" variant="outline" onClick={handlePrev}>
                            <ChevronLeft className="w-4 h-4 mr-2" /> Back
                        </Button>
                    ) : (
                        <div />
                    )}

                    {step < totalSteps ? (
                        <Button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleNext(e);
                            }}
                            className="bg-gradient-to-b from-gold-light via-gold-medium to-gold-light text-black font-bold hover:from-gold-medium hover:via-gold-light hover:to-gold-medium transition-all shadow-lg"
                        >
                            Next Step <ChevronRight className="w-4 h-4 ml-2" />
                        </Button>
                    ) : (
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-gradient-to-b from-gold-light via-gold-medium to-gold-light text-black font-bold hover:from-gold-medium hover:via-gold-light hover:to-gold-medium transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Submitting...' : 'Submit Application'} <Check className="w-4 h-4 ml-2" />
                        </Button>
                    )}
                </div>
            </form>
        </div >
    );
};
