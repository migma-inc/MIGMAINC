/**
 * DadosComplementaresStep — Spec v11, Section 11.4
 * Collected after application fee payment, before form generation.
 * Saves to student_complementary_data table.
 */
import React, { useState, useEffect } from 'react';
import {
  Phone, Home, Calendar, Briefcase, Star,
  Plus, Trash2, Loader2, CheckCircle, ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStudentAuth } from '../../../contexts/StudentAuthContext';
import { supabase } from '../../../lib/supabase';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import type { StepProps } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkEntry {
  company: string;
  period: string;
  role: string;
}

interface FormData {
  // Emergency contact
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
  emergency_contact_address: string;

  // Start preference
  preferred_start_term: string;

  // Sponsor
  has_sponsor: boolean;
  sponsor_name: string;
  sponsor_relationship: string;
  sponsor_phone: string;
  sponsor_address: string;
  sponsor_employer: string;
  sponsor_job_title: string;
  sponsor_years_employed: string;
  sponsor_annual_income: string;
  sponsor_committed_amount_usd: string;

  // Work experience
  work_experience: WorkEntry[];

  // Recommenders
  recommender1_name: string;
  recommender1_role: string;
  recommender1_contact: string;
  recommender2_name: string;
  recommender2_role: string;
  recommender2_contact: string;
}

const EMPTY_WORK: WorkEntry = { company: '', period: '', role: '' };

const START_TERMS = [
  'Spring 2026', 'Summer 2026', 'Fall 2026',
  'Spring 2027', 'Summer 2027', 'Fall 2027',
];

