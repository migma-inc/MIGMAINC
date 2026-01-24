import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { generateAccessToken } from '@/lib/support';
import { sendContactMessageAccessLink } from '@/lib/emails';

const contactSchema = z.object({
    name: z.string().min(2, "Name is required"),
    email: z.string().email("Invalid email"),
    subject: z.string().min(1, "Subject is required"),
    message: z.string().min(10, "Message must be at least 10 characters"),
});

type ContactFormData = z.infer<typeof contactSchema>;

export const Contact = () => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const form = useForm<ContactFormData>({
        resolver: zodResolver(contactSchema),
        defaultValues: {
            subject: '',
        }
    });

    const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = form;

    const onSubmit = async (data: ContactFormData) => {
        setIsSubmitting(true);
        try {
            // Get user IP and user agent
            const ipAddress = await fetch('https://api.ipify.org?format=json')
                .then(res => res.json())
                .then(data => data.ip)
                .catch(() => null);

            const userAgent = navigator.userAgent;

            // Save message to database
            const { data: insertedData, error: dbError } = await supabase
                .from('contact_messages')
                .insert({
                    name: data.name,
                    email: data.email,
                    subject: data.subject,
                    message: data.message,
                    ip_address: ipAddress,
                    user_agent: userAgent,
                })
                .select()
                .single();

            if (dbError || !insertedData) {
                console.error('Error saving message:', dbError);
                throw new Error('Failed to save message');
            }

            console.log('[CONTACT] Message saved, ID:', insertedData.id);

            // Generate access token for the ticket
            const token = await generateAccessToken(insertedData.id);

            if (!token) {
                console.error('[CONTACT] Failed to generate access token');
                // Continue anyway - message was saved
            }

            // Send email with access link
            if (token) {
                try {
                    const emailSent = await sendContactMessageAccessLink(
                        data.email,
                        data.name,
                        data.subject,
                        token
                    );

                    if (emailSent) {
                        console.log('[CONTACT] Access link email sent successfully');
                    } else {
                        console.warn('[CONTACT] Failed to send access link email');
                    }
                } catch (emailErr) {
                    console.error('[CONTACT] Exception sending email:', emailErr);
                    // Don't fail the form submission if email fails
                }
            }

            setSubmitted(true);
            reset();

            setTimeout(() => {
                setSubmitted(false);
            }, 5000);
        } catch (error) {
            console.error('Error submitting contact form:', error);
            alert('There was an error submitting your message. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-black via-[#1a1a1a] to-black font-sans text-foreground">
            <Header />

            {/* Hero Section */}
            <section className="pt-[120px] pb-20 md:pt-24 md:pb-24 overflow-x-clip" style={{ background: "radial-gradient(ellipse 200% 100% at bottom left, #000000, #1a1a1a 100%)" }}>
                <div className="container">
                    <div className="max-w-4xl mx-auto text-center">
                        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter migma-gold-text mb-6">
                            Contact MIGMA
                        </h1>
                        <p className="text-xl md:text-2xl text-gold-light tracking-tight max-w-3xl mx-auto">
                            For support related to a MIGMA payment link, partnership inquiries, or joining our Global Partner ecosystem — reach out below.
                        </p>
                    </div>
                </div>
            </section>

            <section className="py-24">
                <div className="container">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                        {/* Contact Information */}
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="space-y-8"
                        >
                            <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border-gold-medium/30">
                                <CardContent className="p-8">
                                    <h2 className="text-2xl font-bold migma-gold-text mb-6">Get in Touch</h2>
                                    <div className="space-y-6 text-gray-300">
                                        <div>
                                            <h3 className="text-gold-light font-semibold mb-2">Support (Clients who used a MIGMA link)</h3>
                                            <p>If you made a payment through MIGMA and need help locating your receipt or next steps, contact us and include your email and payment reference.</p>
                                        </div>
                                        <div>
                                            <h3 className="text-gold-light font-semibold mb-2">Partnership (Companies / Agencies)</h3>
                                            <p>For businesses interested in working with MIGMA services, integrations, or operational support.</p>
                                        </div>
                                        <div>
                                            <h3 className="text-gold-light font-semibold mb-2">Global Partner Applications</h3>
                                            <p>For candidates applying to work with MIGMA as independent contractors.</p>
                                        </div>
                                        <div className="pt-4 border-t border-gold-medium/30">
                                            <h3 className="text-gold-light font-semibold mb-2">Email</h3>
                                            <a href="mailto:adm@migma.com" className="text-gold-medium hover:text-gold-light underline">
                                                adm@migma.com
                                            </a>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>

                        {/* Contact Form */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                        >
                            <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border-gold-medium/30">
                                <CardContent className="p-8">
                                    <h2 className="text-2xl font-bold migma-gold-text mb-6">Send us a Message</h2>

                                    {submitted && (
                                        <div className="mb-6 p-4 bg-green-900/30 border-2 border-green-500/50 rounded-lg">
                                            <p className="text-green-300">Thank you! Your message has been sent successfully.</p>
                                        </div>
                                    )}

                                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="name" className="text-white">Name *</Label>
                                            <Input
                                                id="name"
                                                {...register('name')}
                                                className="bg-white text-black"
                                            />
                                            {errors.name && (
                                                <p className="text-sm text-destructive">{errors.name.message}</p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="email" className="text-white">Email *</Label>
                                            <Input
                                                id="email"
                                                type="email"
                                                {...register('email')}
                                                className="bg-white text-black"
                                            />
                                            {errors.email && (
                                                <p className="text-sm text-destructive">{errors.email.message}</p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="subject" className="text-white">Subject *</Label>
                                            <Select
                                                value={watch('subject') || ''}
                                                onValueChange={(val) => setValue('subject', val)}
                                            >
                                                <SelectTrigger className="bg-white text-black">
                                                    <SelectValue placeholder="Select a subject" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Payment Support">Payment Support</SelectItem>
                                                    <SelectItem value="Partnership / Business Inquiry">Partnership / Business Inquiry</SelectItem>
                                                    <SelectItem value="Global Partner Application">Global Partner Application</SelectItem>
                                                    <SelectItem value="Other">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {errors.subject && (
                                                <p className="text-sm text-destructive">{errors.subject.message}</p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="message" className="text-white">Message *</Label>
                                            <Textarea
                                                id="message"
                                                {...register('message')}
                                                className="bg-white text-black min-h-[150px]"
                                                placeholder="Please describe your request and include any relevant details (email used, company name, payment reference, etc.)."
                                            />
                                            {errors.message && (
                                                <p className="text-sm text-destructive">{errors.message.message}</p>
                                            )}
                                        </div>

                                        <Button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="w-full btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isSubmitting ? 'Sending...' : 'Send Message'}
                                        </Button>
                                    </form>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
};
