import * as z from 'zod';

export const baseFormSchema = z.object({
    fullName: z.string().min(3, 'Full name must be at least 3 characters'),
    email: z.string().email('Invalid email address'),
    phone: z.string().min(5, 'Phone number is required'),
    country: z.string().min(1, 'Country is required'),
    city: z.string().optional(),
    hasBusiness: z.enum(["Yes", "No"]),
    registrationType: z.string().optional(),
    businessName: z.string().optional(),
    businessId: z.string().optional(),
    taxId: z.string().optional(),
    currentOccupation: z.string().optional(),
    areaOfExpertise: z.array(z.string()).min(1, 'Select at least one expertise'),
    otherAreaOfExpertise: z.string().optional(),
    yearsOfExperience: z.string().min(1, 'Please select years of experience'),
    interestedRoles: z.array(z.string()).min(1, 'Select at least one role'),
    visaExperience: z.string().min(1, 'Please select your visa experience'),
    englishLevel: z.string().min(1, 'Please select your English level'),
    clientExperience: z.enum(["Yes", "No"]),
    clientExperienceDescription: z.string().optional(),
    weeklyAvailability: z.string().min(1, 'Please select your availability'),
    whyMigma: z.string().min(10, 'Please tell us why you want to join (min 10 characters)'),
    comfortableModel: z.boolean().refine(val => val === true, {
        message: "You must acknowledge the contractor model"
    }),
    linkedin: z.string().url('Invalid LinkedIn URL').or(z.literal('')).optional(),
    otherLinks: z.string().url('Invalid URL').or(z.literal('')).optional(),
    cv: z.any().refine(val => val instanceof File, {
        message: "CV file is required"
    }),
    infoAccurate: z.boolean().refine(val => val === true, {
        message: "You must confirm the information is accurate"
    }),
    marketingConsent: z.boolean().optional(),
});

export type FormData = z.infer<typeof baseFormSchema>;

export interface ApplicationData {
    full_name: string;
    email: string;
    phone: string;
    country: string;
    city: string | null;
    has_business_registration: string;
    registration_type: string | null;
    business_name: string | null;
    business_id: string | null;
    tax_id: string | null;
    current_occupation: string | null;
    area_of_expertise: string[];
    interested_roles: string[];
    visa_experience: string | null;
    years_of_experience: string;
    english_level: string;
    client_experience: string;
    client_experience_description: string | null;
    weekly_availability: string;
    why_migma: string;
    comfortable_model: boolean;
    linkedin_url: string | null;
    other_links: string | null;
    cv_file_path: string | null;
    cv_file_name: string | null;
    info_accurate: boolean;
    marketing_consent: boolean;
    ip_address: string | null;
}
