import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Attachment {
    filename: string;
    path: string;
    bucket: string;
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { to, subject, html, from, attachments } = await req.json();

        if (!to || !subject || !html) {
            return new Response(
                JSON.stringify({ error: "Missing required fields: to, subject, html" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const SMTP_HOST = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
        const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") || "587");
        const SMTP_USER = Deno.env.get("SMTP_USER") || "";
        const SMTP_PASS = Deno.env.get("SMTP_PASS") || "";
        const SMTP_FROM_EMAIL = from || Deno.env.get("SMTP_FROM_EMAIL") || SMTP_USER;
        const SMTP_FROM_NAME = Deno.env.get("SMTP_FROM_NAME") || "MIGMA";
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        if (!SMTP_USER || !SMTP_PASS) {
            return new Response(
                JSON.stringify({ error: "SMTP credentials not configured" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Process attachments
        const processedAttachments = [];
        if (attachments && Array.isArray(attachments)) {
            for (const att of attachments as Attachment[]) {
                console.log(`[EDGE FUNCTION] Downloading attachment: ${att.filename} from ${att.bucket}/${att.path}`);
                const { data, error } = await supabase.storage.from(att.bucket).download(att.path);

                if (error) {
                    console.error(`[EDGE FUNCTION] Error downloading ${att.filename}:`, error);
                    continue;
                }

                const arrayBuffer = await data.arrayBuffer();
                const bytes = new Uint8Array(arrayBuffer);

                // Safe conversion to Base64 avoiding stack size limits
                let binary = "";
                const len = bytes.byteLength;
                const chunkSize = 8192;
                for (let i = 0; i < len; i += chunkSize) {
                    const chunk = bytes.subarray(i, i + chunkSize);
                    binary += String.fromCharCode.apply(null, Array.from(chunk));
                }
                const base64 = btoa(binary);

                console.log(`[EDGE FUNCTION] Attachment ${att.filename} processed. Size: ${len} bytes`);

                processedAttachments.push({
                    filename: att.filename,
                    content: base64,
                    contentType: "application/pdf"
                });
            }
        }

        console.log(`[EDGE FUNCTION] Sending email to ${to} with ${processedAttachments.length} attachments`);

        // 2. Send email via SMTP
        const emailResult = await sendEmailViaSMTPDirect({
            host: SMTP_HOST,
            port: SMTP_PORT,
            user: SMTP_USER,
            pass: SMTP_PASS,
            from: `${SMTP_FROM_NAME} <${SMTP_FROM_EMAIL}>`,
            to: to,
            subject: subject,
            html: html,
            attachments: processedAttachments
        });

        if (!emailResult.success) {
            throw new Error(emailResult.error);
        }

        return new Response(
            JSON.stringify({ success: true, message: "Email sent successfully" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("[EDGE FUNCTION] Exception:", error);
        return new Response(
            JSON.stringify({ error: error.message || "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

async function sendEmailViaSMTPDirect(config: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
    to: string;
    subject: string;
    html: string;
    attachments: Array<{ filename: string; content: string; contentType: string }>;
}): Promise<{ success: boolean; error?: string }> {
    let conn: Deno.Conn | Deno.TlsConn | null = null;

    try {
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        if (config.port === 465) {
            conn = await Deno.connectTls({ hostname: config.host, port: config.port });
        } else {
            conn = await Deno.connect({ hostname: config.host, port: config.port });
        }

        const readResponse = async (): Promise<string> => {
            if (!conn) throw new Error("Connection closed");
            const buffer = new Uint8Array(4096);
            const bytesRead = await conn.read(buffer);
            if (bytesRead === null) throw new Error("Connection closed");
            return decoder.decode(buffer.subarray(0, bytesRead));
        };

        const sendCommand = async (command: string, logCommand = true): Promise<string> => {
            if (!conn) throw new Error("Connection closed");
            if (logCommand) {
                // Redact password from logs
                const displayCmd = command.startsWith("AUTH LOGIN") ? "AUTH LOGIN" :
                    (command.length > 50 && !command.includes("\r\n")) ? command.substring(0, 50) + "..." : command;
                console.log(`[SMTP Client] Sending: ${displayCmd}`);
            }
            await conn.write(encoder.encode(command + "\r\n"));
            const resp = await readResponse();
            console.log(`[SMTP Client] Received: ${resp.substring(0, 100).replace(/\r\n/g, "")}`);
            return resp;
        };

        let response = await readResponse();
        console.log(`[SMTP Client] Connection Greeting: ${response.replace(/\r\n/g, "")}`);
        if (!response.startsWith("220")) throw new Error(`Greeting failed: ${response}`);

        response = await sendCommand(`EHLO ${config.host}`);

        if (config.port === 587) {
            console.log("[SMTP Client] Initializing STARTTLS...");
            response = await sendCommand("STARTTLS");
            conn = await Deno.startTls(conn as Deno.Conn, { hostname: config.host });
            response = await sendCommand(`EHLO ${config.host}`);
        }

        console.log("[SMTP Client] Authenticating...");
        response = await sendCommand("AUTH LOGIN");
        response = await sendCommand(btoa(config.user), false); // Don't log encoded username
        response = await sendCommand(btoa(config.pass), false); // Don't log encoded password
        if (!response.startsWith("235")) throw new Error(`Auth failed: ${response}`);
        console.log("[SMTP Client] Authentication Successful");

        const fromEmail = config.from.match(/<(.+)>/)?.[1] || config.from;
        console.log(`[SMTP Client] Setting sender: ${fromEmail}`);
        await sendCommand(`MAIL FROM:<${fromEmail}>`);

        console.log(`[SMTP Client] Setting recipient: ${config.to}`);
        response = await sendCommand(`RCPT TO:<${config.to}>`);
        if (!response.startsWith("250")) throw new Error(`Recipient rejected: ${response}`);

        console.log("[SMTP Client] Sending DATA command...");
        await sendCommand("DATA");

        const boundary = `----=_NextPart_${Date.now()}`;
        const writeLine = async (line: string) => {
            if (!conn) throw new Error("Connection closed");
            await conn.write(encoder.encode(line + "\r\n"));
        };

        console.log(`[SMTP Client] Sending headers and body for ${config.attachments.length} attachments...`);

        await writeLine(`From: ${config.from}`);
        await writeLine(`To: ${config.to}`);
        await writeLine(`Subject: ${config.subject}`);
        await writeLine(`Date: ${new Date().toUTCString()}`);
        await writeLine(`Message-ID: <${Date.now()}.${Math.random().toString(36).substring(2)}@migma.inc>`);
        await writeLine(`MIME-Version: 1.0`);
        await writeLine(`Content-Type: multipart/mixed; boundary="${boundary}"`);
        await writeLine(``);

        // Body part
        await writeLine(`--${boundary}`);
        await writeLine(`Content-Type: text/html; charset=UTF-8`);
        await writeLine(`Content-Transfer-Encoding: 7bit`);
        await writeLine(``);
        await writeLine(config.html);
        await writeLine(``);

        // Attachments
        for (const att of config.attachments) {
            console.log(`[SMTP Client] Sending attachment: ${att.filename}`);
            await writeLine(`--${boundary}`);
            await writeLine(`Content-Type: ${att.contentType}; name="${att.filename}"`);
            await writeLine(`Content-Transfer-Encoding: base64`);
            await writeLine(`Content-Disposition: attachment; filename="${att.filename}"`);
            await writeLine(``);

            // Send base64 content in 76-char lines
            const lines = att.content.match(/.{1,76}/g) || [];
            for (const line of lines) {
                await writeLine(line);
            }
            await writeLine(``);
        }

        await writeLine(`--${boundary}--`);
        await writeLine(`.`);

        response = await readResponse();
        console.log(`[SMTP Client] Received after DATA completion: ${response.substring(0, 100).replace(/\r\n/g, "")}`);

        if (!response.startsWith("250")) {
            throw new Error(`Message delivery failed: ${response}`);
        }
        await sendCommand("QUIT");

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    } finally {
        if (conn) conn.close();
    }
}
