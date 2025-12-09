import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';

const STORAGE_KEY = 'migma_book_a_call_form';

const bookACallSchema = z.object({
    companyName: z.string().min(2, "Company name is required"),
    website: z.union([z.string().url("Invalid URL"), z.literal("")]).optional(),
    country: z.string().min(2, "Country is required"),
    contactName: z.string().min(2, "Contact name is required"),
    email: z.string().email("Invalid email"),
    phone: z.string().min(5, "Phone is required"),
    typeOfBusiness: z.string().min(1, "Type of business is required"),
    leadVolume: z.string().min(1, "Lead volume is required"),
    challenges: z.string().optional(),
    confirmation: z.boolean().refine(val => val === true, "You must confirm the information"),
});

type BookACallFormData = z.infer<typeof bookACallSchema>;

const countries = [
    'United States', 'Brazil', 'Portugal', 'Angola', 'Mozambique', 'Cape Verde', 'United Kingdom',
    'Canada', 'Australia', 'Germany', 'France', 'Spain', 'Italy', 'Netherlands', 'Belgium',
    'Switzerland', 'Austria', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Poland', 'Czech Republic',
    'Ireland', 'New Zealand', 'Japan', 'South Korea', 'Singapore', 'Hong Kong', 'Mexico', 'Argentina',
    'Chile', 'Colombia', 'Peru', 'Ecuador', 'Uruguay', 'Paraguay', 'Venezuela', 'Other'
];

const businessTypes = [
    'Visa Agency / Consultancy',
    'Immigration Law Firm',
    'Education / Mentorship Program',
    'Other'
];

const leadVolumes = [
    'Less than 10 leads/month',
    '10-50 leads/month',
    '50-100 leads/month',
    '100-500 leads/month',
    '500+ leads/month'
];

// Load saved form data
const loadSavedFormData = (): Partial<BookACallFormData> => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            return parsed;
        }
    } catch (error) {
        console.warn('Failed to load saved form data:', error);
    }
    return {};
};

