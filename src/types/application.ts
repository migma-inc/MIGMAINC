/**
 * Application type definitions
 */

export interface Application {
  id: string;
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
  status: 'pending' | 'approved' | 'approved_for_meeting' | 'approved_for_contract' | 'rejected';
  meeting_date?: string | null;
  meeting_time?: string | null;
  meeting_link?: string | null;
  meeting_scheduled_at?: string | null;
  meeting_scheduled_by?: string | null;
  created_at: string;
  updated_at: string;
}

