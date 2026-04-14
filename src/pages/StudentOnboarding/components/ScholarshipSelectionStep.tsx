/**
 * Etapa 4 — Escolha de bolsa.
 * Busca bolsas do Supabase do Matricula USA e permite ao aluno selecionar.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Award, Building, DollarSign, Search, GraduationCap, CheckCircle2,
  Loader2, AlertCircle,
} from 'lucide-react';
import { useStudentAuth } from '../../../contexts/StudentAuthContext';
import { supabase } from '../../../lib/supabase';
import { applicationStore } from '../../../stores/applicationStore';
import type { StepProps } from '../types';

interface Scholarship {
  id: string;
  title?: string;
  name?: string;
  level?: string;
  application_fee_amount: number | null;
  annual_value_with_scholarship: number;
  image_url: string | null;
  is_highlighted?: boolean;
  is_active: boolean;
  universities: {
    id: string;
    name: string;
    state?: string;
    city?: string;
    logo_url?: string | null;
  } | null;
}

interface Application {
  id: string;
  scholarship_id: string;
}

export const ScholarshipSelectionStep: React.FC<StepProps> = ({ onNext }) => {
  const { user, userProfile } = useStudentAuth();
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [isReviewing, setIsReviewing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user?.id || !userProfile?.id) return;
    try {
      const [scholarshipsRes, appsRes] = await Promise.all([
        supabase
          .from('scholarships')
          .select(`
            id, title, name, level, application_fee_amount,
            annual_value_with_scholarship, image_url, is_highlighted, is_active,
            universities(id, name, state, city, logo_url)
          `)
          .eq('is_active', true)
          .order('is_highlighted', { ascending: false }),
        supabase
          .from('scholarship_applications')
          .select('id, scholarship_id')
          .eq('student_id', userProfile.id),
      ]);

      setScholarships((scholarshipsRes.data as unknown as Scholarship[]) || []);
      const apps = (appsRes.data as Application[]) || [];
      setApplications(apps);

      if (apps.length > 0) {
        setSelectedIds(new Set(apps.map(a => a.scholarship_id)));
        setIsReviewing(true);
      }
    } catch (err) {
      console.error('[ScholarshipSelectionStep]', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, userProfile?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleScholarship = (id: string) => {
    if (isReviewing) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setError(null);
  };

  const handleConfirm = async () => {
    if (selectedIds.size === 0) { setError('Please select at least one scholarship.'); return; }
    if (!userProfile?.id || !user?.id) { setError('Authentication error. Please refresh.'); return; }

    setSaving(true);
    setError(null);

    try {
      const ids = Array.from(selectedIds);
      const firstId = ids[0];

      // Inserir scholarship_applications para cada bolsa selecionada
      const insertData = ids.map(scholarshipId => ({
        student_id: userProfile.id,
        scholarship_id: scholarshipId,
        status: 'pending',
        source: 'migma',
      }));

      // Usar upsert para evitar duplicatas
      const { error: appError } = await supabase
        .from('scholarship_applications')
        .upsert(insertData, { onConflict: 'student_id,scholarship_id' });

      if (appError) throw appError;

      // Atualizar selected_scholarship_id no perfil
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ selected_scholarship_id: firstId })
        .eq('user_id', user.id);

      if (profileError) throw profileError;

      // Atualizar store local
      applicationStore.clearCart();
      ids.forEach(id => applicationStore.addToCart({ scholarship_id: id }));

      setIsReviewing(true);
      onNext();
    } catch (err: any) {
      setError(err.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = scholarships.filter(s => {
    const name = (s.title || s.name || '').toLowerCase();
    const uni = (s.universities?.name || '').toLowerCase();
    const matchSearch = !searchTerm || name.includes(searchTerm.toLowerCase()) || uni.includes(searchTerm.toLowerCase());
    const matchLevel = selectedLevel === 'all' || s.level === selectedLevel;
    return matchSearch && matchLevel;
  });

  const levels = [...new Set(scholarships.map(s => s.level).filter(Boolean))];

  return (
    <div className="space-y-8 pb-12 max-w-4xl mx-auto px-4">
      <div className="space-y-1">
        <p className="text-xs font-black uppercase tracking-widest text-gold-medium">Etapa 4</p>
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">
          {isReviewing ? 'Your Scholarships' : 'Choose Your Scholarship'}
        </h2>
        <p className="text-sm text-gray-400 font-medium">
          {isReviewing
            ? 'These are the scholarships you have applied for.'
            : 'Select one or more scholarships that match your profile.'}
        </p>
      </div>

      {!isReviewing && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search scholarships or universities..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-[#0d0d0d] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gold-medium/60 transition-colors"
            />
          </div>
          <select
            value={selectedLevel}
            onChange={e => setSelectedLevel(e.target.value)}
            className="px-4 py-2.5 bg-[#0d0d0d] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-gold-medium/60 transition-colors"
          >
            <option value="all">All levels</option>
            {levels.map(l => <option key={l} value={l!}>{l}</option>)}
          </select>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gold-medium" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <GraduationCap className="w-12 h-12 mx-auto mb-3 text-gray-700" />
          <p>No scholarships found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(isReviewing
            ? scholarships.filter(s => applications.some(a => a.scholarship_id === s.id))
            : filtered
          ).map(scholarship => {
            const isSelected = selectedIds.has(scholarship.id);
            const name = scholarship.title || scholarship.name || 'Scholarship';
            const annualValue = scholarship.annual_value_with_scholarship;
            const placementFee = Math.round(annualValue * 0.20);

            return (
              <div
                key={scholarship.id}
                onClick={() => toggleScholarship(scholarship.id)}
                className={`
                  relative border-2 rounded-2xl p-5 transition-all
                  ${isReviewing ? 'cursor-default' : 'cursor-pointer'}
                  ${isSelected
                    ? 'border-gold-medium bg-gold-medium/5'
                    : 'border-white/10 bg-white/5 hover:border-white/20'}
                `}
              >
                {scholarship.is_highlighted && (
                  <div className="absolute top-3 right-3 bg-gold-medium text-black text-xs font-bold px-2 py-0.5 rounded-full">
                    Featured
                  </div>
                )}
                {isSelected && !isReviewing && (
                  <CheckCircle2 className="absolute top-3 right-3 w-5 h-5 text-gold-medium" />
                )}

                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Building className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <div className="font-bold text-white text-sm leading-tight">{name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {scholarship.universities?.name}
                      {scholarship.universities?.state && `, ${scholarship.universities.state}`}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center gap-2 text-gray-400">
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                    <span>Annual Value: <strong className="text-white">${annualValue.toLocaleString()}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <Award className="w-4 h-4 text-gold-medium" />
                    <span>Placement Fee: <strong className="text-white">${placementFee.toLocaleString()}</strong> (20%)</span>
                  </div>
                  {scholarship.level && (
                    <div className="inline-flex">
                      <span className="text-xs bg-white/10 text-gray-400 px-2 py-0.5 rounded-full font-medium capitalize">
                        {scholarship.level}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {!isReviewing && (
        <div className="flex items-center justify-between">
          {selectedIds.size > 0 && (
            <span className="text-sm text-gray-400 font-medium">
              {selectedIds.size} scholarship{selectedIds.size > 1 ? 's' : ''} selected
            </span>
          )}
          <button
            onClick={handleConfirm}
            disabled={selectedIds.size === 0 || saving}
            className="ml-auto flex items-center gap-2 bg-gold-medium hover:bg-gold-dark text-black py-3 px-8 rounded-xl transition-colors font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Confirm Selection'}
          </button>
        </div>
      )}

      {isReviewing && (
        <button
          onClick={onNext}
          className="flex items-center gap-2 bg-gold-medium hover:bg-gold-dark text-black py-3 px-8 rounded-xl transition-colors font-black uppercase tracking-widest"
        >
          Continue →
        </button>
      )}
    </div>
  );
};
