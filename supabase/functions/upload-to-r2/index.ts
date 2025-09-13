// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { S3Bucket } from "https://deno.land/x/s3@0.5.0/mod.ts";

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

    // Menggunakan variabel lingkungan yang sama, tetapi nilainya akan dari Filebase
    const FILEBASE_ACCESS_KEY = Deno.env.get('R2_ACCESS_KEY_ID'); // Akan diisi dengan KEY dari Filebase
    const FILEBASE_SECRET = Deno.env.get('R2_SECRET_ACCESS_KEY'); // Akan diisi dengan SECRET dari Filebase
    const FILEBASE_BUCKET_NAME = Deno.env.get('R2_BUCKET_NAME'); // Akan diisi dengan nama bucket dari Filebase
    const FILEBASE_ENDPOINT = 'https://s3.filebase.com'; // Endpoint S3 Filebase
    const FILEBASE_REGION = 'us-east-1'; // Region umum, seringkali tidak terlalu penting untuk Filebase

    // Pemeriksaan untuk secrets Filebase
    if (!FILEBASE_ACCESS_KEY) {
      throw new Error('Missing R2_ACCESS_KEY_ID secret. Please set it in Supabase Edge Functions secrets (using Filebase key).');
    }
    if (!FILEBASE_SECRET) {
      throw new Error('Missing R2_SECRET_ACCESS_KEY secret. Please set it in Supabase Edge Functions secrets (using Filebase secret).');
    }
    if (!FILEBASE_BUCKET_NAME) {
      throw new Error('Missing R2_BUCKET_NAME secret. Please set it in Supabase Edge Functions secrets (using Filebase bucket name).');
    }

    const bytes = new Uint8Array(photoData);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileExt = contentType.split('/')[1] || 'jpg';
    const filename = `uploads/${userId}/${timestamp}.${fileExt}`;

    // Inisialisasi S3Bucket client dengan konfigurasi Filebase
    const bucket = new S3Bucket({
      accessKeyId: FILEBASE_ACCESS_KEY,
      secretKey: FILEBASE_SECRET,
      region: FILEBASE_REGION,
      endpoint: FILEBASE_ENDPOINT,
      bucket: FILEBASE_BUCKET_NAME,
      forcePathStyle: true,
    });

    // Unggah objek ke Filebase S3
    await bucket.putObject(filename, bytes, {
      contentType: contentType,
    });

    // URL publik untuk objek yang diunggah di Filebase
    const filebasePublicUrl = `https://${FILEBASE_BUCKET_NAME}.s3.filebase.com/${filename}`;

    return new Response(
      JSON.stringify({ r2PublicUrl: filebasePublicUrl }), // Menggunakan nama variabel yang sama untuk kompatibilitas klien
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