const INITIAL: FormData = {
  emergency_contact_name: '',
  emergency_contact_phone: '',
  emergency_contact_relationship: '',
  emergency_contact_address: '',
  preferred_start_term: '',
  has_sponsor: false,
  sponsor_name: '',
  sponsor_relationship: '',
  sponsor_phone: '',
  sponsor_address: '',
  sponsor_employer: '',
  sponsor_job_title: '',
  sponsor_years_employed: '',
  sponsor_annual_income: '',
  sponsor_committed_amount_usd: '',
  work_experience: [],
  recommender1_name: '',
  recommender1_role: '',
  recommender1_contact: '',
  recommender2_name: '',
  recommender2_role: '',
  recommender2_contact: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SectionTitle: React.FC<{ icon: React.ReactNode; title: string; subtitle?: string }> = ({ icon, title, subtitle }) => (
  <div className="flex items-start gap-3 mb-5">
    <div className="w-9 h-9 rounded-xl bg-gold-medium/10 flex items-center justify-center flex-shrink-0 mt-0.5">
      <span className="text-gold-medium">{icon}</span>
    </div>
    <div>
      <h3 className="text-white font-bold uppercase tracking-wider text-sm">{title}</h3>
      {subtitle && <p className="text-gray-500 text-xs mt-0.5">{subtitle}</p>}
    </div>
  </div>
);

const Field: React.FC<{
  label: string;
  required?: boolean;
  children: React.ReactNode;
}> = ({ label, required, children }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
      {label} {required && <span className="text-red-400">*</span>}
    </label>
    {children}
  </div>
);

const inputCls = "w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 text-sm placeholder-gray-600 focus:outline-none focus:border-gold-medium focus:ring-1 focus:ring-gold-medium/20 transition-all";
const selectTriggerCls = "w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 h-[46px] text-sm placeholder-gray-600 focus:outline-none focus:border-gold-medium focus:ring-1 focus:ring-gold-medium/20 transition-all flex items-center justify-between";

// ─── Main Component ───────────────────────────────────────────────────────────

export const DadosComplementaresStep: React.FC<StepProps> = ({ onNext: _onNext }) => {
  const navigate = useNavigate();
  const { userProfile } = useStudentAuth();
  const [form, setForm] = useState<FormData>(INITIAL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData | string, string>>>({});

  // Load existing data if any
  useEffect(() => {
    if (!userProfile?.id) return;
    (async () => {
      const { data } = await supabase
        .from('student_complementary_data')
        .select('*')
        .eq('profile_id', userProfile.id)
        .maybeSingle();

      if (data) {
        setForm({
          emergency_contact_name: data.emergency_contact_name ?? '',
          emergency_contact_phone: data.emergency_contact_phone ?? '',
          emergency_contact_relationship: data.emergency_contact_relationship ?? '',
          emergency_contact_address: data.emergency_contact_address ?? '',
          preferred_start_term: data.preferred_start_term ?? '',
          has_sponsor: data.has_sponsor ?? false,
          sponsor_name: data.sponsor_name ?? '',
          sponsor_relationship: data.sponsor_relationship ?? '',
          sponsor_phone: data.sponsor_phone ?? '',
          sponsor_address: data.sponsor_address ?? '',
          sponsor_employer: data.sponsor_employer ?? '',
          sponsor_job_title: data.sponsor_job_title ?? '',
          sponsor_years_employed: data.sponsor_years_employed?.toString() ?? '',
          sponsor_annual_income: data.sponsor_annual_income ?? '',
          sponsor_committed_amount_usd: data.sponsor_committed_amount_usd?.toString() ?? '',
          work_experience: (data.work_experience as WorkEntry[]) ?? [],
          recommender1_name: data.recommender1_name ?? '',
          recommender1_role: data.recommender1_role ?? '',
          recommender1_contact: data.recommender1_contact ?? '',
          recommender2_name: data.recommender2_name ?? '',
          recommender2_role: data.recommender2_role ?? '',
          recommender2_contact: data.recommender2_contact ?? '',
        });
      }
      setLoading(false);
    })();
  }, [userProfile?.id]);

  const set = (field: keyof FormData, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const setWork = (idx: number, field: keyof WorkEntry, value: string) => {
    setForm(prev => {
      const updated = [...prev.work_experience];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, work_experience: updated };
    });
  };

  const addWork = () => {
    if (form.work_experience.length >= 3) return;
    setForm(prev => ({ ...prev, work_experience: [...prev.work_experience, { ...EMPTY_WORK }] }));
  };

  const removeWork = (idx: number) => {
    setForm(prev => ({ ...prev, work_experience: prev.work_experience.filter((_, i) => i !== idx) }));
  };

  const validate = (): boolean => {
    const errs: typeof errors = {};
    if (!form.emergency_contact_name.trim()) errs.emergency_contact_name = 'Required';
    if (!form.emergency_contact_phone.trim()) errs.emergency_contact_phone = 'Required';
    if (!form.emergency_contact_relationship.trim()) errs.emergency_contact_relationship = 'Required';
    if (!form.preferred_start_term) errs.preferred_start_term = 'Required';
    if (form.has_sponsor) {
      if (!form.sponsor_name.trim()) errs.sponsor_name = 'Required';
      if (!form.sponsor_relationship.trim()) errs.sponsor_relationship = 'Required';
      if (!form.sponsor_phone.trim()) errs.sponsor_phone = 'Required';
    }
    if (!form.recommender1_name.trim()) errs.recommender1_name = 'Required';
    if (!form.recommender1_role.trim()) errs.recommender1_role = 'Required';
    if (!form.recommender1_contact.trim()) errs.recommender1_contact = 'Required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    if (!userProfile?.id) return;
    setSaving(true);

    try {
      const payload = {
        profile_id: userProfile.id,
        emergency_contact_name: form.emergency_contact_name.trim(),
        emergency_contact_phone: form.emergency_contact_phone.trim(),
        emergency_contact_relationship: form.emergency_contact_relationship.trim(),
        emergency_contact_address: form.emergency_contact_address.trim() || null,
        preferred_start_term: form.preferred_start_term,
        has_sponsor: form.has_sponsor,
        sponsor_name: form.has_sponsor ? form.sponsor_name.trim() || null : null,
        sponsor_relationship: form.has_sponsor ? form.sponsor_relationship.trim() || null : null,
        sponsor_phone: form.has_sponsor ? form.sponsor_phone.trim() || null : null,
        sponsor_address: form.has_sponsor ? form.sponsor_address.trim() || null : null,
        sponsor_employer: form.has_sponsor ? form.sponsor_employer.trim() || null : null,
        sponsor_job_title: form.has_sponsor ? form.sponsor_job_title.trim() || null : null,
        sponsor_years_employed: form.has_sponsor && form.sponsor_years_employed ? parseInt(form.sponsor_years_employed) : null,
        sponsor_annual_income: form.has_sponsor ? form.sponsor_annual_income.trim() || null : null,
        sponsor_committed_amount_usd: form.has_sponsor && form.sponsor_committed_amount_usd ? parseFloat(form.sponsor_committed_amount_usd) : null,
        work_experience: form.work_experience.filter(w => w.company.trim()),
        recommender1_name: form.recommender1_name.trim() || null,
        recommender1_role: form.recommender1_role.trim() || null,
        recommender1_contact: form.recommender1_contact.trim() || null,
        recommender2_name: form.recommender2_name.trim() || null,
        recommender2_role: form.recommender2_role.trim() || null,
        recommender2_contact: form.recommender2_contact.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('student_complementary_data')
        .upsert(payload, { onConflict: 'profile_id' });

      if (error) throw error;
      navigate('/student/dashboard');
    } catch (err: any) {
      console.error('[DadosComplementaresStep] Save error:', err.message);
      setErrors({ emergency_contact_name: `Save failed: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-gold-medium" />
      </div>
    );
  }

  const err = (field: string) => errors[field] ? (
    <p className="text-red-400 text-xs mt-1">{errors[field]}</p>
  ) : null;

  return (
    <div className="space-y-10 pb-16 max-w-3xl mx-auto px-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">Complementary Information</h2>
        <p className="text-sm text-gray-400 mt-1">
          This information is required to complete your university application forms. All fields marked * are mandatory.
        </p>
      </div>

      {/* ── Section A: Emergency Contact ─────────────────────────────────────── */}
      <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6 space-y-5">
        <SectionTitle
          icon={<Phone className="w-4 h-4" />}
          title="Emergency Contact"
          subtitle="Person to contact in case of emergency"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full Name" required>
            <input
              className={inputCls}
              placeholder="e.g. Maria Silva"
              value={form.emergency_contact_name}
              onChange={e => set('emergency_contact_name', e.target.value)}
            />
            {err('emergency_contact_name')}
          </Field>
          <Field label="Phone / WhatsApp" required>
            <input
              className={inputCls}
              placeholder="+1 (555) 000-0000"
              value={form.emergency_contact_phone}
              onChange={e => set('emergency_contact_phone', e.target.value)}
            />
            {err('emergency_contact_phone')}
          </Field>
          <Field label="Relationship" required>
            <input
              className={inputCls}
              placeholder="e.g. Mother, Father, Spouse"
              value={form.emergency_contact_relationship}
              onChange={e => set('emergency_contact_relationship', e.target.value)}
            />
            {err('emergency_contact_relationship')}
          </Field>
          <Field label="Address">
            <input
              className={inputCls}
              placeholder="Street, City, State, ZIP"
              value={form.emergency_contact_address}
              onChange={e => set('emergency_contact_address', e.target.value)}
            />
          </Field>
        </div>
      </div>

      {/* ── Section B: Program Start ─────────────────────────────────────────── */}
      <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6 space-y-5">
        <SectionTitle
          icon={<Calendar className="w-4 h-4" />}
          title="Program Start Preference"
          subtitle="When would you like to start your program?"
        />
        <Field label="Preferred Start Term" required>
          <Select
            value={form.preferred_start_term}
            onValueChange={value => set('preferred_start_term', value)}
          >
            <SelectTrigger className={selectTriggerCls}>
              <SelectValue placeholder="Select a term..." />
            </SelectTrigger>
            <SelectContent className="bg-[#0a0a0a] border border-white/10 text-white rounded-xl overflow-hidden">
              {START_TERMS.map(t => (
                <SelectItem 
                  key={t} 
                  value={t}
                  className="focus:bg-gold-medium/10 focus:text-gold-medium cursor-pointer py-3"
                >
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {err('preferred_start_term')}
        </Field>
      </div>

      {/* ── Section C: Work Experience (optional) ────────────────────────────── */}
      <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6 space-y-5">
        <SectionTitle
          icon={<Briefcase className="w-4 h-4" />}
          title="Professional Experience"
          subtitle="Optional — up to 3 entries. Include churches, businesses, or any relevant experience."
        />

        {form.work_experience.length === 0 && (
          <p className="text-sm text-gray-600 italic">No entries added yet.</p>
        )}

        {form.work_experience.map((entry, idx) => (
          <div key={idx} className="border border-white/8 rounded-xl p-4 space-y-3 relative">
            <button
              onClick={() => removeWork(idx)}
              className="absolute top-3 right-3 text-gray-600 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Entry {idx + 1}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Company / Organization">
                <input
                  className={inputCls}
                  placeholder="Company or Church"
                  value={entry.company}
                  onChange={e => setWork(idx, 'company', e.target.value)}
                />
              </Field>
              <Field label="Period">
                <input
                  className={inputCls}
                  placeholder="2020 – 2023"
                  value={entry.period}
                  onChange={e => setWork(idx, 'period', e.target.value)}
                />
              </Field>
              <Field label="Role / Position">
                <input
                  className={inputCls}
                  placeholder="Manager, Pastor, etc."
                  value={entry.role}
                  onChange={e => setWork(idx, 'role', e.target.value)}
                />
              </Field>
            </div>
          </div>
        ))}

        {form.work_experience.length < 3 && (
          <button
            onClick={addWork}
            className="flex items-center gap-2 text-sm text-gold-medium hover:text-gold-light border border-gold-medium/20 hover:border-gold-medium/40 rounded-xl px-4 py-2.5 transition-all font-semibold"
          >
            <Plus className="w-4 h-4" />
            Add Experience
          </button>
        )}
      </div>

      {/* ── Section D: Financial Sponsor ─────────────────────────────────────── */}
      <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6 space-y-5">
        <SectionTitle
          icon={<Home className="w-4 h-4" />}
          title="Financial Sponsor"
          subtitle="Required by the university for I-20 issuance if you have a sponsor"
        />

        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-300 font-medium">Do you have a financial sponsor?</span>
          <div className="flex gap-3">
            {[true, false].map(v => (
              <button
                key={String(v)}
                onClick={() => set('has_sponsor', v)}
                className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                  form.has_sponsor === v
                    ? 'bg-gold-medium/10 border-gold-medium/40 text-gold-medium'
                    : 'border-white/10 text-gray-500 hover:border-white/20'
                }`}
              >
                {v ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
        </div>

        {form.has_sponsor && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Sponsor Full Name" required>
                <input className={inputCls} placeholder="Full name" value={form.sponsor_name} onChange={e => set('sponsor_name', e.target.value)} />
                {err('sponsor_name')}
              </Field>
              <Field label="Relationship to You" required>
                <input className={inputCls} placeholder="e.g. Father, Company" value={form.sponsor_relationship} onChange={e => set('sponsor_relationship', e.target.value)} />
                {err('sponsor_relationship')}
              </Field>
              <Field label="Phone" required>
                <input className={inputCls} placeholder="+1 (555) 000-0000" value={form.sponsor_phone} onChange={e => set('sponsor_phone', e.target.value)} />
                {err('sponsor_phone')}
              </Field>
              <Field label="Address">
                <input className={inputCls} placeholder="Full address" value={form.sponsor_address} onChange={e => set('sponsor_address', e.target.value)} />
              </Field>
              <Field label="Current Employer">
                <input className={inputCls} placeholder="Company name" value={form.sponsor_employer} onChange={e => set('sponsor_employer', e.target.value)} />
              </Field>
              <Field label="Job Title">
                <input className={inputCls} placeholder="e.g. CEO, Director" value={form.sponsor_job_title} onChange={e => set('sponsor_job_title', e.target.value)} />
              </Field>
              <Field label="Years Employed">
                <input className={inputCls} type="number" min="0" placeholder="e.g. 5" value={form.sponsor_years_employed} onChange={e => set('sponsor_years_employed', e.target.value)} />
              </Field>
              <Field label="Gross Annual Income">
                <input className={inputCls} placeholder="e.g. $80,000" value={form.sponsor_annual_income} onChange={e => set('sponsor_annual_income', e.target.value)} />
              </Field>
              <Field label="Committed Amount / Year (USD)">
                <input className={inputCls} type="number" min="0" step="100" placeholder="e.g. 22000" value={form.sponsor_committed_amount_usd} onChange={e => set('sponsor_committed_amount_usd', e.target.value)} />
              </Field>
            </div>
          </div>
        )}
      </div>

      {/* ── Section E: Recommenders ──────────────────────────────────────────── */}
      <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6 space-y-5">
        <SectionTitle
          icon={<Star className="w-4 h-4" />}
          title="Recommenders"
          subtitle="Choose someone who knows you well — professor, pastor, supervisor, or trusted family member."
        />

        <div className="bg-gold-medium/5 border border-gold-medium/15 rounded-xl p-4 text-sm text-gray-400 leading-relaxed">
          This person may be contacted by the university to confirm the recommendation. Choose someone available who can confirm the information if contacted. The signature can be digital or the full name typed in the designated field.
        </div>

        {/* Recommender 1 */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Recommender 1 <span className="text-red-400">*</span></p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Full Name" required>
              <input className={inputCls} placeholder="Full name" value={form.recommender1_name} onChange={e => set('recommender1_name', e.target.value)} />
              {err('recommender1_name')}
            </Field>
            <Field label="Role / Position" required>
              <input className={inputCls} placeholder="Professor, Pastor, Supervisor..." value={form.recommender1_role} onChange={e => set('recommender1_role', e.target.value)} />
              {err('recommender1_role')}
            </Field>
            <Field label="Phone or Email" required>
              <input className={inputCls} placeholder="Contact info" value={form.recommender1_contact} onChange={e => set('recommender1_contact', e.target.value)} />
              {err('recommender1_contact')}
            </Field>
          </div>
        </div>

        {/* Recommender 2 */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Recommender 2
            <span className="ml-2 text-gold-medium/70 font-normal normal-case">Required for Caroline University</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Full Name">
              <input className={inputCls} placeholder="Full name" value={form.recommender2_name} onChange={e => set('recommender2_name', e.target.value)} />
            </Field>
            <Field label="Role / Position">
              <input className={inputCls} placeholder="Professor, Pastor, Supervisor..." value={form.recommender2_role} onChange={e => set('recommender2_role', e.target.value)} />
            </Field>
            <Field label="Phone or Email">
              <input className={inputCls} placeholder="Contact info" value={form.recommender2_contact} onChange={e => set('recommender2_contact', e.target.value)} />
            </Field>
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex items-center gap-2 bg-gold-medium hover:bg-gold-dark text-black py-3 px-10 rounded-xl transition-colors font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
          ) : (
            <><CheckCircle className="w-4 h-4" /> Save &amp; Continue <ArrowRight className="w-4 h-4" /></>
          )}
        </button>
      </div>
    </div>
  );
};
