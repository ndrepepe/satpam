// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { S3Bucket } from "https://deno.land/x/s3@0.5.0/mod.ts"; // Menggunakan S3Bucket yang benar

// Deklarasikan Deno global untuk memenuhi kompiler TypeScript sisi klien
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, locationName, photoData, contentType } = await req.json();
    if (!userId || !locationName || !photoData || !contentType) {
      throw new Error('Missing required fields');
    }

    const R2_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const R2_ACCESS_KEY = Deno.env.get('R2_ACCESS_KEY_ID');
    const R2_SECRET = Deno.env.get('R2_SECRET_ACCESS_KEY');
    const R2_BUCKET_NAME = Deno.env.get('R2_BUCKET_NAME');
    const R2_REGION = 'us-east-1'; // Menggunakan region placeholder

    // Pemeriksaan yang lebih spesifik untuk setiap secret
    if (!R2_ACCOUNT_ID) {
      throw new Error('Missing CLOUDFLARE_ACCOUNT_ID secret. Please set it in Supabase Edge Functions secrets.');
    }
    if (!R2_ACCESS_KEY) {
      throw new Error('Missing R2_ACCESS_KEY_ID secret. Please set it in Supabase Edge Functions secrets.');
    }
    if (!R2_SECRET) {
      throw new Error('Missing R2_SECRET_ACCESS_KEY secret. Please set it in Supabase Edge Functions secrets.');
    }
    if (!R2_BUCKET_NAME) {
      throw new Error('Missing R2_BUCKET_NAME secret. Please set it in Supabase Edge Functions secrets.');
    }

    const bytes = new Uint8Array(photoData);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileExt = contentType.split('/')[1] || 'jpg';
    const filename = `uploads/${userId}/${timestamp}.${fileExt}`;

    const r2Endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

    // --- Logging untuk debugging parameter S3Bucket ---
    console.log("DEBUG: S3Bucket Init Params:", {
      accessKeyId: R2_ACCESS_KEY, // Akan mencetak nilai, tapi kita sudah tahu panjangnya benar
      secretKeyLength: R2_SECRET.length, // Hanya mencetak panjang secret key
      region: R2_REGION,
      endpoint: r2Endpoint,
      bucket: R2_BUCKET_NAME,
      forcePathStyle: true,
    });
    // --- Akhir logging ---

    // Inisialisasi S3Bucket client dengan konfigurasi R2
    const bucket = new S3Bucket({
      accessKeyId: R2_ACCESS_KEY,
      secretKey: R2_SECRET,
      region: R2_REGION,
      endpoint: r2Endpoint,
      bucket: R2_BUCKET_NAME,
      forcePathStyle: true,
    });

    // Unggah objek ke R2
    await bucket.putObject(filename, bytes, {
      contentType: contentType,
    });

    // URL publik untuk objek yang diunggah
    const r2PublicUrl = `https://pub-${R2_ACCOUNT_ID}.r2.dev/${filename}`;

    return new Response(
      JSON.stringify({ r2PublicUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error("Edge Function error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});