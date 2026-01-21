import { supabase } from '@/lib/supabase';
import { TERMS_VERSION } from '@/lib/visa-checkout-constants';
import { getClientIP, getUserAgent } from '@/lib/visa-checkout-utils';
import { trackFormStarted } from '@/lib/funnel-tracking';
import type { Step1FormData } from './visa-checkout-validation';

export interface DocumentFiles {
  documentFront: { file: File; url: string } | null;
  documentBack: { file: File; url: string } | null;
  selfie: { file: File; url: string } | null;
}

export interface SaveStep1Result {
  success: boolean;
  clientId?: string;
  serviceRequestId?: string;
  error?: string;
}

export interface SaveStep2Result {
  success: boolean;
  error?: string;
}

export interface SaveStep3Result {
  success: boolean;
  error?: string;
}

/**
 * Salva os dados do Step 1 (Personal Information) no banco de dados
 * @param formData Dados do formulário
 * @param extraUnits Número de unidades extras (dependentes)
 * @param productSlug Slug do produto
 * @param sellerId ID do vendedor (opcional)
 * @param clientId ID do cliente existente (opcional)
 * @param serviceRequestId ID do service request existente (opcional)
 * @param setClientId Função para atualizar o clientId no estado
 * @param setServiceRequestId Função para atualizar o serviceRequestId no estado
 * @param formStartedTracked Flag indicando se o form started já foi rastreado
 * @param setFormStartedTracked Função para atualizar a flag
 * @param DRAFT_STORAGE_KEY Chave do localStorage para salvar draft
 * @returns Resultado da operação
 */
