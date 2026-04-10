import React, { useState, useEffect } from 'react';
import { CheckCircle, Loader2, Plane, ArrowRightLeft, FileSpreadsheet, Flag } from 'lucide-react';
import { useStudentAuth } from '../../../contexts/StudentAuthContext';
import { matriculaSupabase } from '../../../lib/matriculaSupabase';
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
      const { error: profileError } = await matriculaSupabase
        .from('user_profiles')
        .update(updates)
        .eq('id', userProfile.id);

      if (profileError) throw profileError;

      // Atualiza scholarship_applications também
      await matriculaSupabase
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
      <div className="text-center md:text-left space-y-3">
        <h2 className="text-3xl md:text-5xl font-black text-slate-900 uppercase tracking-tighter">
          Process Type
        </h2>
        <p className="text-lg text-slate-600 font-medium">
          Tell us about your current situation so we can guide you correctly.
        </p>
      </div>

      {isLocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800 text-sm font-medium">
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
                  ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-100'
                  : 'border-slate-200 bg-white hover:border-slate-300'
                }
                ${isLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSelected ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {icon}
              </div>
              <div>
                <div className="font-bold text-slate-900">{title}</div>
                <div className="text-sm text-slate-500 mt-1">{description}</div>
              </div>
              {isSelected && (
                <CheckCircle className="absolute top-4 right-4 w-5 h-5 text-blue-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Campo visa_transfer_active para Transfer */}
      {selectedType === 'transfer' && !isLocked && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-3">
          <p className="font-semibold text-slate-800">Is your F-1 visa currently active?</p>
          <div className="flex gap-3">
            {[true, false].map(val => (
              <button
                key={String(val)}
                onClick={() => setVisaTransferActive(val)}
                className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${visaTransferActive === val
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-white border border-slate-200 text-slate-700'
                  }`}
              >
                {val ? 'Yes, active' : 'No, inactive'}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="text-red-500 text-sm font-medium">{error}</p>
      )}

      <button
        onClick={handleContinue}
        disabled={!selectedType || saving || isLocked}
        className="w-full max-w-xs bg-blue-600 text-white py-4 px-8 rounded-xl hover:bg-blue-700 transition-all font-bold uppercase tracking-widest shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Continue'}
      </button>
    </div>
  );
};
