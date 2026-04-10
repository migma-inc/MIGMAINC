/**
 * Etapa 2 — Verificação de Identidade.
 * O aluno faz upload de uma selfie segurando o documento.
 * Registra em comprehensive_term_acceptance com identity_photo_path.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  Camera, Upload, CheckCircle, AlertCircle, Loader2, Shield, X,
} from 'lucide-react';
import { useStudentAuth } from '../../../contexts/StudentAuthContext';
import { matriculaSupabase } from '../../../lib/matriculaSupabase';
import type { StepProps } from '../types';

export const IdentityVerificationStep: React.FC<StepProps> = ({ onNext }) => {
  const { user } = useStudentAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyVerified, setAlreadyVerified] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    // Verificar se já existe foto no banco
    matriculaSupabase
      .from('comprehensive_term_acceptance')
      .select('identity_photo_path')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.identity_photo_path) setAlreadyVerified(true);
      });
  }, [user?.id]);

  const handleFileSelect = (f: File) => {
    if (!f.type.startsWith('image/')) {
      setError('Please select an image file (JPG, PNG, WEBP).');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum size is 10MB.');
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setError(null);
  };

  const handleSubmit = async () => {
    if (!file || !user?.id) return;
    setUploading(true);
    setError(null);

    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `${user.id}/identity/selfie_${Date.now()}.${ext}`;

      const { error: uploadError } = await matriculaSupabase.storage
        .from('student-documents')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Registrar em comprehensive_term_acceptance
      const { error: dbError } = await matriculaSupabase
        .from('comprehensive_term_acceptance')
        .insert({
          user_id: user.id,
          identity_photo_path: filePath,
          accepted_at: new Date().toISOString(),
        });

      if (dbError) throw dbError;

      // Atualizar flag identity_verified
      await matriculaSupabase
        .from('user_profiles')
        .update({ identity_verified: true })
        .eq('user_id', user.id);

      setAlreadyVerified(true);
      onNext();
    } catch (err: any) {
      setError(err.message || 'Failed to upload. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (alreadyVerified) {
    return (
      <div className="space-y-8 pb-12 max-w-2xl mx-auto px-4">
        <div className="bg-white border border-emerald-500/30 rounded-[2.5rem] p-8 text-center shadow-xl">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">
            Identity Verified!
          </h3>
          <p className="text-slate-500 mb-6">Your identity has been successfully verified.</p>
          <button
            onClick={onNext}
            className="bg-blue-600 text-white py-3 px-8 rounded-xl hover:bg-blue-700 font-bold uppercase tracking-widest shadow-lg transition-all"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 max-w-4xl mx-auto px-4">
      <div className="text-center md:text-left space-y-3">
        <h2 className="text-3xl md:text-5xl font-black text-slate-900 uppercase tracking-tighter">
          Identity Verification
        </h2>
        <p className="text-lg text-slate-600 font-medium">
          Take a selfie holding your ID or passport to verify your identity.
        </p>
      </div>

      {/* Instruções */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2 font-bold text-blue-900">
          <Camera className="w-5 h-5" />
          Photo Requirements
        </div>
        <ul className="space-y-1.5 text-sm text-blue-700">
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
            Hold your ID or passport next to your face
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
            Make sure both your face and document are clearly visible
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
            Good lighting, no blurry photos
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
            Accepted formats: JPG, PNG, WEBP (max 10MB)
          </li>
        </ul>
      </div>

      {/* Upload area */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative cursor-pointer border-2 border-dashed rounded-2xl p-8 text-center transition-all
          ${preview ? 'border-blue-300 bg-blue-50/30' : 'border-slate-300 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/20'}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={e => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0]); }}
          className="hidden"
        />

        {preview ? (
          <div className="relative">
            <img
              src={preview}
              alt="Preview"
              className="max-h-64 mx-auto rounded-xl object-cover shadow-md"
            />
            <button
              onClick={e => { e.stopPropagation(); setFile(null); setPreview(null); }}
              className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="w-16 h-16 bg-slate-200 rounded-2xl flex items-center justify-center mx-auto">
              <Camera className="w-8 h-8 text-slate-400" />
            </div>
            <div>
              <p className="font-semibold text-slate-700">Click to upload your selfie</p>
              <p className="text-sm text-slate-400 mt-1">Or drag and drop</p>
            </div>
          </div>
        )}
      </div>

      {/* Aviso de privacidade */}
      <div className="flex items-start gap-2 text-sm text-slate-500">
        <Shield className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <span>
          Your photo is stored securely and used only for identity verification purposes.
          It will not be shared with third parties.
        </span>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!file || uploading}
        className="flex items-center gap-2 bg-blue-600 text-white py-4 px-8 rounded-xl hover:bg-blue-700 transition-all font-bold uppercase tracking-widest shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
          : <><Upload className="w-4 h-4" /> Submit Photo</>
        }
      </button>
    </div>
  );
};
