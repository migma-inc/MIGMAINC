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
import { matriculaSupabase } from '../../../lib/matriculaSupabase';
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
        matriculaSupabase
          .from('scholarships')
          .select(`
            id, title, name, level, application_fee_amount,
            annual_value_with_scholarship, image_url, is_highlighted, is_active,
            universities(id, name, state, city, logo_url)
          `)
          .eq('is_active', true)
          .order('is_highlighted', { ascending: false }),
        matriculaSupabase
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
      const { error: appError } = await matriculaSupabase
        .from('scholarship_applications')
        .upsert(insertData, { onConflict: 'student_id,scholarship_id' });

      if (appError) throw appError;

      // Atualizar selected_scholarship_id no perfil
      const { error: profileError } = await matriculaSupabase
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
      <div className="text-center md:text-left space-y-3">
        <h2 className="text-3xl md:text-5xl font-black text-slate-900 uppercase tracking-tighter">
          {isReviewing ? 'Your Scholarships' : 'Choose Your Scholarship'}
        </h2>
        <p className="text-lg text-slate-600 font-medium">
          {isReviewing
            ? 'These are the scholarships you have applied for.'
            : 'Select one or more scholarships that match your profile.'}
        </p>
      </div>

      {!isReviewing && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search scholarships or universities..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={selectedLevel}
            onChange={e => setSelectedLevel(e.target.value)}
            className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">All levels</option>
            {levels.map(l => <option key={l} value={l!}>{l}</option>)}
          </select>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <GraduationCap className="w-12 h-12 mx-auto mb-3 text-slate-300" />
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
                  relative bg-white border-2 rounded-2xl p-5 transition-all cursor-pointer
                  ${isSelected ? 'border-blue-500 shadow-lg shadow-blue-100' : 'border-slate-200 hover:border-slate-300'}
                  ${isReviewing ? 'cursor-default' : ''}
                `}
              >
                {scholarship.is_highlighted && (
                  <div className="absolute top-3 right-3 bg-amber-400 text-amber-900 text-xs font-bold px-2 py-0.5 rounded-full">
                    Featured
                  </div>
                )}
                {isSelected && !isReviewing && (
                  <CheckCircle2 className="absolute top-3 right-3 w-5 h-5 text-blue-500" />
                )}

                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Building className="w-5 h-5 text-slate-500" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-sm leading-tight">{name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {scholarship.universities?.name}
                      {scholarship.universities?.state && `, ${scholarship.universities.state}`}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center gap-2 text-slate-600">
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                    <span>Annual Value: <strong className="text-slate-900">${annualValue.toLocaleString()}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Award className="w-4 h-4 text-blue-500" />
                    <span>Placement Fee: <strong className="text-slate-900">${placementFee.toLocaleString()}</strong> (20%)</span>
                  </div>
                  {scholarship.level && (
                    <div className="inline-flex">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium capitalize">
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
        <div className="flex items-center gap-2 text-red-500 text-sm font-medium">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {!isReviewing && (
        <div className="flex items-center justify-between">
          {selectedIds.size > 0 && (
            <span className="text-sm text-slate-600 font-medium">
              {selectedIds.size} scholarship{selectedIds.size > 1 ? 's' : ''} selected
            </span>
          )}
          <button
            onClick={handleConfirm}
            disabled={selectedIds.size === 0 || saving}
            className="ml-auto flex items-center gap-2 bg-blue-600 text-white py-3 px-8 rounded-xl hover:bg-blue-700 transition-all font-bold uppercase tracking-widest shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Confirm Selection'}
          </button>
        </div>
      )}

      {isReviewing && (
        <button
          onClick={onNext}
          className="flex items-center gap-2 bg-blue-600 text-white py-3 px-8 rounded-xl hover:bg-blue-700 transition-all font-bold uppercase tracking-widest shadow-lg"
        >
          Continue
        </button>
      )}
    </div>
  );
};
