import { supabase } from '@/lib/supabase';

export type StudentDocumentReviewDecision = 'approve' | 'reject';
export type DocumentReviewScope = 'student' | 'global';

export async function reviewStudentDocuments(
  profileId: string,
  decision: StudentDocumentReviewDecision,
  reviewedBy: string,
  rejectionReason?: string,
  documentId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('review-student-documents', {
      body: {
        profile_id: profileId,
        decision,
        reviewed_by: reviewedBy,
        rejection_reason: rejectionReason,
        document_scope: 'student',
        document_id: documentId,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data?.success) {
      return { success: false, error: data?.error || 'Failed to review documents' };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export async function reviewGlobalDocuments(
  profileId: string,
  decision: StudentDocumentReviewDecision,
  reviewedBy: string,
  rejectionReason?: string,
  documentId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('review-student-documents', {
      body: {
        profile_id: profileId,
        decision,
        reviewed_by: reviewedBy,
        rejection_reason: rejectionReason,
        document_scope: 'global',
        document_id: documentId,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data?.success) {
      return { success: false, error: data?.error || 'Failed to review documents' };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
