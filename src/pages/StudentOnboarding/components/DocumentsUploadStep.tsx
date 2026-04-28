/**
 * Etapa 6 — Upload de documentos.
 * Faz upload para o Storage do Matricula USA e registra em global_document_requests.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Upload, FileText, CheckCircle, Loader2,
  AlertCircle, ArrowRight,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStudentAuth } from '../../../contexts/StudentAuthContext';
import { supabase } from '../../../lib/supabase';
import type { StepProps } from '../types';

const DOCUMENT_TYPES = [
  {
    key: 'current_i20',
    labelKey: 'student_onboarding.documents.i20_label',
    descKey: 'student_onboarding.documents.i20_desc',
    required: true,
  },
  {
    key: 'i94',
    labelKey: 'student_onboarding.documents.i94_label',
    descKey: 'student_onboarding.documents.i94_desc',
    required: true,
  },
  {
    key: 'f1_visa',
    labelKey: 'student_onboarding.documents.visa_label',
    descKey: 'student_onboarding.documents.visa_desc',
    required: true,
  },
  {
    key: 'history_diploma',
    labelKey: 'student_onboarding.documents.diploma_label',
    descKey: 'student_onboarding.documents.diploma_desc',
    required: true,
  },
  {
    key: 'bank_statement',
    labelKey: 'student_onboarding.documents.funds_label',
    descKey: 'student_onboarding.documents.funds_desc',
    required: true,
  },
  {
    key: 'address_us',
    labelKey: 'student_onboarding.documents.address_us_label',
    descKey: 'student_onboarding.documents.address_us_desc',
    required: true,
  },
  {
    key: 'address_br',
    labelKey: 'student_onboarding.documents.address_br_label',
    descKey: 'student_onboarding.documents.address_br_desc',
    required: true,
  },
  {
    key: 'certidoes',
    labelKey: 'student_onboarding.documents.family_label',
    descKey: 'student_onboarding.documents.family_desc',
    required: false,
  },
];

interface UploadedDoc {
  id: string;
  document_type: string;
  submitted_url: string | null;
  status: string | null;
  requested_at?: string | null;
  submitted_at?: string | null;
}

interface PassportDoc {
  id: string;
  type: string;
  file_url: string | null;
  original_filename: string | null;
  status: string | null;
  uploaded_at?: string | null;
}

export const DocumentsUploadStep: React.FC<StepProps> = ({ onNext }) => {
  const { t } = useTranslation();
  const { user, userProfile, updateUserProfile } = useStudentAuth();
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File | null>>({});
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [passportDoc, setPassportDoc] = useState<PassportDoc | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!user?.id || !userProfile?.id) return;
    setIsLocked(userProfile?.documents_uploaded || false);
    fetchUploadedDocs();
  }, [user?.id, userProfile?.id]);

  const fetchUploadedDocs = async () => {
    if (!user?.id || !userProfile?.id) {
      setLoading(false);
      return;
    }
    try {
      const [globalDocsRes, passportRes] = await Promise.all([
        supabase
          .from('global_document_requests')
          .select('id, document_type, submitted_url, status, requested_at, submitted_at')
          .eq('profile_id', userProfile.id)
          .order('requested_at', { ascending: false }),
        supabase
          .from('student_documents')
          .select('id, type, file_url, original_filename, status, uploaded_at')
          .eq('user_id', user.id)
          .eq('type', 'passport')
          .maybeSingle(),
      ]);

      setUploadedDocs((globalDocsRes.data as UploadedDoc[]) || []);
      setPassportDoc((passportRes.data as PassportDoc) || null);
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
    if (!user?.id || !userProfile?.id) return false;
    setUploadingFiles(prev => ({ ...prev, [docType]: true }));

    try {
      const ext = file.name.split('.').pop() || 'pdf';
      const fileName = `${docType}_${Date.now()}.${ext}`;
      const filePath = `${user.id}/global-documents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('migma-student-documents')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('migma-student-documents')
        .getPublicUrl(filePath);

      const payload = {
        profile_id: userProfile.id,
        service_type: userProfile.service_type ?? userProfile.student_process_type ?? 'unknown',
        document_type: docType,
        submitted_url: publicUrlData.publicUrl,
        status: 'pending',
        requested_at: new Date().toISOString(),
        submitted_at: new Date().toISOString(),
      };

      const { data: existingDoc, error: existingDocError } = await supabase
        .from('global_document_requests')
        .select('id')
        .eq('profile_id', userProfile.id)
        .eq('document_type', docType)
        .maybeSingle();

      if (existingDocError) throw existingDocError;

      const { error: dbError } = existingDoc?.id
        ? await supabase
            .from('global_document_requests')
            .update(payload)
            .eq('id', existingDoc.id)
        : await supabase
            .from('global_document_requests')
            .insert(payload);

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
    if (selectedFiles.passport) {
      const passportSuccess = await uploadPassport(selectedFiles.passport);
      if (!passportSuccess) allSuccess = false;
    }
    for (const [docType, file] of filesToUpload) {
      if (docType === 'passport') continue;
      const success = await uploadFile(docType, file!);
      if (!success) allSuccess = false;
    }

    await fetchUploadedDocs();
    setSaving(false);

    if (!allSuccess) return;

    // Verificar se todos os documentos obrigatórios foram enviados
    const updatedDocs = await supabase
      .from('global_document_requests')
      .select('document_type')
      .eq('profile_id', userProfile!.id);

    const uploadedTypes = (updatedDocs.data || []).map((d: any) => d.document_type);
    const requiredTypes = DOCUMENT_TYPES.filter(d => d.required).map(d => d.key);
    const allUploaded = requiredTypes.every(t => uploadedTypes.includes(t));

    if (allUploaded) {
      const nextProfileUpdate = {
        documents_uploaded: true,
        documents_status: 'under_review',
      };

      await supabase
        .from('user_profiles')
        .update(nextProfileUpdate)
        .eq('user_id', user!.id);
      await updateUserProfile(nextProfileUpdate as any);

      // Fix 1: Admin notification when student uploads all documents
      try {
        await supabase.functions.invoke('migma-notify', {
          body: {
            trigger: 'admin_new_documents',
            data: {
              client_name: userProfile?.full_name ?? userProfile?.email ?? 'Student',
              client_id: userProfile?.id,
            },
          },
        });
      } catch (err) {
        console.warn('[DocumentsUploadStep] Admin notification failed:', err);
      }

      onNext();
    }
  };

  const uploadPassport = async (file: File): Promise<boolean> => {
    if (!user?.id) return false;
    setUploadingFiles(prev => ({ ...prev, passport: true }));

    try {
      const ext = file.name.split('.').pop() || 'pdf';
      const fileName = `passport_${Date.now()}.${ext}`;
      const filePath = `${user.id}/identity/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('migma-student-documents')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('migma-student-documents')
        .getPublicUrl(filePath);

      const payload = {
        user_id: user.id,
        type: 'passport',
        file_url: publicUrlData.publicUrl,
        original_filename: file.name,
        file_size_bytes: file.size,
        status: 'pending',
        source: 'migma',
        uploaded_at: new Date().toISOString(),
      };

      const { data: existingDoc, error: existingDocError } = await supabase
        .from('student_documents')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'passport')
        .maybeSingle();

      if (existingDocError) throw existingDocError;

      const { error: dbError } = existingDoc?.id
        ? await supabase
            .from('student_documents')
            .update(payload)
            .eq('id', existingDoc.id)
        : await supabase
            .from('student_documents')
            .insert(payload);

      if (dbError) throw dbError;

      return true;
    } catch (err: any) {
      console.error('[DocumentsUploadStep] Erro ao fazer upload de passport:', err);
      setError(`Failed to upload passport: ${err.message}`);
      return false;
    } finally {
      setUploadingFiles(prev => ({ ...prev, passport: false }));
    }
  };

  const getDocStatus = (docType: string) => {
    return uploadedDocs.find(d => d.document_type === docType);
  };

  const getPassportStatus = () => passportDoc;

  const allRequiredUploaded = DOCUMENT_TYPES.filter(d => d.required).every(d => getDocStatus(d.key)) && !!getPassportStatus();

  return (
    <div className="space-y-8 pb-12 max-w-4xl mx-auto px-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">{t('student_onboarding.documents.title')}</h2>
        <p className="text-sm text-gray-400 font-medium">
          {t('student_onboarding.documents.subtitle')}
        </p>
      </div>

      {isLocked && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <p className="text-emerald-400 font-medium text-sm">
            {t('student_onboarding.documents.locked_notice')}
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gold-medium" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className={`border-2 rounded-2xl p-5 transition-all ${passportDoc ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/10 bg-white/5'}`}>
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${passportDoc ? 'bg-emerald-500/10' : 'bg-white/10'}`}>
                {passportDoc
                  ? <CheckCircle className="w-5 h-5 text-emerald-400" />
                  : <FileText className="w-5 h-5 text-gray-400" />
                }
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">{t('student_onboarding.documents.passport_label')}</span>
                  <span className="text-xs text-red-400 font-medium">*</span>
                  {passportDoc && (
                    <span className="text-[10px] font-black uppercase border rounded-sm px-2 py-0.5 bg-emerald-500/10 text-emerald-300 border-emerald-500/20">
                      Already sent
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{t('student_onboarding.documents.passport_desc')}</p>

                {passportDoc && (
                  <div className="mt-2 flex items-center gap-1.5 text-sm text-emerald-400 font-medium">
                    <CheckCircle className="w-4 h-4" />
                    {passportDoc.original_filename || 'Passport uploaded'}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="file"
                    ref={el => { fileInputRefs.current.passport = el; }}
                    onChange={e => handleFileSelect('passport', e.target.files?.[0] || null)}
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRefs.current.passport?.click()}
                    disabled={uploadingFiles.passport}
                    className="flex items-center gap-1.5 text-sm border border-white/10 bg-white/5 rounded-lg px-3 py-1.5 hover:border-white/20 transition-colors font-medium text-gray-300"
                  >
                    <Upload className="w-4 h-4" />
                    {passportDoc ? t('student_onboarding.documents.change') : t('student_onboarding.documents.upload')}
                  </button>
                  {selectedFiles.passport && (
                    <span className="text-sm text-gray-500 truncate max-w-[200px]">
                      {selectedFiles.passport.name}
                    </span>
                  )}
                  {uploadingFiles.passport && (
                    <Loader2 className="w-4 h-4 animate-spin text-gold-medium" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {DOCUMENT_TYPES.map(doc => {
            const uploaded = getDocStatus(doc.key);
            const selectedFile = selectedFiles[doc.key];
            const isUploading = uploadingFiles[doc.key];
            const isFunds = doc.key === 'bank_statement';

            return (
              <React.Fragment key={doc.key}>
                {isFunds && (
                  <div className="bg-gold-medium/5 border border-gold-medium/20 rounded-2xl p-6 mb-2">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-gold-medium/10 flex items-center justify-center flex-shrink-0">
                        <AlertCircle className="w-5 h-5 text-gold-medium" />
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-gold-medium font-bold uppercase tracking-wider text-sm">Atenção ao Bank Statement</h4>
                        <p className="text-sm text-gray-400 leading-relaxed">
                          O Bank Statement <strong>NÃO</strong> é o valor que você vai gastar. É apenas uma comprovação para a imigração de que você tem capacidade financeira. Pode ser: conta corrente, poupança, investimentos, conta de familiar ou patrocinador, ou combinação de contas.
                        </p>
                        <p className="text-sm text-gray-500 italic">
                          Não tem o valor disponível agora? Entre em contato com nossa equipe — temos soluções.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className={`border-2 rounded-2xl p-5 transition-all ${
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
                        <span className="font-bold text-white">{t(doc.labelKey)}</span>
                        {doc.required && <span className="text-xs text-red-400 font-medium">*</span>}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{t(doc.descKey)}</p>

                      {uploaded && (
                        <div className="mt-2 flex items-center gap-1.5 text-sm text-emerald-400 font-medium">
                          <CheckCircle className="w-4 h-4" />
                          {uploaded.submitted_url?.split('/').pop() ?? 'Uploaded'}
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
                            {uploaded ? t('student_onboarding.documents.change') : t('student_onboarding.documents.upload')}
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
              </React.Fragment>
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
              ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('student_onboarding.documents.uploading')}</>
              : allRequiredUploaded
              ? <><ArrowRight className="w-4 h-4" /> {t('student_onboarding.selection_fee.continue')}</>
              : <><Upload className="w-4 h-4" /> {t('student_onboarding.documents.submit')}</>
            }
          </button>
        </div>
      )}

      {isLocked && (
        <button
          onClick={onNext}
          className="flex items-center gap-2 bg-gold-medium hover:bg-gold-dark text-black py-3 px-8 rounded-xl transition-colors font-black uppercase tracking-widest"
        >
          <ArrowRight className="w-4 h-4" /> {t('student_onboarding.selection_fee.continue')}
        </button>
      )}
    </div>
  );
};
