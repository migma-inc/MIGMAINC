// Supabase Edge Function to upload CV files
// This runs on the server using service_role, so it's safe and doesn't require authentication

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BUCKET_NAME = 'cv-files';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

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
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return new Response(
        JSON.stringify({ success: false, error: "No file provided" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Validate file type
    if (file.type !== "application/pdf") {
      return new Response(
        JSON.stringify({ success: false, error: "Only PDF files are allowed" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ success: false, error: "File size must be less than 5MB" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Normalize file name to remove accents, special characters, and spaces
    const normalizeFileName = (name: string): string => {
      // Get file extension
      const lastDot = name.lastIndexOf('.');
      const extension = lastDot > 0 ? name.substring(lastDot) : '.pdf';
      const nameWithoutExt = lastDot > 0 ? name.substring(0, lastDot) : name;
      
      // Remove accents and normalize
      const normalized = nameWithoutExt
        .normalize('NFD') // Decompose characters (é -> e + ´)
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .toLowerCase() // Convert to lowercase
        .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphen
        .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
        .substring(0, 100); // Limit length
      
      return `${normalized}${extension}`;
    };

    // Generate unique file name
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const normalizedOriginalName = normalizeFileName(file.name);
    const fileName = `${timestamp}-${randomString}-${normalizedOriginalName}`;
    const filePath = `applications/${fileName}`;

    console.log("[EDGE FUNCTION] Uploading CV:", {
      fileName: file.name,
      fileSize: file.size,
      filePath,
    });

    // Create Supabase client with service_role key (safe on server)
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Upload file - service_role bypasses RLS
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: "application/pdf",
      });

    if (error) {
      console.error("[EDGE FUNCTION] Upload error:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message || "Failed to upload file",
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

    console.log("[EDGE FUNCTION] CV uploaded successfully:", data.path);

    return new Response(
      JSON.stringify({
        success: true,
        filePath: data.path,
        fileName: file.name,
      }),
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
      JSON.stringify({
        success: false,
        error: error.message || "Internal server error",
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
});

