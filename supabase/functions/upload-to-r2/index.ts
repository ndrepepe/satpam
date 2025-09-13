import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { S3Client, PutObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.621.0";

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
    const R2_REGION = Deno.env.get('R2_REGION') || 'auto';

    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY || !R2_SECRET || !R2_BUCKET_NAME) {
      throw new Error('R2 credentials (CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) not configured. Please set them in Supabase Edge Functions secrets.');
    }

    const bytes = new Uint8Array(photoData);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileExt = contentType.split('/')[1] || 'jpg';
    const filename = `uploads/${userId}/${timestamp}.${fileExt}`;

    // Konfigurasi S3Client untuk Cloudflare R2
    const s3Client = new S3Client({
      region: R2_REGION,
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY,
        secretAccessKey: R2_SECRET,
      },
      // Override default credential provider chain to prevent file system access
      credentialDefaultProvider: () => Promise.resolve({
        accessKeyId: R2_ACCESS_KEY,
        secretAccessKey: R2_SECRET,
      }),
      // Force path style for R2 bucket URLs
      forcePathStyle: true,
    });

    // Buat perintah PutObjectCommand
    const putCommand = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: filename,
      Body: bytes,
      ContentType: contentType,
      ACL: 'public-read',
    });

    // Kirim perintah ke R2 menggunakan SDK
    await s3Client.send(putCommand);

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