export async function saveStep1Data(
  formData: Step1FormData,
  extraUnits: number,
  productSlug: string,
  sellerId: string,
  clientId?: string,
  serviceRequestId?: string,
  setClientId?: (id: string) => void,
  setServiceRequestId?: (id: string) => void,
  formStartedTracked?: boolean,
  setFormStartedTracked?: (tracked: boolean) => void,
  DRAFT_STORAGE_KEY?: string
): Promise<SaveStep1Result> {
  try {
    // Create or update client
    let clientIdToUse = clientId;
    const clientPayload = {
      full_name: formData.clientName,
      email: formData.clientEmail,
      phone: formData.clientWhatsApp,
      date_of_birth: formData.dateOfBirth || null,
      nationality: formData.clientNationality || null,
      document_type: formData.documentType || null,
      document_number: formData.documentNumber || null,
      address_line: formData.addressLine || null,
      city: formData.city || null,
      state: formData.state || null,
      postal_code: formData.postalCode || null,
      country: formData.clientCountry || null,
      marital_status: formData.maritalStatus || null,
    };

    if (!clientIdToUse) {
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .insert(clientPayload)
        .select()
        .single();

      if (clientError || !clientData) {
        console.error('Error creating client:', clientError);
        return { success: false, error: 'Failed to save client information' };
      }

      clientIdToUse = clientData.id;
      if (setClientId && clientIdToUse) {
        setClientId(clientIdToUse);
      }
    } else {
      // Update existing client
      const { error: updateError } = await supabase
        .from('clients')
        .update({
          ...clientPayload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', clientIdToUse);

      if (updateError) {
        console.error('Error updating client:', updateError);
        return { success: false, error: 'Failed to update client information' };
      }
    }

    // Create or update service request
    let serviceRequestIdToUse = serviceRequestId;
    if (!serviceRequestIdToUse) {
      const { data: serviceRequestData, error: serviceRequestError } = await supabase
        .from('service_requests')
        .insert({
          client_id: clientIdToUse,
          service_id: productSlug,
          dependents_count: extraUnits,
          seller_id: sellerId || null,
          status: productSlug === 'consultation-common' ? 'pending_payment' : 'onboarding',
        })
        .select()
        .single();

      if (serviceRequestError || !serviceRequestData) {
        console.error('Error creating service request:', serviceRequestError);
        return { success: false, error: 'Failed to create service request' };
      }

      serviceRequestIdToUse = serviceRequestData.id;
      if (setServiceRequestId && serviceRequestIdToUse) {
        setServiceRequestId(serviceRequestIdToUse);
      }

      // Save serviceRequestId to localStorage for restoration
      if (DRAFT_STORAGE_KEY) {
        try {
          const draft = localStorage.getItem(DRAFT_STORAGE_KEY);
          if (draft) {
            const parsed = JSON.parse(draft);
            parsed.serviceRequestId = serviceRequestIdToUse;
            parsed.clientId = clientIdToUse;
            localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(parsed));
          }
        } catch (err) {
          console.warn('Failed to save serviceRequestId to draft:', err);
        }
      }
    } else {
      // Update existing service request
      const updatePayload: Record<string, any> = {
        dependents_count: extraUnits,
        updated_at: new Date().toISOString(),
      };

      if (productSlug === 'consultation-common') {
        updatePayload.status = 'pending_payment';
      }

      const { error: updateError } = await supabase
        .from('service_requests')
        .update(updatePayload)
        .eq('id', serviceRequestIdToUse);

      if (updateError) {
        console.error('Error updating service request:', updateError);
        return { success: false, error: 'Failed to update service request' };
      }
    }

    // Track form started
    if (sellerId && productSlug && !formStartedTracked && setFormStartedTracked) {
      await trackFormStarted(sellerId, productSlug);
      setFormStartedTracked(true);
    }

    return {
      success: true,
      clientId: clientIdToUse,
      serviceRequestId: serviceRequestIdToUse,
    };
  } catch (err) {
    console.error('Error saving step 1:', err);
    return { success: false, error: 'Failed to save information. Please try again.' };
  }
}

/**
 * Salva os documentos do Step 2 no banco de dados
 * @param serviceRequestId ID do service request
 * @param documentFiles Arquivos de documentos
 * @param existingContract Dados do contrato existente (opcional)
 * @returns Resultado da operação
 */
export async function saveStep2Data(
  serviceRequestId: string,
  documentFiles: DocumentFiles | null,
  existingContract?: { contract_document_url?: string; contract_selfie_url?: string }
): Promise<SaveStep2Result> {
  if (!documentFiles && !existingContract) {
    return { success: false, error: 'Please upload all required documents (front, back, and selfie)' };
  }

  // If using existing contract, skip document upload
  if (existingContract) {
    // Update service request status
    await supabase
      .from('service_requests')
      .update({ status: 'pending_payment', updated_at: new Date().toISOString() })
      .eq('id', serviceRequestId);

    return { success: true };
  }

  // Ensure all required documents are present
  if (!documentFiles?.documentFront || !documentFiles?.documentBack || !documentFiles?.selfie) {
    return { success: false, error: 'Please upload all required documents (front, back, and selfie)' };
  }

  try {
    const clientIP = await getClientIP();
    const userAgent = getUserAgent();

    // Save document front
    if (documentFiles.documentFront) {
      // Remove previous document_front if exists to avoid duplicates
      await supabase
        .from('identity_files')
        .delete()
        .eq('service_request_id', serviceRequestId)
        .eq('file_type', 'document_front');

      const { error: frontError } = await supabase
        .from('identity_files')
        .insert({
          service_request_id: serviceRequestId,
          file_type: 'document_front',
          file_path: documentFiles.documentFront.url,
          file_name: documentFiles.documentFront.file.name,
          file_size: documentFiles.documentFront.file.size,
          created_ip: clientIP,
          user_agent: userAgent,
        });

      if (frontError) {
        console.error('Error saving document front:', frontError);
        return { success: false, error: 'Failed to save document' };
      }
    }

    // Save document back (required)
    if (!documentFiles.documentBack) {
      return { success: false, error: 'Document back is required' };
    }

    // Remove previous document_back if exists
    await supabase
      .from('identity_files')
      .delete()
      .eq('service_request_id', serviceRequestId)
      .eq('file_type', 'document_back');

    const { error: backError } = await supabase
      .from('identity_files')
      .insert({
        service_request_id: serviceRequestId,
        file_type: 'document_back',
        file_path: documentFiles.documentBack.url,
        file_name: documentFiles.documentBack.file.name,
        file_size: documentFiles.documentBack.file.size,
        created_ip: clientIP,
        user_agent: userAgent,
      });

    if (backError) {
      console.error('Error saving document back:', backError);
      return { success: false, error: 'Failed to save document back' };
    }

    // Save selfie
    if (documentFiles.selfie) {
      // Remove previous selfie_doc if exists
      await supabase
        .from('identity_files')
        .delete()
        .eq('service_request_id', serviceRequestId)
        .eq('file_type', 'selfie_doc');

      const { error: selfieError } = await supabase
        .from('identity_files')
        .insert({
          service_request_id: serviceRequestId,
          file_type: 'selfie_doc',
          file_path: documentFiles.selfie.url,
          file_name: documentFiles.selfie.file.name,
          file_size: documentFiles.selfie.file.size,
          created_ip: clientIP,
          user_agent: userAgent,
        });

      if (selfieError) {
        console.error('Error saving selfie:', selfieError);
        return { success: false, error: 'Failed to save selfie' };
      }
    }

    // Update service request status
    await supabase
      .from('service_requests')
      .update({ status: 'pending_payment', updated_at: new Date().toISOString() })
      .eq('id', serviceRequestId);

    return { success: true };
  } catch (err) {
    console.error('Error saving step 2:', err);
    return { success: false, error: 'Failed to save documents. Please try again.' };
  }
}

/**
 * Salva a aceitação dos termos do Step 3 no banco de dados
 * @param serviceRequestId ID do service request
 * @param termsAccepted Flag indicando se os termos foram aceitos
 * @param dataAuthorization Flag indicando se a autorização de dados foi aceita
 * @param contractTemplateId ID do template de contrato usado (opcional)
 * @returns Resultado da operação
 */
export async function saveStep3Data(
  serviceRequestId: string,
  termsAccepted: boolean,
  dataAuthorization: boolean,
  contractTemplateId?: string | null,
  paymentMethod?: string | null
): Promise<SaveStep3Result> {
  if (!termsAccepted || !dataAuthorization) {
    return { success: false, error: 'Please accept both terms and conditions' };
  }

  try {
    const clientIP = await getClientIP();
    const userAgent = getUserAgent();

    // Update service request with payment method (intention)
    if (paymentMethod) {
      const { error: srError } = await supabase
        .from('service_requests')
        .update({ payment_method: paymentMethod })
        .eq('id', serviceRequestId);

      if (srError) {
        console.warn('Failed to update payment method in service request:', srError);
        // Don't block flow just for this
      }
    }

    const insertData: Record<string, any> = {
      service_request_id: serviceRequestId,
      accepted: true,
      accepted_at: new Date().toISOString(),
      terms_version: TERMS_VERSION,
      accepted_ip: clientIP,
      user_agent: userAgent,
      data_authorization: true,
    };

    // Add contract_template_id if provided
    if (contractTemplateId) {
      insertData.contract_template_id = contractTemplateId;
    }

    const { error: termsError } = await supabase
      .from('terms_acceptance')
      .insert(insertData);

    if (termsError) {
      console.error('Error saving terms acceptance:', termsError);
      return { success: false, error: 'Failed to save terms acceptance' };
    }

    return { success: true };
  } catch (err) {
    console.error('Error saving step 3:', err);
    return { success: false, error: 'Failed to save terms acceptance. Please try again.' };
  }
}

/**
 * Realiza o upload da imagem da assinatura para o Supabase Storage
 * @param signatureImageDataUrl Dados da imagem em base64
 * @returns URL pública da imagem ou null em caso de erro
 */
export async function uploadSignature(signatureImageDataUrl: string): Promise<string | null> {
  if (!signatureImageDataUrl) return null;

  try {
    console.log('[VISA CHECKOUT] Uploading signature image...');

    // Converter base64 para blob
    const base64Data = signatureImageDataUrl.split(',')[1];
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/png' });

    // Criar File a partir do blob
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });

    // Upload para storage (bucket visa-signatures)
    const { error: uploadError } = await supabase.storage
      .from('visa-signatures')
      .upload(fileName, file, {
        contentType: 'image/png',
        upsert: false,
      });

    if (uploadError) {
      console.error('[VISA CHECKOUT] Error uploading signature:', uploadError);
      return null;
    }

    // Obter URL pública
    const { data: { publicUrl } } = supabase.storage
      .from('visa-signatures')
      .getPublicUrl(fileName);

    console.log('[VISA CHECKOUT] Signature uploaded successfully:', publicUrl);
    return publicUrl;
  } catch (err) {
    console.error('[VISA CHECKOUT] Unexpected error uploading signature:', err);
    return null;
  }
}