export const BookACall = () => {
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<BookACallFormData>({
        resolver: zodResolver(bookACallSchema),
        mode: 'onChange',
        defaultValues: {
            confirmation: false,
            ...loadSavedFormData(),
        }
    });

    const { register, handleSubmit, formState: { errors, isValid, isDirty }, setValue, watch } = form;
    
    // Watch all form values to save to localStorage
    const formValues = watch();
    
    // Save form data to localStorage whenever it changes
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(formValues));
        } catch (error) {
            console.warn('Failed to save form data to localStorage:', error);
        }
    }, [formValues]);

    const getClientIP = async (): Promise<string | null> => {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip || null;
        } catch (error) {
            console.warn('Could not fetch IP address:', error);
            return null;
        }
    };

    const onSubmit = async (data: BookACallFormData) => {
        setIsSubmitting(true);
        try {
            const ipAddress = await getClientIP();

            const submissionData = {
                company_name: data.companyName,
                website: data.website || null,
                country: data.country,
                contact_name: data.contactName,
                email: data.email,
                phone: data.phone,
                type_of_business: data.typeOfBusiness,
                lead_volume: data.leadVolume,
                challenges: data.challenges || null,
                confirmation_accepted: data.confirmation,
                ip_address: ipAddress || null,
            };

            const { error } = await supabase
                .from('book_a_call_submissions')
                .insert([submissionData]);

            if (error) {
                console.error('Error submitting form:', error);
                alert(`Error submitting form: ${error.message}`);
                setIsSubmitting(false);
                return;
            }

            // Send confirmation email
            try {
                const { error: emailError } = await supabase.functions.invoke('send-book-a-call-confirmation-email', {
                    body: {
                        contactName: data.contactName,
                        email: data.email,
                        companyName: data.companyName,
                        country: data.country,
                        phone: data.phone,
                        typeOfBusiness: data.typeOfBusiness,
                        leadVolume: data.leadVolume,
                        website: data.website || null,
                        challenges: data.challenges || null,
                    },
                });

                if (emailError) {
                    console.error('Error sending confirmation email:', emailError);
                    // Don't fail the form submission if email fails
                }
            } catch (emailErr) {
                console.error('Exception sending email:', emailErr);
                // Don't fail the form submission if email fails
            }

            // Clear saved form data after successful submission
            localStorage.removeItem(STORAGE_KEY);
            
            navigate('/book-a-call/thank-you');
        } catch (error) {
            console.error('Error submitting form:', error);
            alert('There was an error submitting your form. Please try again.');
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-black via-[#1a1a1a] to-black font-sans text-foreground">
            <Header />

            <section className="pt-[120px] pb-24">
                <div className="container max-w-3xl">
                    <div className="text-center mb-12">
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tighter migma-gold-text mb-4">
                            Book a call with MIGMA
                        </h1>
                        <p className="text-lg text-gray-300 max-w-2xl mx-auto">
                            Tell us about your company and we'll get in touch to schedule a call. This form is only for companies in the U.S. visa & immigration ecosystem.
                        </p>
                    </div>

                    <Card className="border-gold-medium/30 shadow-2xl bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 backdrop-blur-sm">
                        <CardContent className="p-8 sm:p-12">
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-6"
                                >
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="companyName" className="text-white">Company Name *</Label>
                                            <Input 
                                                id="companyName" 
                                                {...register('companyName')} 
                                                className="bg-white text-black" 
                                            />
                                            {errors.companyName && (
                                                <p className="text-sm text-destructive">{errors.companyName.message}</p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="website" className="text-white">Website</Label>
                                            <Input 
                                                id="website" 
                                                type="url" 
                                                placeholder="https://..."
                                                {...register('website')} 
                                                className="bg-white text-black" 
                                            />
                                            {errors.website && (
                                                <p className="text-sm text-destructive">{errors.website.message}</p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="country" className="text-white">Country *</Label>
                                            <Select 
                                                value={watch('country') || ''} 
                                                onValueChange={(val) => setValue('country', val)}
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
                                            {errors.country && (
                                                <p className="text-sm text-destructive">{errors.country.message}</p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="contactName" className="text-white">Contact Name *</Label>
                                            <Input 
                                                id="contactName" 
                                                {...register('contactName')} 
                                                className="bg-white text-black" 
                                            />
                                            {errors.contactName && (
                                                <p className="text-sm text-destructive">{errors.contactName.message}</p>
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
                                            <Label htmlFor="phone" className="text-white">Phone / WhatsApp *</Label>
                                            <Input 
                                                id="phone" 
                                                type="tel" 
                                                {...register('phone')} 
                                                className="bg-white text-black" 
                                            />
                                            {errors.phone && (
                                                <p className="text-sm text-destructive">{errors.phone.message}</p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="typeOfBusiness" className="text-white">Type of Business *</Label>
                                            <Select 
                                                value={watch('typeOfBusiness') || ''} 
                                                onValueChange={(val) => setValue('typeOfBusiness', val)}
                                            >
                                                <SelectTrigger className="bg-white text-black">
                                                    <SelectValue placeholder="Select type of business" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {businessTypes.map((type) => (
                                                        <SelectItem key={type} value={type}>{type}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {errors.typeOfBusiness && (
                                                <p className="text-sm text-destructive">{errors.typeOfBusiness.message}</p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="leadVolume" className="text-white">Lead Volume *</Label>
                                            <Select 
                                                value={watch('leadVolume') || ''} 
                                                onValueChange={(val) => setValue('leadVolume', val)}
                                            >
                                                <SelectTrigger className="bg-white text-black">
                                                    <SelectValue placeholder="Select lead volume" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {leadVolumes.map((volume) => (
                                                        <SelectItem key={volume} value={volume}>{volume}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {errors.leadVolume && (
                                                <p className="text-sm text-destructive">{errors.leadVolume.message}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="challenges" className="text-white">Challenges (Optional)</Label>
                                        <Textarea 
                                            id="challenges" 
                                            {...register('challenges')} 
                                            className="bg-white text-black min-h-[100px]" 
                                            placeholder="Tell us about your main challenges..."
                                        />
                                        {errors.challenges && (
                                            <p className="text-sm text-destructive">{errors.challenges.message}</p>
                                        )}
                                    </div>

                                    <div className="flex items-start space-x-2 pt-4">
                                        <Checkbox
                                            id="confirmation"
                                            checked={watch('confirmation') || false}
                                            onCheckedChange={(checked) => {
                                                setValue('confirmation', checked === true);
                                            }}
                                        />
                                        <Label htmlFor="confirmation" className="font-normal cursor-pointer text-white text-sm">
                                            I confirm that my company operates in the U.S. visa & immigration ecosystem and that the information provided is accurate. *
                                        </Label>
                                    </div>
                                    {errors.confirmation && (
                                        <p className="text-sm text-destructive">{errors.confirmation.message}</p>
                                    )}

                                    <div className="pt-6">
                                        <Button 
                                            type="submit"
                                            disabled={isSubmitting || !isValid || !watch('confirmation')}
                                            className="w-full btn btn-primary text-lg py-6 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isSubmitting ? 'Submitting...' : 'Submit Request'}
                                        </Button>
                                        {!isValid && isDirty && (
                                            <p className="text-sm text-gold-light mt-2 text-center">
                                                Please fill in all required fields before submitting.
                                            </p>
                                        )}
                                    </div>
                                </motion.div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </section>

            <Footer />
        </div>
    );
};

