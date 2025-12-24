// Supabase Edge Function to generate ANNEX I PDF
// Generates a PDF for Payment Authorization & Non-Dispute Agreement for scholarship and i20-control products

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

// ANNEX I text (plain text version for PDF)
const ANNEX_I_TEXT = `ANNEX I – PAYMENT AUTHORIZATION & NON-DISPUTE AGREEMENT

This Annex is an integral part of the Educational Services Agreement entered into between MIGMA INC. and the CLIENT.

1. CLIENT IDENTIFICATION

The individual identified at the end of this Agreement ("CLIENT").

2. PAYMENT AUTHORIZATION

The CLIENT expressly declares that:

a) All payments made to MIGMA INC. are voluntary, informed, and authorized;
b) The CLIENT is fully aware of the service contracted, its nature, scope, and limitations;
c) Payments may be processed through international or intermediary platforms.

3. NATURE OF SERVICES & NO CHARGEBACK BASIS

The CLIENT acknowledges that:

a) The services are personalized, intellectual, and initiated immediately upon payment;
b) The COMPANY provides educational mentorship and academic guidance, not legal services;
c) Once services commence, payments are non-refundable, except as expressly stated in the main Agreement.

4. NON-DISPUTE COMMITMENT

The CLIENT agrees that they will not initiate chargebacks, payment disputes, or claims based on:

- alleged lack of recognition of the transaction;
- dissatisfaction with outcomes dependent on third parties;
- processing times of institutions or authorities;
- misunderstanding of service scope already clarified in the Agreement.

5. PRIOR INTERNAL RESOLUTION

Before initiating any bank or platform dispute, the CLIENT agrees to first contact MIGMA INC. through official support channels for resolution.

6. EVIDENCE AUTHORIZATION

In case of a payment dispute, the CLIENT authorizes MIGMA INC. to use the following as evidence:

- electronic signature
- selfie holding identification document
- IP address, date, and time logs
- signed Agreement and Annex
- communication records related to service delivery

7. INTERNATIONAL PROCESSING CONSENT

The CLIENT acknowledges that charges may appear under different corporate or platform descriptors due to international payment processing.

8. FINAL DECLARATION

The CLIENT declares that they have read, understood, and voluntarily accepted this Payment Authorization and Non-Dispute Agreement.`;

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { order_id } = await req.json();

    if (!order_id) {
      return new Response(
        JSON.stringify({ success: false, error: "order_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[EDGE FUNCTION] Generating ANNEX I PDF for order:", order_id);

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fetch order data
    const { data: order, error: orderError } = await supabase
      .from('visa_orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      console.error("[EDGE FUNCTION] Error fetching order:", orderError);
      return new Response(
        JSON.stringify({ success: false, error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch product data
    const { data: product, error: productError } = await supabase
      .from('visa_products')
      .select('*')
      .eq('slug', order.product_slug)
      .single();

    if (productError) {
      console.error("[EDGE FUNCTION] Error fetching product:", productError);
    }

    // Fetch identity files
    // For scholarship and i20-control products, we need to get documents from the previous selection-process order
    let identityFiles: { document_front: string | null; document_back: string | null; selfie_doc: string | null } = {
      document_front: null,
      document_back: null,
      selfie_doc: null,
    };

    let serviceRequestIdToUse: string | null = null;

    // Check if this is a scholarship or i20-control product
    const isAnnexProduct = order.product_slug?.endsWith('-scholarship') || order.product_slug?.endsWith('-i20-control');
    
    if (isAnnexProduct) {
      // For scholarship/i20-control, find the previous selection-process order from the same client
      console.log("[EDGE FUNCTION] This is a scholarship/i20-control product, searching for previous selection-process order...");
      
      // Extract base product slug (e.g., "cos-scholarship" -> "cos-selection-process")
      const baseSlug = order.product_slug.replace(/-scholarship$/, '').replace(/-i20-control$/, '');
      const selectionProcessSlug = `${baseSlug}-selection-process`;
      
      console.log("[EDGE FUNCTION] Looking for selection-process order with slug:", selectionProcessSlug);
      console.log("[EDGE FUNCTION] Client email:", order.client_email);
      
      // Find the most recent completed selection-process order for this client
      const { data: previousOrder, error: previousOrderError } = await supabase
        .from('visa_orders')
        .select('id, service_request_id, product_slug, order_number, created_at')
        .eq('client_email', order.client_email)
        .eq('product_slug', selectionProcessSlug)
        .eq('payment_status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (previousOrderError || !previousOrder) {
        console.error("[EDGE FUNCTION] Could not find previous selection-process order:", previousOrderError);
        console.log("[EDGE FUNCTION] Will try to use current order's service_request_id as fallback");
        serviceRequestIdToUse = order.service_request_id;
      } else {
        console.log("[EDGE FUNCTION] Found previous selection-process order:", previousOrder.order_number);
        console.log("[EDGE FUNCTION] Previous order service_request_id:", previousOrder.service_request_id);
        serviceRequestIdToUse = previousOrder.service_request_id;
      }
    } else {
      // For other products, use current order's service_request_id
      serviceRequestIdToUse = order.service_request_id;
    }

    // Fetch identity files using the determined service_request_id
    if (serviceRequestIdToUse) {
      console.log("[EDGE FUNCTION] Fetching identity files for service_request_id:", serviceRequestIdToUse);
      const { data: files, error: filesError } = await supabase
        .from('identity_files')
        .select('file_type, file_path')
        .eq('service_request_id', serviceRequestIdToUse);

      if (filesError) {
        console.error("[EDGE FUNCTION] Error fetching identity files:", filesError);
      } else if (files) {
        console.log("[EDGE FUNCTION] Found identity files:", files.length);
        files.forEach((file) => {
          console.log("[EDGE FUNCTION] Identity file:", file.file_type, file.file_path);
          if (file.file_type === 'document_front' && file.file_path) {
            identityFiles.document_front = file.file_path;
          } else if (file.file_type === 'document_back' && file.file_path) {
            identityFiles.document_back = file.file_path;
          } else if (file.file_type === 'selfie_doc' && file.file_path) {
            identityFiles.selfie_doc = file.file_path;
          }
        });
        console.log("[EDGE FUNCTION] Identity files summary:", {
          document_front: identityFiles.document_front ? 'found' : 'missing',
          document_back: identityFiles.document_back ? 'found' : 'missing',
          selfie_doc: identityFiles.selfie_doc ? 'found' : 'missing',
        });
      } else {
        console.log("[EDGE FUNCTION] No identity files found for service_request_id:", serviceRequestIdToUse);
      }
    } else {
      console.log("[EDGE FUNCTION] No service_request_id available, skipping identity files fetch");
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
        if (currentYPos > pageHeight - margin - 10) {
          pdf.addPage();
          currentYPos = margin;
        }
        pdf.text(lines[i], x, currentYPos);
        currentYPos += fontSize * 0.6;
      }
      
      return currentYPos;
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
        
        pdf.text(
          `Generated on ${footerDate}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
        
        pdf.text(
          'This document has legal validity and serves as proof of acceptance',
          pageWidth / 2,
          pageHeight - 5,
          { align: 'center' }
        );
      }
    };

    // Helper function to load image from URL
    const loadImage = async (imageUrl: string | null): Promise<{ dataUrl: string; format: string } | null> => {
      if (!imageUrl) {
        return null;
      }

      try {
        console.log("[EDGE FUNCTION] Loading image from:", imageUrl);
        
        // Get public URL if it's a storage path
        let publicUrl = imageUrl;
        if (imageUrl.startsWith('visa-documents/')) {
          const { data: { publicUrl: url } } = supabase.storage
            .from('visa-documents')
            .getPublicUrl(imageUrl);
          publicUrl = url;
        } else if (!imageUrl.includes('/storage/v1/object/public/') && !imageUrl.startsWith('http')) {
          // Try to construct public URL
          const { data: { publicUrl: url } } = supabase.storage
            .from('visa-documents')
            .getPublicUrl(imageUrl);
          publicUrl = url;
        }
        
        // Fetch the image
        const imageResponse = await fetch(publicUrl);
        
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.status}`);
        }
        
        const imageBlob = await imageResponse.blob();
        const imageArrayBuffer = await imageBlob.arrayBuffer();
        const mimeType = imageBlob.type;
        
        // Convert to base64
        const bytes = new Uint8Array(imageArrayBuffer);
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, i + chunkSize);
          binary += String.fromCharCode.apply(null, Array.from(chunk));
        }
        const imageBase64 = btoa(binary);
        const imageFormat = mimeType.includes('png') ? 'PNG' : mimeType.includes('pdf') ? 'PDF' : 'JPEG';
        const imageDataUrl = `data:${mimeType};base64,${imageBase64}`;
        
        return { dataUrl: imageDataUrl, format: imageFormat };
      } catch (imageError) {
        console.error("[EDGE FUNCTION] Could not load image:", imageError);
        return null;
      }
    };

    // Helper function to load signature image
    const loadSignatureImage = async (): Promise<{ dataUrl: string; format: string } | null> => {
      if (!order.signature_image_url) {
        return null;
      }
      return await loadImage(order.signature_image_url);
    };

    // ============================================
    // 1. Header
    // ============================================
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text('ANNEX I', pageWidth / 2, currentY, { align: 'center' });
    currentY += 8;
    
    pdf.setFontSize(14);
    pdf.text('PAYMENT AUTHORIZATION & NON-DISPUTE AGREEMENT', pageWidth / 2, currentY, { align: 'center' });
    currentY += 15;

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text('MIGMA INC.', pageWidth / 2, currentY, { align: 'center' });
    currentY += 20;

    pdf.setLineWidth(0.5);
    pdf.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 10;

    // ============================================
    // 2. Order Information
    // ============================================
    if (currentY > pageHeight - margin - 50) {
      pdf.addPage();
      currentY = margin;
    }

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('ORDER INFORMATION', margin, currentY);
    currentY += 12;

    pdf.setFontSize(11);
    
    // Order Number
    pdf.setFont('helvetica', 'bold');
    pdf.text('Order Number:', margin, currentY);
    pdf.setFont('helvetica', 'normal');
    pdf.text(order.order_number, margin + 50, currentY);
    currentY += 8;

    // Product
    pdf.setFont('helvetica', 'bold');
    pdf.text('Service:', margin, currentY);
    pdf.setFont('helvetica', 'normal');
    pdf.text(product?.name || order.product_slug, margin + 50, currentY);
    currentY += 8;

    // Total Price - use correct amount and currency based on payment method
    let displayAmount = parseFloat(order.total_price_usd);
    let currencySymbol = 'US$';
    
    if (order.payment_method === 'stripe_pix') {
      if (order.payment_metadata && typeof order.payment_metadata === 'object' && 'final_amount' in order.payment_metadata) {
        const finalAmount = parseFloat(order.payment_metadata.final_amount as string);
        if (!isNaN(finalAmount) && finalAmount > 0) {
          displayAmount = finalAmount;
        }
      }
      currencySymbol = 'R$';
    } else if (order.payment_method === 'stripe_card') {
      displayAmount = parseFloat(order.total_price_usd);
      currencySymbol = 'US$';
    } else if (order.payment_method === 'zelle') {
      displayAmount = parseFloat(order.total_price_usd);
      currencySymbol = 'US$';
    }
    
    pdf.setFont('helvetica', 'bold');
    pdf.text('Total Amount:', margin, currentY);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${currencySymbol} ${displayAmount.toFixed(2)}`, margin + 50, currentY);
    currentY += 8;

    // Payment Method
    if (order.payment_method) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Payment Method:', margin, currentY);
      pdf.setFont('helvetica', 'normal');
      
      let paymentMethodDisplay = '';
      if (order.payment_method === 'stripe_card') {
        paymentMethodDisplay = 'STRIPE CARD';
      } else if (order.payment_method === 'stripe_pix') {
        paymentMethodDisplay = 'STRIPE PIX';
      } else if (order.payment_method === 'zelle') {
        paymentMethodDisplay = 'ZELLE';
      } else {
        paymentMethodDisplay = order.payment_method.replace('_', ' ').toUpperCase();
      }
      
      pdf.text(paymentMethodDisplay, margin + 50, currentY);
      currentY += 8;
    }

    // Client Name
    pdf.setFont('helvetica', 'bold');
    pdf.text('Client Name:', margin, currentY);
    pdf.setFont('helvetica', 'normal');
    pdf.text(order.client_name, margin + 50, currentY);
    currentY += 8;

    // Client Email
    pdf.setFont('helvetica', 'bold');
    pdf.text('Client Email:', margin, currentY);
    pdf.setFont('helvetica', 'normal');
    pdf.text(order.client_email, margin + 50, currentY);
    currentY += 15;

    // ============================================
    // 3. ANNEX I Text
    // ============================================
    if (currentY > pageHeight - margin - 60) {
      pdf.addPage();
      currentY = margin;
    }

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('ANNEX I TERMS', margin, currentY);
    currentY += 12;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    currentY = addWrappedText(
      ANNEX_I_TEXT,
      margin,
      currentY,
      pageWidth - margin * 2,
      10
    );
    currentY += 20;

    // ============================================
    // 4. Identity Documents Section
    // ============================================
    if (currentY > pageHeight - margin - 100) {
      pdf.addPage();
      currentY = margin;
    }

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('IDENTITY DOCUMENTS', margin, currentY);
    currentY += 15;

    // Selfie (if exists)
    const selfieUrl = identityFiles.selfie_doc || order.contract_selfie_url || null;
    console.log("[EDGE FUNCTION] Selfie URL:", selfieUrl);
    if (selfieUrl) {
      if (currentY > pageHeight - margin - 80) {
        pdf.addPage();
        currentY = margin;
      }

      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Selfie with Document:', margin, currentY);
      currentY += 10;

      console.log("[EDGE FUNCTION] Loading selfie image...");
      const selfieImage = await loadImage(selfieUrl);
      if (selfieImage && selfieImage.format !== 'PDF') {
        try {
          const maxWidth = 60;
          const maxHeight = 60;
          pdf.addImage(
            selfieImage.dataUrl,
            selfieImage.format,
            (pageWidth - maxWidth) / 2,
            currentY,
            maxWidth,
            maxHeight
          );
          currentY += maxHeight + 10;
        } catch (imgError) {
          console.error("[EDGE FUNCTION] Error adding selfie image:", imgError);
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'italic');
          pdf.text('(Image could not be loaded)', margin, currentY);
          currentY += 10;
        }
      } else {
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'italic');
        pdf.text('(PDF document - see storage)', margin, currentY);
        currentY += 10;
      }
    }

    // Document Front (if exists)
    const documentFrontUrl = identityFiles.document_front || null;
    console.log("[EDGE FUNCTION] Document Front URL:", documentFrontUrl);
    if (documentFrontUrl) {
      if (currentY > pageHeight - margin - 80) {
        pdf.addPage();
        currentY = margin;
      }

      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Document Front:', margin, currentY);
      currentY += 10;

      console.log("[EDGE FUNCTION] Loading document front image...");
      const docFrontImage = await loadImage(documentFrontUrl);
      if (docFrontImage && docFrontImage.format !== 'PDF') {
        try {
          const maxWidth = 80;
          const maxHeight = 50;
          pdf.addImage(
            docFrontImage.dataUrl,
            docFrontImage.format,
            margin,
            currentY,
            maxWidth,
            maxHeight
          );
          currentY += maxHeight + 10;
        } catch (imgError) {
          console.error("[EDGE FUNCTION] Error adding document front image:", imgError);
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'italic');
          pdf.text('(Image could not be loaded)', margin, currentY);
          currentY += 10;
        }
      } else {
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'italic');
        pdf.text('(PDF document - see storage)', margin, currentY);
        currentY += 10;
      }
    }

    // Document Back (if exists)
    const documentBackUrl = identityFiles.document_back || null;
    console.log("[EDGE FUNCTION] Document Back URL:", documentBackUrl);
    if (documentBackUrl) {
      if (currentY > pageHeight - margin - 80) {
        pdf.addPage();
        currentY = margin;
      }

      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Document Back:', margin, currentY);
      currentY += 10;

      console.log("[EDGE FUNCTION] Loading document back image...");
      const docBackImage = await loadImage(documentBackUrl);
      if (docBackImage && docBackImage.format !== 'PDF') {
        try {
          const maxWidth = 80;
          const maxHeight = 50;
          pdf.addImage(
            docBackImage.dataUrl,
            docBackImage.format,
            margin,
            currentY,
            maxWidth,
            maxHeight
          );
          currentY += maxHeight + 10;
        } catch (imgError) {
          console.error("[EDGE FUNCTION] Error adding document back image:", imgError);
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'italic');
          pdf.text('(Image could not be loaded)', margin, currentY);
          currentY += 10;
        }
      } else {
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'italic');
        pdf.text('(PDF document - see storage)', margin, currentY);
        currentY += 10;
      }
    }

    currentY += 10;

    // ============================================
    // 5. Signature Section
    // ============================================
    if (currentY > pageHeight - margin - 80) {
      pdf.addPage();
      currentY = margin;
    }

    // Date
    const signedDate = order.contract_signed_at ? new Date(order.contract_signed_at) : new Date(order.created_at);
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const month = monthNames[signedDate.getMonth()];
    const day = signedDate.getDate();
    const year = signedDate.getFullYear();
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Date: ${month} ${day}, ${year}.`, margin, currentY);
    currentY += 15;

    // Signature line
    pdf.setFontSize(14);
    pdf.text('⸻', pageWidth / 2, currentY, { align: 'center' });
    currentY += 12;

    // CLIENT title
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('CLIENT', margin, currentY);
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
        if (currentY > pageHeight - margin - 30) {
          pdf.addPage();
          currentY = margin;
        }
        
        const maxWidth = 45;
        const maxHeight = 20;
        
        pdf.addImage(
          signatureImage.dataUrl,
          signatureImage.format,
          margin,
          currentY,
          maxWidth,
          maxHeight
        );
        currentY += maxHeight + 15;
      } catch (imgError) {
        console.error("[EDGE FUNCTION] Error adding signature image to PDF:", imgError);
        // Fall through to show name as fallback
        const nameStartX = margin + pdf.getTextWidth('Signature: ') + 5;
        pdf.setFont('helvetica', 'bold');
        pdf.text(order.client_name, nameStartX, currentY);
        
        const nameWidth = pdf.getTextWidth(order.client_name);
        const lineY = currentY + 2;
        pdf.setLineWidth(0.5);
        pdf.line(nameStartX, lineY, nameStartX + nameWidth, lineY);
        currentY += 15;
      }
    } else {
      // No signature image - show name as fallback
      const nameStartX = margin + pdf.getTextWidth('Signature: ') + 5;
      pdf.setFont('helvetica', 'bold');
      pdf.text(order.client_name, nameStartX, currentY);
      
      const nameWidth = pdf.getTextWidth(order.client_name);
      const lineY = currentY + 2;
      pdf.setLineWidth(0.5);
      pdf.line(nameStartX, lineY, nameStartX + nameWidth, lineY);
      currentY += 15;
    }

    // ============================================
    // 6. Technical Information
    // ============================================
    if (currentY > pageHeight - margin - 60) {
      pdf.addPage();
      currentY = margin;
    }

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('TECHNICAL INFORMATION', margin, currentY);
    currentY += 12;

    pdf.setFontSize(10);
    
    // Contract signed at
    if (order.contract_signed_at) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Contract Signed At:', margin, currentY);
      pdf.setFont('helvetica', 'normal');
      const signedAt = new Date(order.contract_signed_at).toLocaleString('en-US');
      pdf.text(signedAt, margin + 60, currentY);
      currentY += 8;
    }

    // Order created at
    pdf.setFont('helvetica', 'bold');
    pdf.text('Order Created At:', margin, currentY);
    pdf.setFont('helvetica', 'normal');
    const createdAt = new Date(order.created_at).toLocaleString('en-US');
    pdf.text(createdAt, margin + 60, currentY);
    currentY += 8;

    // IP Address
    if (order.ip_address) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('IP Address:', margin, currentY);
      pdf.setFont('helvetica', 'normal');
      pdf.text(order.ip_address, margin + 60, currentY);
      currentY += 8;
    }

    // Payment Status
    if (order.payment_status === 'completed') {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Payment Status:', margin, currentY);
      pdf.setFont('helvetica', 'normal');
      pdf.text(order.payment_status.toUpperCase(), margin + 60, currentY);
      currentY += 8;
    }

    // Add footer to all pages
    addFooter();

    // Generate PDF blob
    const pdfBlob = pdf.output('blob');
    const pdfArrayBuffer = await pdfBlob.arrayBuffer();
    const pdfBuffer = new Uint8Array(pdfArrayBuffer);

    // Generate filename
    const normalizedName = order.client_name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    const timestamp = Date.now();
    const fileName = `annex_i_${normalizedName}_${order.order_number}_${dateStr}_${timestamp}.pdf`;
    const filePath = `visa-annexes/${fileName}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
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

    // Update order with PDF URL
    const { error: updateError } = await supabase
      .from('visa_orders')
      .update({ annex_pdf_url: publicUrl })
      .eq('id', order_id);

    if (updateError) {
      console.error("[EDGE FUNCTION] Error updating order:", updateError);
      // Still return success since PDF was generated
    }

    console.log("[EDGE FUNCTION] ANNEX I PDF generated successfully:", publicUrl);

    return new Response(
      JSON.stringify({
        success: true,
        pdf_url: publicUrl,
        file_path: filePath,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[EDGE FUNCTION] Error generating ANNEX I PDF:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

