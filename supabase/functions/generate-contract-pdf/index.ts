// Supabase Edge Function to generate contract PDF
// Generates a PDF contract including application data, terms, identity photo, and acceptance details

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { jsPDF } from "npm:jspdf@^2.5.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BUCKET_NAME = 'contracts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { application_id, term_acceptance_id } = await req.json();

    if (!application_id || !term_acceptance_id) {
      return new Response(
        JSON.stringify({ success: false, error: "application_id and term_acceptance_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[EDGE FUNCTION] Generating contract PDF:", { application_id, term_acceptance_id });

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fetch application data
    const { data: application, error: appError } = await supabase
      .from('global_partner_applications')
      .select('*')
      .eq('id', application_id)
      .single();

    if (appError || !application) {
      console.error("[EDGE FUNCTION] Error fetching application:", appError);
      return new Response(
        JSON.stringify({ success: false, error: "Application not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch term acceptance data
    // Try multiple times in case the update is still being processed
    let termAcceptance = null;
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts && (!termAcceptance || !termAcceptance.identity_photo_path)) {
      const { data, error: termError } = await supabase
        .from('partner_terms_acceptances')
        .select('*')
        .eq('id', term_acceptance_id)
        .single();

      if (termError || !data) {
        console.error(`[EDGE FUNCTION] Error fetching term acceptance (attempt ${attempts + 1}):`, termError);
        if (attempts === maxAttempts - 1) {
          return new Response(
            JSON.stringify({ success: false, error: "Term acceptance not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        termAcceptance = data;
        console.log(`[EDGE FUNCTION] Fetched term acceptance (attempt ${attempts + 1}):`, {
          id: termAcceptance.id,
          identity_photo_path: termAcceptance.identity_photo_path,
          identity_photo_name: termAcceptance.identity_photo_name,
          accepted_at: termAcceptance.accepted_at
        });

        // If we have the photo path, we're done
        if (termAcceptance.identity_photo_path) {
          break;
        }
      }

      // Wait a bit before retrying
      if (attempts < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      attempts++;
    }

    if (!termAcceptance) {
      return new Response(
        JSON.stringify({ success: false, error: "Term acceptance not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch contract content - check if template is specified, otherwise use default
    let termsContent: string | null = null;
    let termsTitle: string | null = null;

    if (termAcceptance.contract_template_id) {
      // Template obrigatório - não pode fazer fallback
      const { data: templateData, error: templateError } = await supabase
        .from('contract_templates')
        .select('name, content')
        .eq('id', termAcceptance.contract_template_id)
        .single();

      if (templateError || !templateData) {
        // Template não encontrado - ERRO CRÍTICO
        console.error("[EDGE FUNCTION] Contract template not found:", {
          templateId: termAcceptance.contract_template_id,
          error: templateError
        });
        return new Response(
          JSON.stringify({
            error: 'Contract template not found',
            templateId: termAcceptance.contract_template_id,
            message: 'The contract template selected by the administrator could not be found. PDF generation aborted.'
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      // Template encontrado
      termsContent = templateData.content;
      termsTitle = templateData.name;
      console.log("[EDGE FUNCTION] Using contract template:", templateData.name);
    } else {
      // No template ID, fetch from application_terms
      const { data: termsData, error: termsError } = await supabase
        .from('application_terms')
        .select('title, content')
        .eq('term_type', 'partner_contract')
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (termsError) {
        console.error("[EDGE FUNCTION] Error fetching application_terms:", termsError);
        return new Response(
          JSON.stringify({
            error: 'Error loading default contract terms',
            message: 'Default contract terms could not be loaded from the database.'
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      if (!termsData || !termsData.content) {
        console.error("[EDGE FUNCTION] No active contract version found in application_terms");
        return new Response(
          JSON.stringify({
            error: 'Default contract terms not available',
            message: 'No active contract version found in the database.'
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      termsContent = termsData.content;
      termsTitle = termsData.title;
      console.log("[EDGE FUNCTION] Using default application_terms");
    }

    // Validate that we have content before proceeding
    if (!termsContent) {
      console.error("[EDGE FUNCTION] No contract content available after all attempts");
      return new Response(
        JSON.stringify({
          error: 'Contract content unavailable',
          message: 'No contract content could be loaded for PDF generation.'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Create PDF
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    let currentY = margin;

    // Helper function to add wrapped text with automatic page breaks
    const addWrappedText = (
      text: string,
      x: number,
      y: number,
      maxWidth: number,
      fontSize: number = 12
    ): number => {
      pdf.setFontSize(fontSize);
      const lines = pdf.splitTextToSize(text, maxWidth);
      let currentYPos = y;

      for (let i = 0; i < lines.length; i++) {
        // Check if we need a new page
        if (currentYPos > pageHeight - margin - 10) {
          pdf.addPage();
          currentYPos = margin;
        }
        pdf.text(lines[i], x, currentYPos);
        currentYPos += fontSize * 0.6; // Espaçamento entre linhas (60% do tamanho da fonte)
      }

      return currentYPos; // Return final Y position
    };

    // Helper function to add footer to all pages
    const addFooter = () => {
      const totalPages = pdf.getNumberOfPages();
      const footerDate = new Date().toLocaleString('en-US', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'italic');

        // Generation date (10 points from bottom)
        pdf.text(
          `Generated on ${footerDate}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );

        // Legal note (5 points from bottom)
        pdf.text(
          'This document has legal validity and serves as proof of acceptance',
          pageWidth / 2,
          pageHeight - 5,
          { align: 'center' }
        );
      }
    };

    // Helper function to convert HTML to plain text
    const convertHtmlToText = (html: string): string => {
      return html
        // TÍTULOS → Quebras de linha duplas
        .replace(/<h1[^>]*>/g, '\n\n')
        .replace(/<h2[^>]*>/g, '\n\n')
        .replace(/<\/h[12]>/g, '\n')
        // PARÁGRAFOS → Quebras de linha
        .replace(/<p[^>]*>/g, '\n')
        .replace(/<\/p>/g, '\n')
        // NEGRITO → Remove (não precisa no PDF)
        .replace(/<strong[^>]*>/g, '')
        .replace(/<\/strong>/g, '')
        // LISTAS → Bullets
        .replace(/<ul[^>]*>/g, '\n')
        .replace(/<\/ul>/g, '\n')
        .replace(/<li[^>]*>/g, '  • ')
        .replace(/<\/li>/g, '\n')
        // REMOVE TODAS AS TAGS HTML RESTANTES
        .replace(/<[^>]*>/g, '')
        // DECODIFICA ENTIDADES HTML
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        // LIMPA QUEBRAS DE LINHA MÚLTIPLAS
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    };

    // Generic helper to load an image either from a public URL or from storage path
    const loadImage = async (urlOrPath: string | null | undefined): Promise<{ data: Uint8Array; format: string } | null> => {
      if (!urlOrPath) {
        return null;
      }

      try {
        let imageArrayBuffer: ArrayBuffer;
        let mimeType: string;

        // --- DETECÇÃO DE BUCKET E PATH ---
        let bucket = '';
        let path = '';

        // 1. Se for uma URL completa do Supabase Storage
        if (urlOrPath.includes('/storage/v1/object/')) {
          const match = urlOrPath.match(/\/storage\/v1\/object\/(?:public|authenticated|sign)\/([^/]+)\/(.+)$/);
          if (match) {
            bucket = match[1];
            path = decodeURIComponent(match[2]);
          }
        }
        // 2. Se for um path relativo que começa com um bucket conhecido
        else if (!urlOrPath.startsWith('http')) {
          const privateBuckets = ['identity-photos', 'visa-documents', 'partner-signatures', 'contracts', 'visa-signatures'];
          const parts = urlOrPath.split('/');
          if (parts.length > 1 && privateBuckets.includes(parts[0])) {
            bucket = parts[0];
            path = parts.slice(1).join('/');
          } else {
            // Fallback: Assume que sem bucket, o padrão para Global Partner é identity-photos
            bucket = 'identity-photos';
            path = urlOrPath;
          }
        }

        // --- TENTATIVA DE DOWNLOAD DIRETO (PARA BUCKETS PRIVADOS) ---
        if (bucket && path) {
          console.log(`[EDGE FUNCTION] Downloading from storage: ${bucket}/${path}`);
          const { data, error } = await supabase.storage.from(bucket).download(path);

          if (!error && data) {
            imageArrayBuffer = await data.arrayBuffer();
            mimeType = data.type || (path.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
            const bytes = new Uint8Array(imageArrayBuffer);
            const imageFormat = mimeType.includes('png') ? 'PNG' : 'JPEG';
            console.log(`[EDGE FUNCTION] Successfully loaded from storage: ${bucket}/${path}`);
            return { data: bytes, format: imageFormat };
          }
          console.warn(`[EDGE FUNCTION] Storage download failed for ${bucket}/${path}, falling back to fetch...`, error);
        }

        // --- FALLBACK: FETCH TRADICIONAL (PARA ARQUIVOS EXTERNOS OU PÚBLICOS) ---
        const imageUrl = (bucket && path && !urlOrPath.startsWith('http'))
          ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
          : urlOrPath;

        console.log("[EDGE FUNCTION] Loading image via fetch:", imageUrl);
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.status}`);
        }
        const imageBlob = await imageResponse.blob();
        imageArrayBuffer = await imageBlob.arrayBuffer();
        mimeType = imageBlob.type || 'image/jpeg';

        const bytes = new Uint8Array(imageArrayBuffer);
        const imageFormat = mimeType.includes('png') ? 'PNG' : 'JPEG';

        console.log("[EDGE FUNCTION] Image loaded via fetch successfully");
        return { data: bytes, format: imageFormat };

      } catch (imageError) {
        console.error("[EDGE FUNCTION] Could not load image:", imageError);
        return null;
      }
    };

    // Helper functions for specific images
    const loadIdentityPhoto = async () => loadImage(termAcceptance.identity_photo_path);
    const loadDocumentFront = async () => loadImage((termAcceptance as any).document_front_url);
    const loadDocumentBack = async () => loadImage((termAcceptance as any).document_back_url);
    const loadSignatureImage = async () => loadImage((termAcceptance as any).signature_image_url);

    // ============================================
    // 1. Header
    // ============================================
    // MAIN TITLE
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('TERMS ACCEPTANCE DOCUMENT', pageWidth / 2, currentY, { align: 'center' });
    currentY += 15;

    // SUBTITLE
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text('MIGMA INC.', pageWidth / 2, currentY, { align: 'center' });
    currentY += 20;

    // SEPARATOR LINE
    pdf.setLineWidth(0.5);
    pdf.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 10;

    // ============================================
    // 2. Contractor Information
    // ============================================
    // Check if new page is needed
    if (currentY > pageHeight - margin - 50) {
      pdf.addPage();
      currentY = margin;
    }

    // SECTION TITLE
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('CONTRACTOR INFORMATION', margin, currentY);
    currentY += 12;

    // DATA WITH LABEL AND VALUE
    pdf.setFontSize(11);

    // Name
    pdf.setFont('helvetica', 'bold');
    pdf.text('Name:', margin, currentY);
    pdf.setFont('helvetica', 'normal');
    pdf.text(application.full_name, margin + 30, currentY);
    currentY += 8;

    // Email
    pdf.setFont('helvetica', 'bold');
    pdf.text('Email:', margin, currentY);
    pdf.setFont('helvetica', 'normal');
    pdf.text(application.email, margin + 30, currentY);
    currentY += 8;

    // Phone
    pdf.setFont('helvetica', 'bold');
    pdf.text('Phone:', margin, currentY);
    pdf.setFont('helvetica', 'normal');
    pdf.text(application.phone, margin + 30, currentY);
    currentY += 15;

    // ============================================
    // 3. Contract Content
    // ============================================
    if (termsContent) {
      // Check if new page is needed
      if (currentY > pageHeight - margin - 60) {
        pdf.addPage();
        currentY = margin;
      }

      // SECTION TITLE
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('TERMS AND CONDITIONS', margin, currentY);
      currentY += 12;

      // Converter HTML para texto
      const textContent = convertHtmlToText(termsContent || '');

      // TEXTO COM QUEBRA AUTOMÁTICA
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      currentY = addWrappedText(
        textContent,
        margin,
        currentY,
        pageWidth - margin * 2,
        10
      );
      currentY += 20;
    }

    // ============================================
    // 4. Signature Section (with photo)
    // ============================================
    // Check if new page is needed
    if (currentY > pageHeight - margin - 120) {
      pdf.addPage();
      currentY = margin;
    }

    // Formatted date in English
    const acceptanceDate = termAcceptance.accepted_at ? new Date(termAcceptance.accepted_at) : new Date();
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const month = monthNames[acceptanceDate.getMonth()];
    const day = acceptanceDate.getDate();
    const year = acceptanceDate.getFullYear();

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    currentY = addWrappedText(
      `${month} ${day}, ${year}.`,
      margin,
      currentY,
      pageWidth - margin * 2,
      10
    );
    currentY += 10;

    // Signature line (⸻)
    pdf.setFontSize(14);
    pdf.text('⸻', pageWidth / 2, currentY, { align: 'center' });
    currentY += 12;

    // CONTRACTOR title
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('CONTRACTOR', margin, currentY);
    currentY += 10;

    // Signature section
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Signature:', margin, currentY);
    currentY += 8;

    // Try to load and display signature image if available
    const signatureImage = await loadSignatureImage();

    if (signatureImage) {
      try {
        // Check if we need a new page for the signature image
        if (currentY > pageHeight - margin - 30) {
          pdf.addPage();
          currentY = margin;
        }

        // Add signature image (max 45mm width, height proportional)
        const maxWidth = 45;
        const maxHeight = 20; // Height for signature is typically smaller

        pdf.addImage(
          signatureImage.data,
          signatureImage.format,
          margin,
          currentY,
          maxWidth,
          maxHeight
        );
        currentY += maxHeight + 8;
      } catch (imgError) {
        console.error("[EDGE FUNCTION] Error adding signature image to PDF:", imgError);
        // Fall through to show name as fallback
      }
    }

    // Nome removido - não é mais necessário pois já aparece em "Full Name:" abaixo
    // A assinatura desenhada é suficiente

    // Repeated data (consistent alignment)
    pdf.setFont('helvetica', 'bold');
    pdf.text('Full Name:', margin, currentY);
    pdf.setFont('helvetica', 'normal');
    pdf.text(application.full_name, margin + 50, currentY);
    currentY += 10;

    pdf.setFont('helvetica', 'bold');
    pdf.text('Email:', margin, currentY);
    pdf.setFont('helvetica', 'normal');
    pdf.text(application.email, margin + 50, currentY);
    currentY += 10;

    pdf.setFont('helvetica', 'bold');
    pdf.text('Phone:', margin, currentY);
    pdf.setFont('helvetica', 'normal');
    pdf.text(application.phone, margin + 50, currentY);
    currentY += 10;

    // Document images + identity selfie in signature section
    const documentFront = await loadDocumentFront();
    const documentBack = await loadDocumentBack();
    const identityPhoto = await loadIdentityPhoto();

    if (documentFront || documentBack || identityPhoto) {
      const maxWidth = 60;
      const maxHeight = 45;
      const imageSpacing = 10; // Espaçamento entre imagens
      const titleHeight = 8; // Altura do título acima de cada imagem
      const totalImageHeight = maxHeight + titleHeight + imageSpacing; // ~63mm por imagem

      // Calcular quantas imagens serão adicionadas
      let imagesToAdd = 0;
      if (documentFront) imagesToAdd++;
      if (documentBack) imagesToAdd++;
      if (identityPhoto) imagesToAdd++;

      // Calcular espaço total necessário para todas as imagens
      const totalSpaceNeeded = imagesToAdd * totalImageHeight;
      const availableSpace = pageHeight - currentY - margin - 20; // 20mm de margem de segurança

      // Se não há espaço suficiente para todas as imagens, criar nova página
      if (availableSpace < totalSpaceNeeded) {
        console.log("[EDGE FUNCTION] Not enough space for all images, creating new page");
        pdf.addPage();
        currentY = margin;
      }

      if (documentFront) {
        // Verificar se há espaço para esta imagem antes de adicionar
        if (currentY + titleHeight + maxHeight > pageHeight - margin - 20) {
          pdf.addPage();
          currentY = margin;
        }
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text('DOCUMENT FRONT', margin, currentY);
        currentY += titleHeight;
        pdf.addImage(documentFront.data, documentFront.format, margin, currentY, maxWidth, maxHeight);
        currentY += maxHeight + imageSpacing;
      }

      if (documentBack) {
        // Verificar se há espaço para esta imagem antes de adicionar
        if (currentY + titleHeight + maxHeight > pageHeight - margin - 20) {
          pdf.addPage();
          currentY = margin;
        }
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text('DOCUMENT BACK', margin, currentY);
        currentY += titleHeight;
        pdf.addImage(documentBack.data, documentBack.format, margin, currentY, maxWidth, maxHeight);
        currentY += maxHeight + imageSpacing;
      }

      if (identityPhoto) {
        // Verificar se há espaço para esta imagem antes de adicionar (especialmente importante para a última)
        if (currentY + titleHeight + maxHeight > pageHeight - margin - 20) {
          console.log("[EDGE FUNCTION] Not enough space for identity photo, creating new page");
          pdf.addPage();
          currentY = margin;
        }
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text('IDENTITY PHOTO WITH DOCUMENT', margin, currentY);
        currentY += titleHeight;
        pdf.addImage(identityPhoto.data, identityPhoto.format, margin, currentY, maxWidth, maxHeight);
        currentY += maxHeight + imageSpacing;
      }
    }

    // ============================================
    // 5. Acceptance Details
    // ============================================
    // Check if new page is needed
    if (currentY > pageHeight - margin - 60) {
      pdf.addPage();
      currentY = margin;
    }

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('ACCEPTANCE DETAILS', margin, currentY);
    currentY += 10;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');

    // Term title
    if (termsTitle) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Term Title:', margin, currentY);
      pdf.setFont('helvetica', 'normal');
      pdf.text(termsTitle, margin + 55, currentY);
      currentY += 10;
    }

    // Acceptance date/time (US format)
    if (termAcceptance.accepted_at) {
      const acceptedDate = new Date(termAcceptance.accepted_at);
      const dateStr = acceptedDate.toLocaleString('en-US', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      pdf.setFont('helvetica', 'bold');
      pdf.text('Accepted on:', margin, currentY);
      pdf.setFont('helvetica', 'normal');
      pdf.text(dateStr, margin + 55, currentY);
      currentY += 10;
    }

    // IP Address
    if (termAcceptance.ip_address) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('IP Address:', margin, currentY);
      pdf.setFont('helvetica', 'normal');
      pdf.text(termAcceptance.ip_address, margin + 55, currentY);
      currentY += 10;
    }

    // Browser/Device (full User Agent)
    if (termAcceptance.user_agent) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Browser/Device:', margin, currentY);
      pdf.setFont('helvetica', 'normal');
      // Break user agent if too long
      currentY = addWrappedText(
        termAcceptance.user_agent,
        margin + 55,
        currentY,
        pageWidth - margin - 55,
        10
      );
      currentY += 5;
    }

    // ============================================
    // 6. Rodapé (será adicionado em todas as páginas no final)
    // ============================================
    // O rodapé será adicionado pela função addFooter() antes de salvar

    // Add footer to all pages
    addFooter();

    // Generate PDF blob
    const pdfBlob = pdf.output('blob');
    const pdfArrayBuffer = await pdfBlob.arrayBuffer();
    const pdfBuffer = new Uint8Array(pdfArrayBuffer);

    // Generate filename
    const normalizedName = application.full_name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    const timestamp = Date.now();
    const fileName = `contract_${normalizedName}_${dateStr}_${timestamp}.pdf`;
    const filePath = fileName;

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error("[EDGE FUNCTION] Error uploading PDF:", uploadError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to upload PDF" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    // Update term acceptance with PDF info
    const { error: updateError } = await supabase
      .from('partner_terms_acceptances')
      .update({
        contract_pdf_path: filePath,
        contract_pdf_url: publicUrl,
      })
      .eq('id', term_acceptance_id);

    if (updateError) {
      console.warn("[EDGE FUNCTION] Error updating term acceptance with PDF URL:", updateError);
      // Don't fail the request, PDF was generated successfully
    }

    console.log("[EDGE FUNCTION] Contract PDF generated successfully:", { filePath, publicUrl });

    return new Response(
      JSON.stringify({ success: true, pdf_url: publicUrl, file_path: filePath }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[EDGE FUNCTION] Exception generating PDF:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

