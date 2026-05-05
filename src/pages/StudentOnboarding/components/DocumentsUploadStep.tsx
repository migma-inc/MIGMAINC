/**
 * Etapa 6 — Upload de documentos.
 * Faz upload para o Storage do Matricula USA e registra em global_document_requests.
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Upload, FileText, CheckCircle, Loader2,
  AlertCircle, ArrowRight, X, Languages, ExternalLink,
} from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import { useStudentAuth } from '../../../contexts/StudentAuthContext';
import { supabase } from '../../../lib/supabase';
import type { StepProps } from '../types';

const MAX_DOCUMENT_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const ACCEPTED_DOCUMENT_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp']);
const FILE_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp';

type ProcessCategory = 'transfer' | 'cos' | 'other';

interface DocumentType {
  key: string;
  labelKey: string;
  descKey: string;
  required: boolean;
}

const DOCUMENT_TYPES: DocumentType[] = [
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
    key: 'i797a',
    labelKey: 'student_onboarding.documents.i797a_label',
    descKey: 'student_onboarding.documents.i797a_desc',
    required: false,
  },
  {
    key: 'certidoes',
    labelKey: 'student_onboarding.documents.family_label',
    descKey: 'student_onboarding.documents.family_desc',
    required: false,
  },
];

const normalizeProcessCategory = (raw?: string | null): ProcessCategory => {
  const value = (raw || '').toLowerCase();
  if (value.includes('transfer')) return 'transfer';
  if (value.includes('cos') || value.includes('change')) return 'cos';
  return 'other';
};

const getDocumentTypesForProfile = (profile: any): DocumentType[] => {
  const processCategory = normalizeProcessCategory(profile?.service_type ?? profile?.student_process_type);
  const hasDependents = Number(profile?.num_dependents ?? 0) > 0;

  return DOCUMENT_TYPES
    .filter((doc) => {
      if (doc.key === 'current_i20') return processCategory === 'transfer';
      if (doc.key === 'certidoes') return hasDependents;
      if (doc.key === 'i797a') return processCategory === 'transfer' || processCategory === 'cos';
      return true;
    })
    .map((doc) => {
      if (doc.key === 'current_i20') return { ...doc, required: processCategory === 'transfer' };
      if (doc.key === 'certidoes') return { ...doc, required: hasDependents };
      return doc;
    });
};

interface UploadedDoc {
  id: string;
  document_type: string;
  submitted_url: string | null;
  status: string | null;
  rejection_reason?: string | null;
  requested_at?: string | null;
  submitted_at?: string | null;
}

interface PassportDoc {
  id: string;
  type: string;
  file_url: string | null;
  original_filename: string | null;
  status: string | null;
  rejection_reason?: string | null;
  uploaded_at?: string | null;
}

const isRejectedStatus = (status?: string | null) => status === 'rejected';
const isApprovedStatus = (status?: string | null) => status === 'approved';
const isValidSubmittedStatus = (status?: string | null) => status !== 'rejected';

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
  const documentTypes = useMemo(() => getDocumentTypesForProfile(userProfile), [
    userProfile?.service_type,
    userProfile?.student_process_type,
    userProfile?.num_dependents,
  ]);
  const documentsApproved = userProfile?.documents_status === 'approved';

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
          .select('id, document_type, submitted_url, status, rejection_reason, requested_at, submitted_at')
          .eq('profile_id', userProfile.id)
          .order('requested_at', { ascending: false }),
        supabase
          .from('student_documents')
          .select('id, type, file_url, original_filename, status, rejection_reason, uploaded_at')
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

  const validateFile = (file: File): boolean => {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';

    if (!ACCEPTED_DOCUMENT_EXTENSIONS.has(extension)) {
      setError(t('student_onboarding.documents.error_type', 'Only PDF, JPG, PNG or WEBP files are accepted.'));
      return false;
    }

    if (file.size > MAX_DOCUMENT_FILE_SIZE_BYTES) {
      setError(t('student_onboarding.documents.error_size', 'File too large. Maximum 20MB.'));
      return false;
    }

    return true;
  };

  const handleFileSelect = (docType: string, file: File | null): boolean => {
    if (file && !validateFile(file)) {
      setSelectedFiles(prev => ({ ...prev, [docType]: null }));
      return false;
    }

    setSelectedFiles(prev => ({ ...prev, [docType]: file }));
    setError(null);
    return true;
  };

  const uploadFile = async (docType: string, file: File): Promise<boolean> => {
    if (!user?.id || !userProfile?.id) return false;
    if (!validateFile(file)) return false;
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
        rejection_reason: null,
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
      setError(t('student_onboarding.documents.error_upload_doc', {
        docType,
        message: err.message,
        defaultValue: 'Failed to upload {{docType}}: {{message}}',
      }));
      return false;
    } finally {
      setUploadingFiles(prev => ({ ...prev, [docType]: false }));
    }
  };

  const submitDocumentsForReview = async () => {
    if (!user?.id || !userProfile?.id) return;

    setSaving(true);
    setError(null);

    try {
      const nextProfileUpdate = {
        documents_uploaded: true,
        documents_status: 'under_review',
      };

      const { error: profileError } = await supabase
        .from('user_profiles')
        .update(nextProfileUpdate)
        .eq('user_id', user.id);

      if (profileError) throw profileError;

      await updateUserProfile(nextProfileUpdate as any);
      setIsLocked(true);
      setSelectedFiles({});

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
    } catch (err: any) {
      console.error('[DocumentsUploadStep] Erro ao finalizar documentos:', err);
      setError(t('student_onboarding.documents.error_upload', 'Upload error. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const handleUploadAll = async () => {
    const filesToUpload = Object.entries(selectedFiles).filter(([_, file]) => file !== null);
    if (filesToUpload.length === 0) {
      setError(t('student_onboarding.documents.error_select_files', 'Please select files to upload.'));
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

    const [updatedDocs, updatedPassport] = await Promise.all([
      supabase
        .from('global_document_requests')
        .select('document_type, status')
        .eq('profile_id', userProfile!.id),
      supabase
        .from('student_documents')
        .select('id, status')
        .eq('user_id', user!.id)
        .eq('type', 'passport')
        .maybeSingle(),
    ]);

    const validUploadedTypes = (updatedDocs.data || [])
      .filter((d: any) => isValidSubmittedStatus(d.status))
      .map((d: any) => d.document_type);
    const requiredTypes = documentTypes.filter(d => d.required).map(d => d.key);
    const allUploaded = requiredTypes.every(t => validUploadedTypes.includes(t))
      && !!updatedPassport.data?.id
      && isValidSubmittedStatus(updatedPassport.data?.status);

    if (allUploaded) {
      await submitDocumentsForReview();
    }
  };

  const uploadPassport = async (file: File): Promise<boolean> => {
    if (!user?.id) return false;
    if (!validateFile(file)) return false;
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
        rejection_reason: null,
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
      setError(t('student_onboarding.documents.error_upload_doc', {
        docType: t('student_onboarding.documents.passport_label', 'Passport'),
        message: err.message,
        defaultValue: 'Failed to upload {{docType}}: {{message}}',
      }));
      return false;
    } finally {
      setUploadingFiles(prev => ({ ...prev, passport: false }));
    }
  };

  const getDocStatus = (docType: string) => {
    return uploadedDocs.find(d => d.document_type === docType);
  };

  const getPassportStatus = () => passportDoc;

  const hasRejectedDocuments = uploadedDocs.some(d => isRejectedStatus(d.status)) || isRejectedStatus(passportDoc?.status);
  const canSubmitSelectedFiles = !isLocked || hasRejectedDocuments;
  const allRequiredUploaded = documentTypes.filter(d => d.required).every(d => {
    const uploaded = getDocStatus(d.key);
    return !!uploaded && isValidSubmittedStatus(uploaded.status);
  }) && !!getPassportStatus() && isValidSubmittedStatus(getPassportStatus()?.status);
  const passportRejected = isRejectedStatus(passportDoc?.status);
  const passportApproved = isApprovedStatus(passportDoc?.status);
  const passportSubmitted = !!passportDoc && !passportRejected;
  const passportCardClass = passportRejected
    ? 'border-red-500/40 bg-red-500/10 shadow-lg shadow-red-500/10'
    : passportApproved
      ? 'border-emerald-500/30 bg-emerald-500/5 shadow-lg shadow-emerald-500/5'
      : passportSubmitted
        ? 'border-amber-500/35 bg-amber-500/5 shadow-lg shadow-amber-500/5'
        : selectedFiles.passport
          ? 'border-gold-medium/50 bg-gold-medium/10 shadow-xl shadow-gold-medium/10'
          : 'border-white/10 bg-white/5';

  return (
    <div className="space-y-8 pb-12 max-w-4xl mx-auto px-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">{t('student_onboarding.documents.title')}</h2>
        <div className="space-y-4">
          <p className="text-sm text-gray-400 font-medium">
            {t('student_onboarding.documents.subtitle_main', 'Upload the required documents to continue.')}
          </p>
          <p className="text-xs text-gray-500 font-medium">
            {t('student_onboarding.documents.file_requirements', 'Accepted formats: PDF, JPG, PNG or WEBP. Maximum size: 20MB per file.')}
          </p>
          
          <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-gold-medium/10 border border-gold-medium/20 rounded-xl group hover:border-gold-medium/40 transition-all cursor-default">
            <div className="w-8 h-8 rounded-lg bg-gold-medium/10 flex items-center justify-center">
              <Languages className="w-4 h-4 text-gold-medium" />
            </div>
            <p className="text-sm text-[#9a6a16] dark:text-gold-light/90 font-medium">
              {t('student_onboarding.documents.translation_notice_prefix', 'Need certified translation? We recommend')}{' '}
              <a 
                href="https://lushamerica.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="mx-1.5 text-[#7a4f0f] dark:text-gold-medium hover:text-[#5f3d0b] dark:hover:text-gold-light underline decoration-gold-medium/40 hover:decoration-gold-medium transition-all font-bold"
              >
                lushamerica.com
              </a>
              <ExternalLink className="inline-block w-3 h-3 ml-0.5 opacity-60 group-hover:opacity-100 transition-opacity" />
            </p>
          </div>
        </div>
      </div>

      {isLocked && (
        <div className={`border rounded-2xl p-4 flex items-center gap-3 ${
          hasRejectedDocuments
            ? 'bg-red-500/10 border-red-500/25'
            : 'bg-emerald-500/10 border-emerald-500/20'
        }`}>
          {hasRejectedDocuments
            ? <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            : <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          }
          <p className={`font-medium text-sm ${hasRejectedDocuments ? 'text-red-300' : 'text-emerald-400'}`}>
            {hasRejectedDocuments
              ? t('student_onboarding.documents.rejected_notice', 'One or more documents need correction. Upload the rejected files again for review.')
              : t('student_onboarding.documents.locked_notice')
            }
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gold-medium" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Passport Card */}
          <div className={`border-2 rounded-2xl p-5 transition-all duration-300 ${passportCardClass}`}>
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                passportRejected
                  ? 'bg-red-500/10'
                  : passportSubmitted
                  ? 'bg-emerald-500/10' 
                  : selectedFiles.passport
                    ? 'bg-gold-medium/20'
                    : 'bg-white/10'
              }`}>
                {passportRejected
                  ? <AlertCircle className="w-5 h-5 text-red-400" />
                  : passportSubmitted
                    ? <CheckCircle className={`w-5 h-5 ${passportApproved ? 'text-emerald-400' : 'text-amber-400'}`} />
                  : selectedFiles.passport
                    ? <Upload className="w-5 h-5 text-gold-medium animate-bounce" />
                    : <FileText className="w-5 h-5 text-gray-400" />
                }
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">{t('student_onboarding.documents.passport_label')}</span>
                  <span className="text-xs text-red-400 font-medium">*</span>
                  {passportDoc && (
                    <span className={`text-[10px] font-black uppercase border rounded-sm px-2 py-0.5 ${
                      passportRejected
                        ? 'bg-red-500/10 text-red-300 border-red-500/25'
                        : passportApproved
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-300 border-amber-500/25'
                    }`}>
                      {passportRejected
                        ? t('student_onboarding.documents.status_rejected', 'Rejected')
                        : passportApproved
                          ? t('student_onboarding.documents.status_approved', 'Approved')
                          : t('student_onboarding.documents.status_pending', 'Under review')
                      }
                    </span>
                  )}
                  {!passportDoc && selectedFiles.passport && (
                    <span className="text-[10px] font-black uppercase border rounded-sm px-2 py-0.5 bg-gold-medium/20 text-gold-medium border-gold-medium/30 animate-pulse">
                      {t('student_onboarding.documents.ready_to_send', 'Ready to send')}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{t('student_onboarding.documents.passport_desc')}</p>

                {passportDoc && (
                  <div className={`mt-2 flex items-center gap-1.5 text-sm font-medium ${
                    passportRejected ? 'text-red-300' : passportApproved ? 'text-emerald-400' : 'text-amber-300'
                  }`}>
                    {passportRejected
                      ? <AlertCircle className="w-4 h-4" />
                      : <CheckCircle className="w-4 h-4" />
                    }
                    {passportRejected
                      ? t('student_onboarding.documents.file_rejected_label', {
                          label: t('student_onboarding.documents.passport_label'),
                          defaultValue: '{{label}} rejected',
                        })
                      : passportDoc.original_filename || t('student_onboarding.documents.passport_sent', 'Passport uploaded')
                    }
                  </div>
                )}

                {passportRejected && passportDoc.rejection_reason && (
                  <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    <span className="font-bold">{t('student_onboarding.documents.rejection_reason_label', 'Reason')}:</span>{' '}
                    {passportDoc.rejection_reason}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <input
                    type="file"
                    ref={el => { fileInputRefs.current.passport = el; }}
                    onChange={e => {
                      const isValid = handleFileSelect('passport', e.target.files?.[0] || null);
                      if (!isValid) e.currentTarget.value = '';
                    }}
                    accept={FILE_ACCEPT}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRefs.current.passport?.click()}
                    disabled={uploadingFiles.passport}
                    className={`flex items-center gap-1.5 text-sm border rounded-lg px-4 py-2 transition-all font-bold uppercase tracking-wider ${
                      selectedFiles.passport
                        ? 'border-gold-medium/40 bg-gold-medium/10 text-gold-light hover:bg-gold-medium/20'
                        : passportRejected
                          ? 'border-red-500/30 bg-red-500/10 text-red-200 hover:border-red-400/50'
                        : 'border-white/10 bg-white/5 text-gray-300 hover:border-white/20'
                    }`}
                  >
                    <Upload className="w-4 h-4" />
                    {passportRejected
                      ? t('student_onboarding.documents.resubmit', 'Resubmit')
                      : passportDoc || selectedFiles.passport
                        ? t('student_onboarding.documents.change')
                        : t('student_onboarding.documents.upload')
                    }
                  </button>
                  
                  {selectedFiles.passport && (
                    <div className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2 border border-white/5">
                      <span className="text-xs text-gray-400 truncate max-w-[150px] font-medium italic">
                        {selectedFiles.passport.name}
                      </span>
                      <button 
                        onClick={() => handleFileSelect('passport', null)}
                        className="text-gray-400 hover:text-red-400 transition-colors p-1"
                        title={t('student_onboarding.documents.remove_file', 'Remove file')}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  
                  {uploadingFiles.passport && (
                    <Loader2 className="w-4 h-4 animate-spin text-gold-medium" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {documentTypes.map(doc => {
            const uploaded = getDocStatus(doc.key);
            const isRejected = isRejectedStatus(uploaded?.status);
            const isApproved = isApprovedStatus(uploaded?.status);
            const isSubmitted = !!uploaded && !isRejected;
            const isSelected = !!selectedFiles[doc.key] && (!uploaded || isRejected);
            const isUploading = uploadingFiles[doc.key];
            const isFunds = doc.key === 'bank_statement';
            const canEditDocument = !isLocked || isRejected;
            const cardClass = isRejected
              ? 'border-red-500/40 bg-red-500/10 shadow-lg shadow-red-500/10'
              : isApproved
                ? 'border-emerald-500/30 bg-emerald-500/5 shadow-lg shadow-emerald-500/5'
                : isSubmitted
                  ? 'border-amber-500/35 bg-amber-500/5 shadow-lg shadow-amber-500/5'
                  : isSelected
                    ? 'border-gold-medium/50 bg-gold-medium/10 shadow-xl shadow-gold-medium/10'
                    : 'border-white/10 bg-white/5';

            return (
              <div key={doc.key} className="space-y-4">
                {isFunds && (
                  <div className="bg-gold-medium/5 border border-gold-medium/20 rounded-2xl p-6 mb-2">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-gold-medium/10 flex items-center justify-center flex-shrink-0">
                        <AlertCircle className="w-5 h-5 text-gold-medium" />
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-gold-medium font-bold uppercase tracking-wider text-sm">{t('student_onboarding.documents.bank_statement_notice_title', 'Bank Statement Notice')}</h4>
                        <p className="text-sm text-gray-400 leading-relaxed">
                          <Trans
                            i18nKey="student_onboarding.documents.bank_statement_notice_desc"
                            defaults="The Bank Statement is <strong>NOT</strong> the amount you will spend. It is only proof for immigration that you have financial capacity. It can be: checking account, savings, investments, family or sponsor account, or a combination of accounts."
                            components={{ strong: <strong /> }}
                          />
                        </p>
                        <p className="text-sm text-gray-500 italic">
                          {t('student_onboarding.documents.bank_statement_notice_help', 'Do not have the amount available now? Contact our team — we have solutions.')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className={`border-2 rounded-2xl p-5 transition-all duration-300 ${cardClass}`}>
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                      isRejected
                        ? 'bg-red-500/10'
                        : isSubmitted
                        ? 'bg-emerald-500/10' 
                        : isSelected
                          ? 'bg-gold-medium/20'
                          : 'bg-white/10'
                    }`}>
                      {isRejected
                        ? <AlertCircle className="w-5 h-5 text-red-400" />
                        : isSubmitted
                          ? <CheckCircle className={`w-5 h-5 ${isApproved ? 'text-emerald-400' : 'text-amber-400'}`} />
                        : isSelected
                          ? <Upload className="w-5 h-5 text-gold-medium animate-bounce" />
                          : <FileText className="w-5 h-5 text-gray-400" />
                      }
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{t(doc.labelKey)}</span>
                        {doc.required && <span className="text-xs text-red-400 font-medium">*</span>}
                        {uploaded && (
                          <span className={`text-[10px] font-black uppercase border rounded-sm px-2 py-0.5 ${
                            isRejected
                              ? 'bg-red-500/10 text-red-300 border-red-500/25'
                              : isApproved
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-300 border-amber-500/25'
                          }`}>
                            {isRejected
                              ? t('student_onboarding.documents.status_rejected', 'Rejected')
                              : isApproved
                                ? t('student_onboarding.documents.status_approved', 'Approved')
                                : t('student_onboarding.documents.status_pending', 'Under review')
                            }
                          </span>
                        )}
                        {isSelected && (
                          <span className="text-[10px] font-black uppercase border rounded-sm px-2 py-0.5 bg-gold-medium/20 text-gold-medium border-gold-medium/30 animate-pulse">
                            {t('student_onboarding.documents.ready_to_send', 'Ready to send')}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{t(doc.descKey)}</p>

                      {uploaded && (
                        <div className={`mt-2 flex items-center gap-1.5 text-sm font-medium ${
                          isRejected ? 'text-red-300' : isApproved ? 'text-emerald-400' : 'text-amber-300'
                        }`}>
                          {isRejected
                            ? <AlertCircle className="w-4 h-4" />
                            : <CheckCircle className="w-4 h-4" />
                          }
                          {isRejected
                            ? t('student_onboarding.documents.file_rejected_label', {
                                label: t(doc.labelKey),
                                defaultValue: '{{label}} rejected',
                              })
                            : isApproved
                              ? t('student_onboarding.documents.file_approved_label', {
                                  label: t(doc.labelKey),
                                  defaultValue: '{{label}} approved',
                                })
                              : t('student_onboarding.documents.file_pending_label', {
                                  label: t(doc.labelKey),
                                  defaultValue: '{{label}} under review',
                                })
                          }
                        </div>
                      )}

                      {isRejected && uploaded.rejection_reason && (
                        <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                          <span className="font-bold">{t('student_onboarding.documents.rejection_reason_label', 'Reason')}:</span>{' '}
                          {uploaded.rejection_reason}
                        </div>
                      )}

                      {canEditDocument && (
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <input
                            type="file"
                            ref={el => { fileInputRefs.current[doc.key] = el; }}
                            onChange={e => {
                              const isValid = handleFileSelect(doc.key, e.target.files?.[0] || null);
                              if (!isValid) e.currentTarget.value = '';
                            }}
                            accept={FILE_ACCEPT}
                            className="hidden"
                          />
                          <button
                            onClick={() => fileInputRefs.current[doc.key]?.click()}
                            disabled={isUploading}
                            className={`flex items-center gap-1.5 text-sm border rounded-lg px-4 py-2 transition-all font-bold uppercase tracking-wider ${
                              selectedFiles[doc.key]
                                ? 'border-gold-medium/40 bg-gold-medium/10 text-gold-light hover:bg-gold-medium/20'
                                : isRejected
                                  ? 'border-red-500/30 bg-red-500/10 text-red-200 hover:border-red-400/50'
                                : 'border-white/10 bg-white/5 text-gray-300 hover:border-white/20'
                            }`}
                          >
                            <Upload className="w-4 h-4" />
                            {isRejected
                              ? t('student_onboarding.documents.resubmit', 'Resubmit')
                              : uploaded || selectedFiles[doc.key]
                                ? t('student_onboarding.documents.change')
                                : t('student_onboarding.documents.upload')
                            }
                          </button>
                          
                          {selectedFiles[doc.key] && (
                            <div className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2 border border-white/5">
                              <span className="text-xs text-gray-400 truncate max-w-[150px] font-medium italic">
                                {selectedFiles[doc.key]!.name}
                              </span>
                              <button 
                                onClick={() => handleFileSelect(doc.key, null)}
                                className="text-gray-400 hover:text-red-400 transition-colors p-1"
                                title={t('student_onboarding.documents.remove_file', 'Remove file')}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}

                          {isUploading && (
                            <Loader2 className="w-4 h-4 animate-spin text-gold-medium" />
                          )}
                        </div>
                      )}
                    </div>
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

      {canSubmitSelectedFiles && (
        <div className="flex items-center justify-between pt-6 border-t border-white/5">
          {allRequiredUploaded && (
            <div className="flex items-center gap-2 text-sm text-emerald-400 font-bold bg-emerald-500/5 px-4 py-2 rounded-full border border-emerald-500/20">
              <CheckCircle className="w-4 h-4" />
              {t('student_onboarding.documents.all_required_attached', 'All required documents attached!')}
            </div>
          )}
          <button
            onClick={allRequiredUploaded ? submitDocumentsForReview : handleUploadAll}
            disabled={saving || (Object.values(selectedFiles).every(f => !f) && !allRequiredUploaded)}
            className={`ml-auto flex items-center gap-3 py-4 px-10 rounded-2xl transition-all font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed shadow-xl ${
              allRequiredUploaded 
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20' 
                : 'bg-gold-medium hover:bg-gold-dark text-black shadow-gold-medium/20'
            }`}
          >
            {saving
              ? <><Loader2 className="w-5 h-5 animate-spin" /> {t('student_onboarding.documents.uploading')}</>
              : allRequiredUploaded
              ? <><ArrowRight className="w-5 h-5" /> {t('student_onboarding.documents.finish_upload', 'Finish Submission')}</>
              : <><Upload className="w-5 h-5" /> {hasRejectedDocuments ? t('student_onboarding.documents.resubmit_selected', 'Resubmit selected documents') : t('student_onboarding.documents.submit_selected', 'Upload Selected Documents')}</>
            }
          </button>
        </div>
      )}

      {isLocked && documentsApproved && (
        <button
          onClick={onNext}
          className="flex items-center gap-2 bg-gold-medium hover:bg-gold-dark text-black py-3 px-8 rounded-xl transition-colors font-black uppercase tracking-widest"
        >
          <ArrowRight className="w-4 h-4" /> {t('student_onboarding.selection_fee.continue')}
        </button>
      )}

      {isLocked && !documentsApproved && (
        <button
          disabled
          className="flex items-center gap-2 bg-white/10 text-gray-400 py-3 px-8 rounded-xl font-black uppercase tracking-widest cursor-not-allowed"
        >
          <Loader2 className="w-4 h-4 animate-spin" /> {t('student_onboarding.documents.waiting_review', 'Waiting for review')}
        </button>
      )}
    </div>
  );
};
