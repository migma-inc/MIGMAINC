// Supabase Edge Function to send emails via SMTP Google
// This function runs on the server, sending emails directly via SMTP

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const { to, subject, html, from } = await req.json();

    console.log("[EDGE FUNCTION] Sending email to:", to);

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, html" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Configuração SMTP do Google
    const SMTP_HOST = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
    const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const SMTP_USER = Deno.env.get("SMTP_USER") || "";
    const SMTP_PASS = Deno.env.get("SMTP_PASS") || ""; // Senha de app do Google
    const SMTP_FROM_EMAIL = from || Deno.env.get("SMTP_FROM_EMAIL") || SMTP_USER;
    const SMTP_FROM_NAME = Deno.env.get("SMTP_FROM_NAME") || "MIGMA";

    if (!SMTP_USER || !SMTP_PASS) {
      return new Response(
        JSON.stringify({ 
          error: "SMTP credentials not configured. Please set SMTP_USER and SMTP_PASS environment variables in Supabase Dashboard > Settings > Edge Functions > Secrets." 
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    console.log("[EDGE FUNCTION] Sending email via SMTP:", {
      from: SMTP_FROM_EMAIL,
      to: to,
      subject: subject,
      host: SMTP_HOST,
      port: SMTP_PORT,
    });

    // Enviar email via SMTP usando implementação direta (sem bibliotecas externas)
    const emailResult = await sendEmailViaSMTPDirect({
      host: SMTP_HOST,
      port: SMTP_PORT,
      user: SMTP_USER,
      pass: SMTP_PASS,
      from: `${SMTP_FROM_NAME} <${SMTP_FROM_EMAIL}>`,
      to: to,
      subject: subject,
      html: html,
    });

    if (!emailResult.success) {
      console.error("[EDGE FUNCTION] SMTP error:", emailResult.error);
      return new Response(
        JSON.stringify({ 
          error: emailResult.error || "Failed to send email via SMTP",
          hint: "Make sure SMTP credentials are correct and you're using a Google App Password (not your regular Gmail password)."
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    console.log("[EDGE FUNCTION] Email sent successfully via SMTP");

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("[EDGE FUNCTION] Exception:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});

/**
 * Implementação SMTP direta usando sockets TLS do Deno
 * Para porta 587: conexão não criptografada -> STARTTLS -> autenticação
 * Para porta 465: conexão TLS direta
 */
async function sendEmailViaSMTPDirect(config: {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean; error?: string }> {
  let conn: Deno.Conn | Deno.TlsConn | null = null;
  
  try {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    // Para porta 587, começar com conexão não criptografada
    // Para porta 465, usar TLS direto
    if (config.port === 465) {
      // Porta 465: TLS direto
      conn = await Deno.connectTls({
        hostname: config.host,
        port: config.port,
      });
    } else {
      // Porta 587: conexão não criptografada primeiro
      conn = await Deno.connect({
        hostname: config.host,
        port: config.port,
      });
    }

    // Helper para ler resposta SMTP
    const readResponse = async (): Promise<string> => {
      if (!conn) throw new Error("Connection closed");
      const buffer = new Uint8Array(4096);
      const bytesRead = await conn.read(buffer);
      if (bytesRead === null) throw new Error("Connection closed");
      return decoder.decode(buffer.subarray(0, bytesRead));
    };

    // Helper para enviar comando SMTP
    const sendCommand = async (command: string): Promise<string> => {
      if (!conn) throw new Error("Connection closed");
      await conn.write(encoder.encode(command + "\r\n"));
      return await readResponse();
    };

    // Ler resposta inicial do servidor
    let response = await readResponse();
    if (!response.startsWith("220")) {
      return { success: false, error: `SMTP greeting failed: ${response}` };
    }

    // EHLO
    response = await sendCommand(`EHLO ${config.host}`);
    if (!response.includes("250")) {
      return { success: false, error: `EHLO failed: ${response}` };
    }

    // STARTTLS (apenas para porta 587)
    if (config.port === 587) {
      response = await sendCommand("STARTTLS");
      if (!response.startsWith("220")) {
        return { success: false, error: `STARTTLS failed: ${response}` };
      }
      
      // Iniciar TLS na conexão existente
      // Para porta 587, conn deve ser TcpConn (não TLS ainda)
      try {
        conn = await Deno.startTls(conn as any, {
          hostname: config.host,
        });
      } catch (tlsError) {
        return { success: false, error: `TLS upgrade failed: ${tlsError instanceof Error ? tlsError.message : 'Unknown error'}` };
      }
      
      // Repetir EHLO após TLS
      response = await sendCommand(`EHLO ${config.host}`);
      if (!response.includes("250")) {
        return { success: false, error: `EHLO after TLS failed: ${response}` };
      }
    }

    // AUTH LOGIN
    response = await sendCommand("AUTH LOGIN");
    if (!response.startsWith("334")) {
      return { success: false, error: `AUTH LOGIN failed: ${response}` };
    }

    // Enviar usuário (base64)
    const userB64 = btoa(config.user);
    response = await sendCommand(userB64);
    if (!response.startsWith("334")) {
      return { success: false, error: `Username auth failed: ${response}` };
    }

    // Enviar senha (base64)
    const passB64 = btoa(config.pass);
    response = await sendCommand(passB64);
    if (!response.startsWith("235")) {
      return { success: false, error: `Password auth failed: ${response}. Make sure you're using a Google App Password (16 characters, no spaces), not your regular Gmail password.` };
    }

    // Extrair email do campo "from"
    const fromEmailMatch = config.from.match(/<(.+)>/);
    const fromEmail = fromEmailMatch ? fromEmailMatch[1] : config.from;

    // MAIL FROM
    response = await sendCommand(`MAIL FROM:<${fromEmail}>`);
    if (!response.startsWith("250")) {
      return { success: false, error: `MAIL FROM failed: ${response}` };
    }

    // RCPT TO
    response = await sendCommand(`RCPT TO:<${config.to}>`);
    if (!response.startsWith("250")) {
      return { success: false, error: `RCPT TO failed: ${response}` };
    }

    // DATA
    response = await sendCommand("DATA");
    if (!response.startsWith("354")) {
      return { success: false, error: `DATA failed: ${response}` };
    }

    // Construir mensagem completa
    const message = [
      `From: ${config.from}`,
      `To: ${config.to}`,
      `Subject: ${config.subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      ``,
      config.html,
      `.`,
    ].join("\r\n");

    // Enviar mensagem
    response = await sendCommand(message);
    if (!response.startsWith("250")) {
      return { success: false, error: `Message send failed: ${response}` };
    }

    // QUIT
    await sendCommand("QUIT");
    
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown SMTP error";
    console.error("[SMTP] Error details:", errorMessage);
    console.error("[SMTP] Error stack:", error instanceof Error ? error.stack : "No stack");
    
    // Mensagens de erro mais amigáveis
    if (errorMessage.includes("authentication") || errorMessage.includes("535")) {
      return { 
        success: false, 
        error: "SMTP authentication failed. Please verify your SMTP_USER and SMTP_PASS (must be a Google App Password, not your regular password)." 
      };
    }
    
    if (errorMessage.includes("connection") || errorMessage.includes("ECONNREFUSED") || errorMessage.includes("not connected")) {
      return { 
        success: false, 
        error: `SMTP connection failed. Could not connect to ${config.host}:${config.port}. Please check your SMTP settings.` 
      };
    }
    
    return { 
      success: false, 
      error: `SMTP error: ${errorMessage}` 
    };
  } finally {
    // Garantir que a conexão seja fechada
    if (conn) {
      try {
        conn.close();
      } catch (e) {
        // Ignorar erros ao fechar
      }
    }
  }
}
