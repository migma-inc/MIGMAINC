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

    // Fetch active terms content
    const { data: termsData, error: termsError } = await supabase
      .from('application_terms')
      .select('title, content')
      .eq('term_type', 'partner_contract')
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (termsError) {
      console.error("[EDGE FUNCTION] Error fetching terms:", termsError);
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
    const loadImage = async (urlOrPath: string | null | undefined): Promise<{ dataUrl: string; format: string } | null> => {
      if (!urlOrPath) {
        return null;
      }

      try {
        let imageArrayBuffer: ArrayBuffer;
        let mimeType: string;

        // If it's a full URL, fetch directly
        if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
          console.log("[EDGE FUNCTION] Loading image from URL:", urlOrPath);
          const imageResponse = await fetch(urlOrPath);
          if (!imageResponse.ok) {
            throw new Error(`Failed to fetch image from URL: ${imageResponse.status}`);
          }
          const imageBlob = await imageResponse.blob();
          imageArrayBuffer = await imageBlob.arrayBuffer();
          mimeType = imageBlob.type || 'image/jpeg';
        } else {
          // Assume it's a path in the identity-photos bucket (backwards compatibility)
          console.log("[EDGE FUNCTION] Attempting to load image from storage path:", urlOrPath);
          const { data: imageData, error: downloadError } = await supabase.storage
            .from('identity-photos')
            .download(urlOrPath);

          if (downloadError || !imageData) {
            console.error("[EDGE FUNCTION] Error downloading image from storage:", downloadError);
            // Try public URL as fallback
            const { data: { publicUrl } } = supabase.storage
              .from('identity-photos')
              .getPublicUrl(urlOrPath);
            
            console.log("[EDGE FUNCTION] Trying public URL for storage image:", publicUrl);
            const imageResponse = await fetch(publicUrl);
            if (!imageResponse.ok) {
              throw new Error(`Failed to fetch image from storage public URL: ${imageResponse.status}`);
            }
            const imageBlob = await imageResponse.blob();
            imageArrayBuffer = await imageBlob.arrayBuffer();
            mimeType = imageBlob.type || 'image/jpeg';
          } else {
            imageArrayBuffer = await imageData.arrayBuffer();
            const fileExtension = urlOrPath.toLowerCase().split('.').pop();
            mimeType = fileExtension === 'png' ? 'image/png' : 'image/jpeg';
          }
        }

        // Convert ArrayBuffer to base64 (chunked approach for large files)
        const bytes = new Uint8Array(imageArrayBuffer);
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, i + chunkSize);
          binary += String.fromCharCode.apply(null, Array.from(chunk));
        }
        const imageBase64 = btoa(binary);
        const imageFormat = mimeType.includes('png') ? 'PNG' : 'JPEG';
        const imageDataUrl = `data:${mimeType};base64,${imageBase64}`;

        console.log("[EDGE FUNCTION] Image loaded successfully");
        return { dataUrl: imageDataUrl, format: imageFormat };
      } catch (imageError) {
        console.error("[EDGE FUNCTION] Could not load image:", imageError);
        return null;
      }
    };

    // Helper functions for specific images
    const loadIdentityPhoto = async () => loadImage(termAcceptance.identity_photo_path);
    const loadDocumentFront = async () => loadImage((termAcceptance as any).document_front_url);
    const loadDocumentBack = async () => loadImage((termAcceptance as any).document_back_url);

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
    pdf.text('MIGMA', pageWidth / 2, currentY, { align: 'center' });
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
    if (termsData) {
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
      const textContent = convertHtmlToText(termsData.content);

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

    // Signature with underlined name
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Signature:', margin, currentY);
    
    // Calculate where to start the name
    const nameStartX = margin + pdf.getTextWidth('Signature: ') + 5;
    
    // Write the name in bold
    pdf.setFont('helvetica', 'bold');
    pdf.text(application.full_name, nameStartX, currentY);
    
    // Draw line under the name (underlined)
    const nameWidth = pdf.getTextWidth(application.full_name);
    const lineY = currentY + 2;
    pdf.setLineWidth(0.5);
    pdf.line(nameStartX, lineY, nameStartX + nameWidth, lineY);
    
    currentY += 12;

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
      // Check if new page is needed
      if (currentY > pageHeight - margin - 120) {
        pdf.addPage();
        currentY = margin;
      }

      const maxWidth = 60;
      const maxHeight = 45;

      if (documentFront) {
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text('DOCUMENT FRONT', margin, currentY);
        currentY += 8;
        pdf.addImage(documentFront.dataUrl, documentFront.format, margin, currentY, maxWidth, maxHeight);
        currentY += maxHeight + 10;
      }

      if (documentBack) {
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text('DOCUMENT BACK', margin, currentY);
        currentY += 8;
        pdf.addImage(documentBack.dataUrl, documentBack.format, margin, currentY, maxWidth, maxHeight);
        currentY += maxHeight + 10;
      }

      if (identityPhoto) {
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text('IDENTITY PHOTO WITH DOCUMENT', margin, currentY);
        currentY += 8;
        pdf.addImage(identityPhoto.dataUrl, identityPhoto.format, margin, currentY, maxWidth, maxHeight);
        currentY += maxHeight + 10;
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
    if (termsData) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Term Title:', margin, currentY);
      pdf.setFont('helvetica', 'normal');
      pdf.text(termsData.title, margin + 55, currentY);
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
    const filePath = `contracts/${fileName}`;

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

