// Supabase Edge Function to generate visa service contract PDF
// Generates a PDF contract including order data, client information, selfie with document, IP, and terms

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { jsPDF } from "npm:jspdf@^2.5.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BUCKET_NAME = 'contracts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    console.log("[EDGE FUNCTION] 🛡️ OPTIONS request received (Contract)");
    return new Response("ok", {
      status: 200,
      headers: corsHeaders
    });
  }

  try {
    console.log("[EDGE FUNCTION] ========== POST REQUEST STARTED (Contract) ==========");
    const { order_id } = await req.json();

    if (!order_id) {
      return new Response(
        JSON.stringify({ success: false, error: "order_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[EDGE FUNCTION] Generating visa contract PDF for order:", order_id);

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

    // Fetch contract template for this product
    let contractTemplate: { content: string } | null = null;
    if (order.product_slug) {
      const { data: template, error: templateError } = await supabase
        .from('contract_templates')
        .select('content')
        .eq('template_type', 'visa_service')
        .eq('product_slug', order.product_slug)
        .eq('is_active', true)
        .single();

      if (!templateError && template) {
        contractTemplate = template;
        console.log("[EDGE FUNCTION] Contract template found for product:", order.product_slug);
      } else {
        console.log("[EDGE FUNCTION] No contract template found for product:", order.product_slug);
      }
    }

    // Fetch identity files if service_request_id exists
    let identityFiles: { document_front: string | null; document_back: string | null; selfie_doc: string | null } = {
      document_front: null,
      document_back: null,
      selfie_doc: null,
    };

    if (order.service_request_id) {
      const { data: files, error: filesError } = await supabase
        .from('identity_files')
        .select('file_type, file_path')
        .eq('service_request_id', order.service_request_id);

      if (!filesError && files) {
        files.forEach((file) => {
          if (file.file_type === 'document_front' && file.file_path) {
            identityFiles.document_front = file.file_path;
          } else if (file.file_type === 'document_back' && file.file_path) {
            identityFiles.document_back = file.file_path;
          } else if (file.file_type === 'selfie_doc' && file.file_path) {
            identityFiles.selfie_doc = file.file_path;
          }
        });
      }
    }

    // Create PDF
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    let currentY = margin;

    // Helper function to convert HTML to plain text
    const convertHtmlToText = (html: string): string => {
      if (!html) return '';

      // Remove script and style tags and their content
      let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
      text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

      // Replace common HTML tags with appropriate text formatting
      text = text.replace(/<h[1-6][^>]*>/gi, '\n\n');
      text = text.replace(/<\/h[1-6]>/gi, '\n');
      text = text.replace(/<p[^>]*>/gi, '\n');
      text = text.replace(/<\/p>/gi, '\n');
      text = text.replace(/<br[^>]*>/gi, '\n');
      text = text.replace(/<li[^>]*>/gi, '\n• ');
      text = text.replace(/<\/li>/gi, '');
      text = text.replace(/<ul[^>]*>/gi, '\n');
      text = text.replace(/<\/ul>/gi, '\n');
      text = text.replace(/<ol[^>]*>/gi, '\n');
      text = text.replace(/<\/ol>/gi, '\n');
      text = text.replace(/<strong[^>]*>/gi, '');
      text = text.replace(/<\/strong>/gi, '');
      text = text.replace(/<b[^>]*>/gi, '');
      text = text.replace(/<\/b>/gi, '');
      text = text.replace(/<em[^>]*>/gi, '');
      text = text.replace(/<\/em>/gi, '');
      text = text.replace(/<i[^>]*>/gi, '');
      text = text.replace(/<\/i>/gi, '');

      // Remove all remaining HTML tags
      text = text.replace(/<[^>]+>/g, '');

      // Decode HTML entities
      text = text.replace(/&nbsp;/g, ' ');
      text = text.replace(/&amp;/g, '&');
      text = text.replace(/&lt;/g, '<');
      text = text.replace(/&gt;/g, '>');
      text = text.replace(/&quot;/g, '"');
      text = text.replace(/&#39;/g, "'");
      text = text.replace(/&apos;/g, "'");

      // Clean up whitespace
      text = text.replace(/\n\s*\n\s*\n/g, '\n\n'); // Multiple newlines to double
      text = text.replace(/[ \t]+/g, ' '); // Multiple spaces to single
      text = text.trim();

      return text;
    };

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

    // Helper function to load image from URL (generic, works for any image)
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
            .getPublicUrl(imageUrl.replace('visa-documents/', ''));
          publicUrl = url;
        } else if (imageUrl.startsWith('visa-signatures/')) {
          const { data: { publicUrl: url } } = supabase.storage
            .from('visa-signatures')
            .getPublicUrl(imageUrl.replace('visa-signatures/', ''));
          publicUrl = url;
        } else if (!imageUrl.includes('/storage/v1/object/public/') && !imageUrl.startsWith('http')) {
          // If it is just a filename and we don't know the bucket, try visa-signatures first if it's a signature
          // Otherwise default to visa-documents
          const bucket = imageUrl.includes('sig') ? 'visa-signatures' : 'visa-documents';
          const { data: { publicUrl: url } } = supabase.storage
            .from(bucket)
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
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('VISA SERVICE CONTRACT', pageWidth / 2, currentY, { align: 'center' });
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

    // Determine amount and currency based on payment method (not currency in metadata)
    if (order.payment_method === 'stripe_pix') {
      // PIX payments: use final_amount in BRL from metadata
      if (order.payment_metadata && typeof order.payment_metadata === 'object' && 'final_amount' in order.payment_metadata) {
        const finalAmount = parseFloat(order.payment_metadata.final_amount as string);
        if (!isNaN(finalAmount) && finalAmount > 0) {
          displayAmount = finalAmount;
        }
      }
      currencySymbol = 'R$';
    } else if (order.payment_method === 'stripe_card') {
      // Card payments: always use USD amount (total_price_usd), regardless of processing currency
      displayAmount = parseFloat(order.total_price_usd);
      currencySymbol = 'US$';
    } else if (order.payment_method === 'parcelow') {
      // Parcelow payments: use total_brl from metadata (the actual BRL amount paid, includes all fees)
      let foundInMetadata = false;
      if (order.payment_metadata && typeof order.payment_metadata === 'object') {
        // Check total_brl first (this is the actual amount paid in BRL)
        if ('total_brl' in order.payment_metadata) {
          const val = parseFloat(String(order.payment_metadata.total_brl));
          if (!isNaN(val) && val > 0) {
            displayAmount = val;
            foundInMetadata = true;
          }
        }

        // Fallback: check base_brl (amount without installment fees)
        if (!foundInMetadata && 'base_brl' in order.payment_metadata) {
          const val = parseFloat(String(order.payment_metadata.base_brl));
          if (!isNaN(val) && val > 0) {
            displayAmount = val;
            foundInMetadata = true;
          }
        }
      }

      if (!foundInMetadata) {
        // Last resort fallback: use total_price_usd
        displayAmount = parseFloat(order.total_price_usd);
      }

      currencySymbol = 'R$'; // Parcelow is always in BRL
    } else if (order.payment_method === 'zelle' || order.payment_method === 'manual') {
      // Zelle and Manual: always USD, use total_price_usd (no fees)
      displayAmount = parseFloat(order.total_price_usd);
      currencySymbol = 'US$';
    }

    pdf.setFont('helvetica', 'bold');
    pdf.text('Total Amount:', margin, currentY);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${currencySymbol} ${displayAmount.toFixed(2)}`, margin + 50, currentY);
    currentY += 8;

    // Payment Method - use actual payment_method, don't assume based on currency
    if (order.payment_method) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Payment Method:', margin, currentY);
      pdf.setFont('helvetica', 'normal');

      // Determine correct payment method display based on actual payment_method
      let paymentMethodDisplay = '';
      if (order.payment_method === 'stripe_card') {
        paymentMethodDisplay = 'STRIPE CARD';
      } else if (order.payment_method === 'stripe_pix') {
        paymentMethodDisplay = 'STRIPE PIX';
      } else if (order.payment_method === 'zelle') {
        paymentMethodDisplay = 'ZELLE';
      } else if (order.payment_method === 'manual') {
        paymentMethodDisplay = 'MANUAL BY SELLER';
      } else {
        paymentMethodDisplay = order.payment_method.replace('_', ' ').toUpperCase();
      }

      pdf.text(paymentMethodDisplay, margin + 50, currentY);
      currentY += 8;
    }

    // Seller ID (if exists)
    if (order.seller_id) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Seller ID:', margin, currentY);
      pdf.setFont('helvetica', 'normal');
      pdf.text(order.seller_id, margin + 50, currentY);
      currentY += 8;
    }

    currentY += 10;

    // ============================================
    // 3. Client Information
    // ============================================
    if (currentY > pageHeight - margin - 80) {
      pdf.addPage();
      currentY = margin;
    }

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('CLIENT INFORMATION', margin, currentY);
    currentY += 12;

    pdf.setFontSize(11);

    // Name
    pdf.setFont('helvetica', 'bold');
    pdf.text('Full Name:', margin, currentY);
    pdf.setFont('helvetica', 'normal');
    pdf.text(order.client_name, margin + 40, currentY);
    currentY += 8;

    // Email
    pdf.setFont('helvetica', 'bold');
    pdf.text('Email:', margin, currentY);
    pdf.setFont('helvetica', 'normal');
    pdf.text(order.client_email, margin + 40, currentY);
    currentY += 8;

    // WhatsApp
    if (order.client_whatsapp) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('WhatsApp:', margin, currentY);
      pdf.setFont('helvetica', 'normal');
      pdf.text(order.client_whatsapp, margin + 40, currentY);
      currentY += 8;
    }

    // Country
    if (order.client_country) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Country:', margin, currentY);
      pdf.setFont('helvetica', 'normal');
      pdf.text(order.client_country, margin + 40, currentY);
      currentY += 8;
    }

    // Nationality
    if (order.client_nationality) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Nationality:', margin, currentY);
      pdf.setFont('helvetica', 'normal');
      pdf.text(order.client_nationality, margin + 40, currentY);
      currentY += 8;
    }

    // Extra Units (if applicable)
    if (order.extra_units > 0 && order.extra_unit_label) {
      // Calculate label width to position value correctly
      pdf.setFont('helvetica', 'bold');
      const labelText = `${order.extra_unit_label}:`;
      pdf.text(labelText, margin, currentY);

      // Position value with proper spacing after the label
      const labelWidth = pdf.getTextWidth(labelText);
      pdf.setFont('helvetica', 'normal');
      pdf.text(order.extra_units.toString(), margin + labelWidth + 5, currentY);
      currentY += 8;
    }

    currentY += 10;

    // ============================================
    // 3.1. Payment Details (For Parcelow/Credit Card)
    // ============================================
    if (order.payment_method === 'parcelow') {
      const metadata = order.payment_metadata as any;
      if (metadata?.credit_card_name || metadata?.cpf) {
        if (currentY > pageHeight - margin - 40) {
          pdf.addPage();
          currentY = margin;
        }

        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('PAYMENT DETAILS', margin, currentY);
        currentY += 12;

        pdf.setFontSize(11);

        // Name on Card
        if (metadata?.credit_card_name) {
          pdf.setFont('helvetica', 'bold');
          pdf.text('Name on Card:', margin, currentY);
          pdf.setFont('helvetica', 'normal');
          pdf.text(metadata.credit_card_name, margin + 40, currentY);
          currentY += 8;
        }

        // CPF
        if (metadata?.cpf) {
          pdf.setFont('helvetica', 'bold');
          pdf.text('CPF:', margin, currentY);
          pdf.setFont('helvetica', 'normal');
          pdf.text(metadata.cpf, margin + 40, currentY);
          currentY += 8;
        }

        currentY += 10;
      }
    }

    // ============================================
    // 4. Service Terms & Conditions
    // ============================================
    if (currentY > pageHeight - margin - 60) {
      pdf.addPage();
      currentY = margin;
    }

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('TERMS AND CONDITIONS', margin, currentY);
    currentY += 12;

    // Use contract template content if available, otherwise use default
    let termsContent: string;
    if (contractTemplate && contractTemplate.content) {
      // Convert HTML template to plain text for PDF
      termsContent = convertHtmlToText(contractTemplate.content);
      console.log("[EDGE FUNCTION] Using contract template from database");
    } else {
      // Fallback to default terms if no template found
      termsContent = `
By signing this contract, the client agrees to the following terms:

1. The client confirms that all information provided is accurate and truthful.
2. The client understands that providing false information may result in cancellation of services and legal action.
3. The client agrees to pay the total amount specified in this contract.
4. MIGMA INC. will provide visa consultation services as described in the service package.
5. The client acknowledges that visa approval is subject to immigration authorities and MIGMA INC. cannot guarantee approval.
6. Refunds are subject to MIGMA INC.'s refund policy as outlined in the service terms.
7. The client agrees to provide all necessary documentation in a timely manner.
8. This contract is legally binding and enforceable.

The client has electronically signed this contract by uploading a selfie with their identity document, confirming their identity and acceptance of these terms.
    `.trim();
      console.log("[EDGE FUNCTION] Using default terms (no template found)");
    }

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    currentY = addWrappedText(
      termsContent,
      margin,
      currentY,
      pageWidth - margin * 2,
      10
    );
    currentY += 20;

    // ============================================
    // 5. Identity Documents Section
    // ============================================
    if (currentY > pageHeight - margin - 100) {
      pdf.addPage();
      currentY = margin;
    }

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('IDENTITY DOCUMENTS', margin, currentY);
    currentY += 12;

    // Document Front
    const documentFrontUrl = identityFiles.document_front || order.contract_document_url || null;
    if (documentFrontUrl) {
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Document Front:', margin, currentY);
      currentY += 10;

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
    if (documentBackUrl) {
      if (currentY > pageHeight - margin - 60) {
        pdf.addPage();
        currentY = margin;
      }

      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Document Back:', margin, currentY);
      currentY += 10;

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
    // 6. Signature Section (with selfie)
    // ============================================
    if (currentY > pageHeight - margin - 120) {
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

    // Load and add selfie image
    const selfieUrl = identityFiles.selfie_doc || order.contract_selfie_url || null;
    const selfieImage = await loadImage(selfieUrl);
    if (selfieImage && selfieImage.format !== 'PDF') {
      try {
        // Add image (max 60mm width, centered)
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
        console.error("[EDGE FUNCTION] Error adding selfie image to PDF:", imgError);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'italic');
        pdf.text('(Selfie image could not be loaded)', margin, currentY);
        currentY += 10;
      }
    } else if (selfieUrl) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'italic');
      pdf.text('(Selfie document - see storage)', margin, currentY);
      currentY += 10;
    }

    // Signature line
    pdf.setFontSize(14);
    pdf.text('⸻', pageWidth / 2, currentY, { align: 'center' });
    currentY += 12;

    // CONTRACTOR title
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
        // Check if we need a new page for the signature image
        if (currentY > pageHeight - margin - 30) {
          pdf.addPage();
          currentY = margin;
        }

        // Add signature image (max 45mm width, height proportional)
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
        currentY += maxHeight + 10;

        // Adiciona o nome do cliente abaixo da assinatura para maior validade
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.text(order.client_name, margin, currentY);
        currentY += 10;
      } catch (imgError) {
        console.error("[EDGE FUNCTION] Error adding signature image to PDF:", imgError);
        // Fall through to show name as fallback if image fails
        const nameStartX = margin + pdf.getTextWidth('Signature: ') + 5;
        pdf.setFont('helvetica', 'bold');
        pdf.text(order.client_name, nameStartX, currentY);

        // Draw line under name
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

      // Draw line under name
      const nameWidth = pdf.getTextWidth(order.client_name);
      const lineY = currentY + 2;
      pdf.setLineWidth(0.5);
      pdf.line(nameStartX, lineY, nameStartX + nameWidth, lineY);
      currentY += 15;
    }

    // ============================================
    // 7. Technical Information
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

    // Payment Status (only show if completed, not for pending Zelle payments)
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
    const fileName = `visa_contract_${normalizedName}_${order.order_number}_${dateStr}_${timestamp}.pdf`;
    const filePath = `visa-contracts/${fileName}`;

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
      .update({ contract_pdf_url: publicUrl })
      .eq('id', order_id);

    if (updateError) {
      console.error("[EDGE FUNCTION] Error updating order:", updateError);
      // Still return success since PDF was generated
    }

    console.log("[EDGE FUNCTION] Contract PDF generated successfully:", publicUrl);

    return new Response(
      JSON.stringify({
        success: true,
        pdf_url: publicUrl,
        file_path: filePath,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[EDGE FUNCTION] Error generating contract PDF:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});














