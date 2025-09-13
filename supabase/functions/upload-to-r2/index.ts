// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { S3 } from "https://deno.land/x/s3@0.5.0/mod.ts"; // Menggunakan Deno-native S3 client

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
    const R2_REGION = Deno.env.get('R2_REGION') || 'auto'; // R2 sering menggunakan 'auto' atau placeholder

    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY || !R2_SECRET || !R2_BUCKET_NAME) {
      throw new Error('R2 credentials (CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) not configured. Please set them in Supabase Edge Functions secrets.');
    }

    const bytes = new Uint8Array(photoData);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileExt = contentType.split('/')[1] || 'jpg';
    const filename = `uploads/${userId}/${timestamp}.${fileExt}`;

    // Inisialisasi S3 client dengan konfigurasi R2
    const s3 = new S3({
      accessKeyId: R2_ACCESS_KEY,
      secretKey: R2_SECRET,
      region: R2_REGION,
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      bucket: R2_BUCKET_NAME, // Set bucket name here
    });

    // Unggah objek ke R2
    await s3.putObject(filename, bytes, {
      contentType: contentType,
      // R2 specific: ACL is usually handled by bucket policies or public access settings
      // For public-read, we might need to set it in R2 bucket settings or ensure the endpoint is pub-
      // The deno-s3 library might not directly support 'ACL' in putObject options,
      // so we rely on R2 bucket settings for public access.
      // If public access is needed, ensure your R2 bucket has a public access policy.
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