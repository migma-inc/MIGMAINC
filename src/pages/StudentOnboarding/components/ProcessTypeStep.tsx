import React, { useState, useEffect } from 'react';
import { CheckCircle, Loader2, Plane, ArrowRightLeft, FileSpreadsheet, Flag } from 'lucide-react';
import { useStudentAuth } from '../../../contexts/StudentAuthContext';
import { supabase } from '../../../lib/supabase';
import type { StepProps, ProcessType } from '../types';

const PROCESS_TYPES: { type: ProcessType; icon: React.ReactNode; title: string; description: string }[] = [
  {
    type: 'initial',
    icon: <Plane className="w-6 h-6" />,
    title: 'Initial',
    description: 'Entering the USA for the first time on a student visa',
  },
  {
    type: 'transfer',
    icon: <ArrowRightLeft className="w-6 h-6" />,
    title: 'Transfer',
    description: 'Already in the USA and transferring from another institution',
  },
  {
    type: 'change_of_status',
    icon: <FileSpreadsheet className="w-6 h-6" />,
    title: 'Change of Status (COS)',
    description: 'Changing visa status while inside the USA',
  },
  {
    type: 'resident',
    icon: <Flag className="w-6 h-6" />,
    title: 'Resident',
    description: 'Permanent resident or US citizen',
  },
];

export const ProcessTypeStep: React.FC<StepProps> = ({ onNext }) => {
  const { userProfile, updateUserProfile } = useStudentAuth();
  const [selectedType, setSelectedType] = useState<ProcessType | null>(null);
  const [visaTransferActive, setVisaTransferActive] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    if (!userProfile) return;
    const saved = userProfile.student_process_type as ProcessType | null;
    if (saved && ['initial', 'transfer', 'change_of_status', 'resident'].includes(saved)) {
      setSelectedType(saved);
    }
    if (userProfile.visa_transfer_active !== undefined && userProfile.visa_transfer_active !== null) {
      setVisaTransferActive(userProfile.visa_transfer_active);
    }
    setIsLocked(userProfile.documents_uploaded || false);
  }, [userProfile]);

  const handleContinue = async () => {
    if (!selectedType) { setError('Please select your process type to continue.'); return; }
    if (!userProfile?.id) { setError('Authentication error. Please refresh.'); return; }

    setSaving(true);
    setError(null);

    try {
      const updates = {
        student_process_type: selectedType,
        visa_transfer_active: selectedType === 'transfer' ? visaTransferActive : true,
      };

      // Atualiza user_profiles no banco do Matricula USA
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', userProfile.id);

      if (profileError) throw profileError;

      // Atualiza scholarship_applications também
      await supabase
        .from('scholarship_applications')
        .update({ student_process_type: selectedType })
        .eq('student_id', userProfile.id);

      await updateUserProfile(updates as any);
      onNext();
    } catch (err: any) {
      setError(err.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 pb-12 max-w-4xl mx-auto px-4">
      <div className="space-y-1">
        <p className="text-xs font-black uppercase tracking-widest text-gold-medium">Etapa 5</p>
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">Process Type</h2>
        <p className="text-sm text-gray-400 font-medium">
          Tell us about your current situation so we can guide you correctly.
        </p>
      </div>

      {isLocked && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-amber-400 text-sm font-medium">
          Your process type is locked because documents have already been submitted.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PROCESS_TYPES.map(({ type, icon, title, description }) => {
          const isSelected = selectedType === type;
          return (
            <button
              key={type}
              onClick={() => { if (!isLocked) { setSelectedType(type); setError(null); } }}
              className={`
                relative flex flex-col gap-3 p-6 rounded-2xl border-2 text-left transition-all
                ${isSelected
                  ? 'border-gold-medium bg-gold-medium/5'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
                }
                ${isLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSelected ? 'bg-gold-medium text-black' : 'bg-white/10 text-gray-400'}`}>
                {icon}
              </div>
              <div>
                <div className="font-bold text-white">{title}</div>
                <div className="text-sm text-gray-500 mt-1">{description}</div>
              </div>
              {isSelected && (
                <CheckCircle className="absolute top-4 right-4 w-5 h-5 text-gold-medium" />
              )}
            </button>
          );
        })}
      </div>

      {/* Campo visa_transfer_active para Transfer */}
      {selectedType === 'transfer' && !isLocked && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
          <p className="font-semibold text-white">Is your F-1 visa currently active?</p>
          <div className="flex gap-3">
            {[true, false].map(val => (
              <button
                key={String(val)}
                onClick={() => setVisaTransferActive(val)}
                className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${visaTransferActive === val
                    ? 'bg-gold-medium text-black'
                    : 'bg-white/5 border border-white/10 text-gray-400 hover:border-white/20'
                  }`}
              >
                {val ? 'Yes, active' : 'No, inactive'}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">{error}</p>
      )}

      <button
        onClick={handleContinue}
        disabled={!selectedType || saving || isLocked}
        className="flex items-center gap-2 bg-gold-medium hover:bg-gold-dark text-black py-3 px-8 rounded-xl transition-colors font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Continue →'}
      </button>
    </div>
  );
};
