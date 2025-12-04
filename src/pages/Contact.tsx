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

const contactSchema = z.object({
    name: z.string().min(2, "Name is required"),
    email: z.string().email("Invalid email"),
    subject: z.string().min(3, "Subject is required"),
    message: z.string().min(10, "Message must be at least 10 characters"),
});

type ContactFormData = z.infer<typeof contactSchema>;

export const Contact = () => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const form = useForm<ContactFormData>({
        resolver: zodResolver(contactSchema),
    });

    const { register, handleSubmit, formState: { errors }, reset } = form;

    const onSubmit = async (data: ContactFormData) => {
        setIsSubmitting(true);
        try {
            // TODO: Implement contact form submission (email or database)
            console.log('Contact form submitted:', data);
            
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            
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
                            Contact Us
                        </h1>
                        <p className="text-xl md:text-2xl text-gold-light tracking-tight max-w-3xl mx-auto">
                            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
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
                                            <h3 className="text-gold-light font-semibold mb-2">Email</h3>
                                            <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
                                        </div>
                                        <div>
                                            <h3 className="text-gold-light font-semibold mb-2">Phone</h3>
                                            <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
                                        </div>
                                        <div>
                                            <h3 className="text-gold-light font-semibold mb-2">Address</h3>
                                            <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
                                        </div>
                                        <div>
                                            <h3 className="text-gold-light font-semibold mb-2">Business Hours</h3>
                                            <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
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
                                            <Input 
                                                id="subject" 
                                                {...register('subject')} 
                                                className="bg-white text-black" 
                                            />
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

