/// <reference lib="deno.ns" />
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
    console.log("Edge Function: Request received.");
    const { userId, locationName, photoData, contentType } = await req.json();
    if (!userId || !locationName || !photoData || !contentType) {
      console.error("Edge Function: Missing required fields in request body.");
      throw new Error('Missing required fields');
    }
    console.log("Edge Function: Request body parsed successfully.");

    const R2_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const R2_ACCESS_KEY = Deno.env.get('R2_ACCESS_KEY_ID');
    const R2_SECRET = Deno.env.get('R2_SECRET_ACCESS_KEY');
    const R2_BUCKET_NAME = Deno.env.get('R2_BUCKET_NAME');
    const R2_REGION = Deno.env.get('R2_REGION') || 'auto'; // Default to 'auto' if not set

    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY || !R2_SECRET || !R2_BUCKET_NAME) {
      console.error("Edge Function: Missing R2 environment variables.");
      throw new Error('R2 credentials (CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) not configured. Please set them in Supabase Edge Functions secrets.');
    }
    console.log("Edge Function: R2 credentials loaded from environment.");

    const bytes = new Uint8Array(photoData);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileExt = contentType.split('/')[1] || 'jpg';
    const filename = `uploads/${userId}/${timestamp}.${fileExt}`;
    console.log(`Edge Function: Uploading file to R2: ${filename} with Content-Type: ${contentType}`);

    const credentialsProvider = async () => {
      console.log("Edge Function: Custom credentialsProvider called.");
      return {
        accessKeyId: R2_ACCESS_KEY,
        secretAccessKey: R2_SECRET,
      };
    };

    console.log("Edge Function: Initializing S3Client...");
    const s3Client = new S3Client({
      region: R2_REGION,
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentialProvider: credentialsProvider,
      forcePathStyle: true,
      runtime: "deno", // Secara eksplisit memberi tahu SDK bahwa ini adalah lingkungan Deno
    });
    console.log("Edge Function: S3Client initialized.");

    const putCommand = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: filename,
      Body: bytes,
      ContentType: contentType,
      ACL: 'public-read',
    });
    console.log("Edge Function: PutObjectCommand created. Sending to R2...");

    await s3Client.send(putCommand);
    console.log("Edge Function: PutObjectCommand sent successfully to R2.");

    const r2PublicUrl = `https://pub-${R2_ACCOUNT_ID}.r2.dev/${filename}`;
    console.log(`Edge Function: R2 Public URL: ${r2PublicUrl}`);

    return new Response(
      JSON.stringify({ r2PublicUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error("Edge Function: Caught error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});