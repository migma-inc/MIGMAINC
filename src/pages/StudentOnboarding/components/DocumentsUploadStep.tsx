/**
 * Etapa 6 — Upload de documentos.
 * Faz upload para o Storage do Matricula USA e registra em student_documents.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Upload, FileText, CheckCircle, Loader2,
  AlertCircle, ArrowRight,
} from 'lucide-react';
import { useStudentAuth } from '../../../contexts/StudentAuthContext';
import { supabase } from '../../../lib/supabase';
import type { StepProps } from '../types';

const DOCUMENT_TYPES = [
  {
    key: 'passport',
    label: 'Passport',
    description: 'Upload a clear photo or scan of your passport (biographical page).',
    required: true,
  },
  {
    key: 'diploma',
    label: 'High School Diploma',
    description: 'Upload your high school diploma or equivalent certificate.',
    required: true,
  },
  {
    key: 'funds_proof',
    label: 'Proof of Funds',
    description: 'Bank statements showing minimum $22,000 USD (+ $5,000 per dependent).',
    required: true,
  },
];

interface UploadedDoc {
  id: string;
  document_type: string;
  file_path: string;
  original_name: string;
}

export const DocumentsUploadStep: React.FC<StepProps> = ({ onNext }) => {
  const { user, userProfile, updateUserProfile } = useStudentAuth();
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File | null>>({});
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!user?.id) return;
    setIsLocked(userProfile?.documents_uploaded || false);
    fetchUploadedDocs();
  }, [user?.id]);

  const fetchUploadedDocs = async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase
        .from('student_documents')
        .select('id, document_type, file_path, original_name')
        .eq('user_id', user.id);
      setUploadedDocs((data as UploadedDoc[]) || []);
    } catch (err) {
      console.error('[DocumentsUploadStep]', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (docType: string, file: File | null) => {
    setSelectedFiles(prev => ({ ...prev, [docType]: file }));
    setError(null);
  };

  const uploadFile = async (docType: string, file: File): Promise<boolean> => {
    if (!user?.id) return false;
    setUploadingFiles(prev => ({ ...prev, [docType]: true }));

    try {
      const ext = file.name.split('.').pop() || 'pdf';
      const fileName = `${docType}_${Date.now()}.${ext}`;
      const filePath = `${user.id}/${docType}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('student-documents')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('student_documents')
        .upsert({
          user_id: user.id,
          document_type: docType,
          file_path: filePath,
          original_name: file.name,
          source: 'migma',
        }, { onConflict: 'user_id,document_type' });

      if (dbError) throw dbError;

      return true;
    } catch (err: any) {
      console.error(`[DocumentsUploadStep] Erro ao fazer upload de ${docType}:`, err);
      setError(`Failed to upload ${docType}: ${err.message}`);
      return false;
    } finally {
      setUploadingFiles(prev => ({ ...prev, [docType]: false }));
    }
  };

  const handleUploadAll = async () => {
    const filesToUpload = Object.entries(selectedFiles).filter(([_, file]) => file !== null);
    if (filesToUpload.length === 0) {
      setError('Please select files to upload.');
      return;
    }

    setSaving(true);
    setError(null);

    let allSuccess = true;
    for (const [docType, file] of filesToUpload) {
      const success = await uploadFile(docType, file!);
      if (!success) allSuccess = false;
    }

    await fetchUploadedDocs();
    setSaving(false);

    if (!allSuccess) return;

    // Verificar se todos os documentos obrigatórios foram enviados
    const updatedDocs = await supabase
      .from('student_documents')
      .select('document_type')
      .eq('user_id', user!.id);

    const uploadedTypes = (updatedDocs.data || []).map((d: any) => d.document_type);
    const requiredTypes = DOCUMENT_TYPES.filter(d => d.required).map(d => d.key);
    const allUploaded = requiredTypes.every(t => uploadedTypes.includes(t));

    if (allUploaded) {
      await supabase
        .from('user_profiles')
        .update({ documents_uploaded: true })
        .eq('user_id', user!.id);
      await updateUserProfile({ documents_uploaded: true } as any);
      onNext();
    }
  };

  const getDocStatus = (docType: string) => {
    return uploadedDocs.find(d => d.document_type === docType);
  };

  const allRequiredUploaded = DOCUMENT_TYPES.filter(d => d.required).every(d => getDocStatus(d.key));

  return (
    <div className="space-y-8 pb-12 max-w-4xl mx-auto px-4">
      <div className="space-y-1">
        <p className="text-xs font-black uppercase tracking-widest text-gold-medium">Etapa 6</p>
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">Upload Documents</h2>
        <p className="text-sm text-gray-400 font-medium">
          Upload the required documents to proceed with your application.
        </p>
      </div>

      {isLocked && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <p className="text-emerald-400 font-medium text-sm">
            Documents submitted successfully. Our team is reviewing them.
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gold-medium" />
        </div>
      ) : (
        <div className="space-y-4">
          {DOCUMENT_TYPES.map(doc => {
            const uploaded = getDocStatus(doc.key);
            const selectedFile = selectedFiles[doc.key];
            const isUploading = uploadingFiles[doc.key];

            return (
              <div key={doc.key} className={`border-2 rounded-2xl p-5 transition-all ${
                uploaded ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/10 bg-white/5'
              }`}>
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    uploaded ? 'bg-emerald-500/10' : 'bg-white/10'
                  }`}>
                    {uploaded
                      ? <CheckCircle className="w-5 h-5 text-emerald-400" />
                      : <FileText className="w-5 h-5 text-gray-400" />
                    }
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{doc.label}</span>
                      {doc.required && <span className="text-xs text-red-400 font-medium">Required</span>}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{doc.description}</p>

                    {uploaded && (
                      <div className="mt-2 flex items-center gap-1.5 text-sm text-emerald-400 font-medium">
                        <CheckCircle className="w-4 h-4" />
                        {uploaded.original_name}
                      </div>
                    )}

                    {!isLocked && (
                      <div className="mt-3 flex items-center gap-3">
                        <input
                          type="file"
                          ref={el => { fileInputRefs.current[doc.key] = el; }}
                          onChange={e => handleFileSelect(doc.key, e.target.files?.[0] || null)}
                          accept=".pdf,.jpg,.jpeg,.png,.webp"
                          className="hidden"
                        />
                        <button
                          onClick={() => fileInputRefs.current[doc.key]?.click()}
                          disabled={isUploading}
                          className="flex items-center gap-1.5 text-sm border border-white/10 bg-white/5 rounded-lg px-3 py-1.5 hover:border-white/20 transition-colors font-medium text-gray-300"
                        >
                          <Upload className="w-4 h-4" />
                          {uploaded ? 'Replace' : 'Select File'}
                        </button>
                        {selectedFile && (
                          <span className="text-sm text-gray-500 truncate max-w-[200px]">
                            {selectedFile.name}
                          </span>
                        )}
                        {isUploading && (
                          <Loader2 className="w-4 h-4 animate-spin text-gold-medium" />
                        )}
                      </div>
                    )}
                  </div>
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

      {!isLocked && (
        <div className="flex items-center justify-between">
          {allRequiredUploaded && (
            <div className="flex items-center gap-2 text-sm text-emerald-400 font-medium">
              <CheckCircle className="w-4 h-4" />
              All required documents uploaded!
            </div>
          )}
          <button
            onClick={allRequiredUploaded ? onNext : handleUploadAll}
            disabled={saving || (Object.values(selectedFiles).every(f => !f) && !allRequiredUploaded)}
            className="ml-auto flex items-center gap-2 bg-gold-medium hover:bg-gold-dark text-black py-3 px-8 rounded-xl transition-colors font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
              : allRequiredUploaded
              ? <><ArrowRight className="w-4 h-4" /> Continue</>
              : <><Upload className="w-4 h-4" /> Upload Files</>
            }
          </button>
        </div>
      )}

      {isLocked && (
        <button
          onClick={onNext}
          className="flex items-center gap-2 bg-gold-medium hover:bg-gold-dark text-black py-3 px-8 rounded-xl transition-colors font-black uppercase tracking-widest"
        >
          <ArrowRight className="w-4 h-4" /> Continue
        </button>
      )}
    </div>
  );
};
