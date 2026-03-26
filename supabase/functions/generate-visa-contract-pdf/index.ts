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
    const { order_id, is_upsell, product_slug_override } = await req.json();

    if (!order_id) {
      return new Response(
        JSON.stringify({ success: false, error: "order_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[EDGE FUNCTION] Generating visa contract PDF for order:", order_id);
    if (is_upsell) {
      console.log("[EDGE FUNCTION] 🎁 This is an UPSELL contract for product:", product_slug_override);
    }

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

    // Fetch product data (use override for upsell)
    const productSlugToUse = is_upsell && product_slug_override ? product_slug_override : order.product_slug;
    console.log("[EDGE FUNCTION] Fetching product with slug:", productSlugToUse);

    const { data: product, error: productError } = await supabase
      .from('visa_products')
      .select('*')
      .eq('slug', productSlugToUse)
      .single();

    if (productError) {
      console.error("[EDGE FUNCTION] Error fetching product:", productError);
    }

    // Check if it's a Scholarship or I-20 Control product (No contract needed, only Annex)
    const isAnnexOnlyProduct = productSlugToUse?.endsWith('-scholarship') || productSlugToUse?.endsWith('-i20-control');
    if (isAnnexOnlyProduct && !is_upsell) {
      console.log(`[EDGE FUNCTION] ℹ️ Product ${productSlugToUse} identified as ANNEX-ONLY. Skipping contract generation.`);
      
      const clearField = 'contract_pdf_url';
      await supabase
        .from('visa_orders')
        .update({ [clearField]: null })
        .eq('id', order_id);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Scholarship/I-20 products do not require a main contract. Skipping PDF generation.",
          skipped: true
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch contract template for this product
    let contractTemplate: { content: string } | null = null;

    // Priority 1: Specific template ID from order (SKIP IF UPSELL)
    if (order.contract_template_id && !is_upsell) {
      const { data: template, error: templateError } = await supabase
        .from('contract_templates')
        .select('content')
        .eq('id', order.contract_template_id)
        .single();

      if (!templateError && template) {
        contractTemplate = template;
        console.log("[EDGE FUNCTION] Contract template found by ID:", order.contract_template_id);
      }
    }

    // Priority 2: Fallback to template by product slug with Inheritance
    if (!contractTemplate && productSlugToUse) {
      // First attempt: Try exact match
      let { data: template, error: templateError } = await supabase
        .from('contract_templates')
        .select('content')
        .eq('template_type', 'visa_service')
        .eq('product_slug', productSlugToUse)
        .eq('is_active', true)
        .single();

      // Second attempt: Inheritance logic (fallback to parent service template)
      if (!template && (productSlugToUse.includes('initial-') || productSlugToUse.includes('cos-') || productSlugToUse.includes('transfer-'))) {
        console.log("[EDGE FUNCTION] 🔄 No direct template found. Attempting inheritance fallback...");
        let parentSlug = null;

        if (productSlugToUse.startsWith('initial-')) parentSlug = 'initial-selection-process';
        else if (productSlugToUse.startsWith('cos-')) parentSlug = 'cos-selection-process';
        else if (productSlugToUse.startsWith('transfer-')) parentSlug = 'transfer-selection-process';

        if (parentSlug && parentSlug !== productSlugToUse) {
          console.log(`[EDGE FUNCTION] define parent slug as: ${parentSlug}`);
          const { data: parentTemplate, error: parentError } = await supabase
            .from('contract_templates')
            .select('content')
            .eq('template_type', 'visa_service')
            .eq('product_slug', parentSlug)
            .eq('is_active', true)
            .single();

          if (parentTemplate && !parentError) {
            template = parentTemplate;
            console.log("[EDGE FUNCTION] ✅ Found parent template via inheritance.");
          }
        }
      }

      const templateErrorFinal = template ? null : templateError;

      if (!templateErrorFinal && template) {
        contractTemplate = template;
        console.log("[EDGE FUNCTION] Contract template found by product slug (or inheritance):", productSlugToUse);
      } else {
        console.log("[EDGE FUNCTION] No contract template found for product slug (even after inheritance):", productSlugToUse);
      }
    }

    // Check if contract template exists. If not, do not generate contract.
    if (!contractTemplate) {
      console.log("[EDGE FUNCTION] ⚠️ No contract template found for this product. Skipping contract generation.");

      // Safety: Clear any existing contract URL if generation was skipped/not needed
      const clearField = is_upsell ? 'upsell_contract_pdf_url' : 'contract_pdf_url';
      await supabase
        .from('visa_orders')
        .update({ [clearField]: null })
        .eq('id', order_id);

      return new Response(
        JSON.stringify({
          success: true,
          message: "No contract template found for this product, skipping PDF generation.",
          skipped: true
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
    const loadImage = async (imageUrl: string | null): Promise<{ data: Uint8Array; format: string } | null> => {
      if (!imageUrl) {
        return null;
      }

      try {
        console.log("[EDGE FUNCTION] Loading image from path/url:", imageUrl);

        let bucket: string | null = null;
        let path: string | null = null;

        // Extract bucket and path
        if (imageUrl.startsWith('visa-documents/')) {
          bucket = 'visa-documents';
          path = imageUrl.replace('visa-documents/', '');
        } else if (imageUrl.startsWith('visa-signatures/')) {
          bucket = 'visa-signatures';
          path = imageUrl.replace('visa-signatures/', '');
        } else if (imageUrl.includes('/storage/v1/object/')) {
          const match = imageUrl.match(/\/storage\/v1\/object\/(?:public|authenticated|sign)\/([^/]+)\/(.+)$/);
          if (match) {
            bucket = match[1];
            path = decodeURIComponent(match[2]);
          }
        } else if (!imageUrl.startsWith('http')) {
          // Fallback guess based on content
          bucket = imageUrl.includes('sig') ? 'visa-signatures' : 'visa-documents';
          path = imageUrl;
        }

        if (!bucket || !path) {
          console.warn("[EDGE FUNCTION] Could not determine bucket/path for:", imageUrl);
          // If it's a full external URL, try to fetch it directly
          if (imageUrl.startsWith('http')) {
            const resp = await fetch(imageUrl);
            if (!resp.ok) return null;
            const blob = await resp.blob();
            const buffer = await blob.arrayBuffer();
            return { data: new Uint8Array(buffer), format: blob.type.includes('png') ? 'PNG' : 'JPEG' };
          }
          return null;
        }

        console.log(`[EDGE FUNCTION] Downloading from storage: ${bucket}/${path}`);
        const { data, error } = await supabase.storage.from(bucket).download(path);

        if (error || !data) {
          console.error(`[EDGE FUNCTION] Error downloading ${bucket}/${path}:`, error);
          return null;
        }

        const imageArrayBuffer = await data.arrayBuffer();
        const mimeType = data.type;
        const imageFormat = mimeType.includes('png') ? 'PNG' : 'JPEG';
        const bytes = new Uint8Array(imageArrayBuffer);

        return { data: bytes, format: imageFormat };
      } catch (imageError) {
        console.error("[EDGE FUNCTION] Could not load image:", imageError);
        return null;
      }
    };

    // Helper function to load signature image
    const loadSignatureImage = async (): Promise<{ data: Uint8Array; format: string } | null> => {
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

    // Amount and Currency logic
    let displayAmount = 0;
    let currencySymbol = 'US$';

    const isParcelow = order.payment_method === 'parcelow';
    const metadata = order.payment_metadata || {};

    // Total USD reference (including fees if Parcelow)
    const totalUsdPaid = isParcelow
      ? parseFloat(String(metadata.total_usd || order.total_price_usd))
      : parseFloat(order.total_price_usd);

    const upsellUsd = parseFloat(order.upsell_price_usd || '0');

    // Calculate effective exchange rate if Parcelow
    let exchangeRate = 1;
    if (isParcelow) {
      const totalBrl = parseFloat(String(metadata.total_brl || metadata.base_brl || 0));
      if (totalBrl > 0 && totalUsdPaid > 0) {
        exchangeRate = totalBrl / totalUsdPaid;
        currencySymbol = 'R$';
      }
    }

    if (is_upsell && order.upsell_price_usd) {
      // Upsell contract amount
      displayAmount = isParcelow ? (upsellUsd * exchangeRate) : upsellUsd;
    } else {
      // Main contract amount (Total Paid - Upsell)
      const mainAmountUsd = totalUsdPaid - upsellUsd;
      displayAmount = isParcelow ? (mainAmountUsd * exchangeRate) : mainAmountUsd;
    }

    // Safety fallback for Parcelow to match metadata exactly if no upsell exists
    if (isParcelow && !is_upsell && !order.upsell_price_usd && metadata.total_brl) {
      displayAmount = parseFloat(String(metadata.total_brl));
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

        currentY += 8;
      }

      currentY += 10;
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
    let termsContent = convertHtmlToText(contractTemplate.content);
    console.log("[EDGE FUNCTION] Using contract template from database");

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
      if (docFrontImage) {
        try {
          const maxWidth = 80;
          const maxHeight = 50;
          pdf.addImage(
            docFrontImage.data,
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
      if (docBackImage) {
        try {
          const maxWidth = 80;
          const maxHeight = 50;
          pdf.addImage(
            docBackImage.data,
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
    if (selfieImage) {
      try {
        const maxWidth = 60;
        const maxHeight = 60;
        pdf.addImage(
          selfieImage.data,
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
          signatureImage.data,
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
    // Dynamic file name
    const timestamp = Date.now();
    const safeName = order.client_name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '_');
    const fileName = `visa_contract_${safeName}_${order.order_number}_${new Date().toISOString().split('T')[0]}_${timestamp}.pdf`;
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

    // Update order (use correct field for upsell)
    const updateField = is_upsell ? 'upsell_contract_pdf_url' : 'contract_pdf_url';
    console.log(`[EDGE FUNCTION] Updating ${updateField} with:`, publicUrl);

    const { error: updateError } = await supabase
      .from('visa_orders')
      .update({ [updateField]: publicUrl })
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

  } catch (error: any) {
    console.error("[EDGE FUNCTION] Error generating contract PDF:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});














