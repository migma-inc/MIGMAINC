// Supabase Edge Function to generate Invoice PDF
// Generates a professional invoice PDF including order data, client information, and services

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { jsPDF } from "npm:jspdf@^2.5.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BUCKET_NAME = 'contracts'; // Reusing contracts bucket

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Helper function to load image from URL
const loadImage = async (imageUrl: string | null, supabase: any): Promise<{ dataUrl: string; format: string } | null> => {
    if (!imageUrl) return null;

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
        console.error("[EDGE FUNCTION] Error loading image:", imageError);
        return null;
    }
};

Deno.serve(async (req) => {
    // Handle CORS
    if (req.method === "OPTIONS") {
        console.log("[EDGE FUNCTION] 🛡️ OPTIONS request received (Invoice)");
        return new Response("ok", {
            status: 200,
            headers: corsHeaders
        });
    }

    try {
        console.log("[EDGE FUNCTION] ========== REQUEST RECEIVED (Invoice) ==========");
        const { order_id } = await req.json();

        if (!order_id) {
            return new Response(
                JSON.stringify({ success: false, error: "order_id is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log("[EDGE FUNCTION] Generating invoice PDF for order:", order_id);

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

        // Create PDF
        const pdf = new jsPDF();
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 20;
        let currentY = 0;

        // ============================================
        // 1. Header (Black Bar with Gold Text/Logo)
        // ============================================
        pdf.setFillColor(18, 18, 18); // Dark Black
        pdf.rect(0, 0, pageWidth, 40, 'F');

        // Logo Image
        const logoUrl = "https://ekxftwrjvxtpnqbraszv.supabase.co/storage/v1/object/public/logo/logo2.png";
        const logoImage = await loadImage(logoUrl, supabase);

        if (logoImage) {
            // Adjust logo size to fit nicely in the header bar
            // We use height 25 to be vertically centered in the 40 height bar
            const logoWidth = 50;
            const logoHeight = 25;
            pdf.addImage(logoImage.dataUrl, logoImage.format, margin, 7.5, logoWidth, logoHeight);
        } else {
            // Fallback to text if logo fails to load
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(28);
            pdf.setTextColor(212, 175, 55); // Gold
            pdf.text('MIGMA INC', margin, 26);
        }

        // "INVOICE" title
        pdf.setFontSize(30);
        pdf.setTextColor(255, 255, 255); // White
        pdf.text('INVOICE', pageWidth - margin - 50, 26, { align: 'right' });

        currentY = 55;

        // ============================================
        // 2. Sender & Receiver Information
        // ============================================
        pdf.setTextColor(0, 0, 0); // Reset to Black

        // FROM: Section
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text('FROM:', margin, currentY);

        // BILL TO: Section
        pdf.text('BILL TO:', pageWidth / 2 + 10, currentY);

        currentY += 6;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);

        // Sender Details (MIGMA)
        const senderLines = [
            'MIGMA Inc',
            '17102 W Gatling Rd',
            'Marana, AZ 85653, United States',
            'Bank: Bank of America, N.A.',
            'Account Number: 4570 5365 8489',
            'Website: www.migmainc.com',
            'Email: adm@migmainc.com'
        ];

        // Client Details (Bill To)
        const billToLines = [
            order.client_name,
            order.client_email,
            order.client_whatsapp || '',
            order.client_country || '',
            order.client_nationality || ''
        ].filter(line => line !== '');

        let senderY = currentY;
        senderLines.forEach(line => {
            pdf.text(line, margin, senderY);
            senderY += 5;
        });

        let billToY = currentY;
        billToLines.forEach(line => {
            pdf.text(line, pageWidth / 2 + 10, billToY);
            billToY += 5;
        });

        currentY = Math.max(senderY, billToY) + 15;

        // ============================================
        // 3. Invoice Summary Table
        // ============================================
        pdf.setFillColor(248, 248, 248);
        pdf.rect(margin, currentY, pageWidth - margin * 2, 35, 'F');
        pdf.setDrawColor(230, 230, 230);
        pdf.rect(margin, currentY, pageWidth - margin * 2, 35, 'S');

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(100, 100, 100);

        const summaryX1 = margin + 5;
        const summaryX2 = margin + 60;

        pdf.text('Invoice Number', summaryX1, currentY + 8);
        pdf.text('Issue Date', summaryX1, currentY + 16);
        pdf.text('Due Date', summaryX1, currentY + 24);
        pdf.text('Payment Terms', summaryX1, currentY + 32);

        pdf.setTextColor(0, 0, 0);
        pdf.setFont('helvetica', 'bold');
        const issueDate = new Date(order.created_at).toLocaleDateString('en-US');

        pdf.text(order.order_number, summaryX2, currentY + 8);
        pdf.text(issueDate, summaryX2, currentY + 16);
        pdf.text(issueDate, summaryX2, currentY + 24);
        pdf.text('NET', summaryX2, currentY + 32);

        currentY += 50;

        // ============================================
        // 4. Services Table
        // ============================================
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Services', margin, currentY);
        currentY += 8;

        // Table Header
        pdf.setFillColor(18, 18, 18);
        pdf.rect(margin, currentY, pageWidth - margin * 2, 10, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(10);

        pdf.text('Description', margin + 5, currentY + 7);
        pdf.text('Qty', pageWidth - margin - 80, currentY + 7, { align: 'right' });
        pdf.text('Unit Price', pageWidth - margin - 40, currentY + 7, { align: 'right' });
        pdf.text('Total', pageWidth - margin - 5, currentY + 7, { align: 'right' });

        currentY += 10;
        pdf.setTextColor(0, 0, 0);
        pdf.setFont('helvetica', 'normal');

        // Item 1: Main Product
        const basePrice = parseFloat(order.base_price_usd || '0');
        pdf.text(product?.name || order.product_slug, margin + 5, currentY + 7);
        pdf.text('1', pageWidth - margin - 80, currentY + 7, { align: 'right' });
        pdf.text(`$${basePrice.toFixed(2)}`, pageWidth - margin - 40, currentY + 7, { align: 'right' });
        pdf.text(`$${basePrice.toFixed(2)}`, pageWidth - margin - 5, currentY + 7, { align: 'right' });

        currentY += 10;
        pdf.setDrawColor(240, 240, 240);
        pdf.line(margin, currentY, pageWidth - margin, currentY);

        // Item 2: Extra Units / Dependents if any
        if (order.extra_units > 0) {
            const extraUnitPrice = parseFloat(order.extra_unit_price_usd || '0');
            const extraTotal = order.extra_units * extraUnitPrice;
            pdf.text(order.extra_unit_label || 'Additional Services', margin + 5, currentY + 7);
            pdf.text(order.extra_units.toString(), pageWidth - margin - 80, currentY + 7, { align: 'right' });
            pdf.text(`$${extraUnitPrice.toFixed(2)}`, pageWidth - margin - 40, currentY + 7, { align: 'right' });
            pdf.text(`$${extraTotal.toFixed(2)}`, pageWidth - margin - 5, currentY + 7, { align: 'right' });
            currentY += 10;
            pdf.line(margin, currentY, pageWidth - margin, currentY);
        }

        currentY += 10;

        // ============================================
        // 5. Totals
        // ============================================
        const totalAmount = parseFloat(order.total_price_usd || '0');
        const subtotal = totalAmount; // For now assuming total is the sum

        pdf.setFont('helvetica', 'normal');
        pdf.text('Subtotal', pageWidth - margin - 40, currentY, { align: 'right' });
        pdf.setFont('helvetica', 'bold');
        pdf.text(`$${subtotal.toFixed(2)}`, pageWidth - margin - 5, currentY, { align: 'right' });

        currentY += 8;
        pdf.setFont('helvetica', 'normal');
        pdf.text('Taxes (0%)', pageWidth - margin - 40, currentY, { align: 'right' });
        pdf.setFont('helvetica', 'bold');
        pdf.text('$0.00', pageWidth - margin - 5, currentY, { align: 'right' });

        currentY += 10;
        pdf.setFillColor(248, 248, 248);
        pdf.rect(pageWidth - margin - 90, currentY - 5, 90, 12, 'F');
        pdf.setFontSize(12);
        pdf.text('Total Due', pageWidth - margin - 40, currentY + 3, { align: 'right' });
        pdf.text(`$${totalAmount.toFixed(2)}`, pageWidth - margin - 5, currentY + 3, { align: 'right' });

        currentY += 30;

        // ============================================
        // 6. Payment Instructions
        // ============================================
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Payment Instructions', margin, currentY);
        currentY += 8;

        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');

        let instructionLines = [];
        if (order.payment_method === 'manual') {
            instructionLines = [
                'Payment Method: MANUAL BY SELLER',
                'This payment has been handled and authorized directly through an official agent.',
                'No further action is required for payment confirmation.'
            ];
        } else {
            instructionLines = [
                'Bank: Bank of America, N.A.',
                'Account Name: MIGMA Inc',
                'Account Number: 4570 5365 8489',
                `Include the invoice number ${order.order_number} in the payment reference.`
            ];
        }

        instructionLines.forEach(line => {
            pdf.text(line, margin, currentY);
            currentY += 5;
        });

        // ============================================
        // 7. Output & Upload
        // ============================================
        const pdfBlob = pdf.output('blob');
        const pdfArrayBuffer = await pdfBlob.arrayBuffer();
        const pdfBuffer = new Uint8Array(pdfArrayBuffer);

        const fileName = `invoice_${order.order_number}_${Date.now()}.pdf`;
        const filePath = `invoices/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, pdfBuffer, {
                contentType: 'application/pdf',
                upsert: true,
            });

        if (uploadError) {
            throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath);

        // Temporarily save to payment_metadata if we can't add a column
        const updatedMetadata = {
            ...(order.payment_metadata || {}),
            invoice_pdf_url: publicUrl
        };

        await supabase
            .from('visa_orders')
            .update({ payment_metadata: updatedMetadata })
            .eq('id', order_id);

        console.log("[EDGE FUNCTION] Invoice PDF generated successfully:", publicUrl);

        return new Response(
            JSON.stringify({
                success: true,
                pdf_url: publicUrl,
                file_path: filePath,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("[EDGE FUNCTION] Error generating invoice PDF:", error);
        return new Response(
            JSON.stringify({ success: false, error: error.message || "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
