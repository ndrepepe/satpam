import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { S3Client, PutObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3.621.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, locationName, photoData, photoId, contentType } = await req.json();

    if (!userId || !locationName || !photoData || !photoId || !contentType) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID');
    const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY');
    const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');

    if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !CLOUDFLARE_ACCOUNT_ID) {
      console.error("Missing R2 credentials or Cloudflare Account ID");
      return new Response(JSON.stringify({ error: 'Missing R2 credentials or Cloudflare Account ID' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const bucketName = 'satpam'; // Your R2 bucket name
    const timestamp = new Date().toISOString().replace(/[:.-]/g, '');
    const r2TargetKey = `${userId}/${locationName.replace(/\s/g, '_')}_${timestamp}.${photoId.split('.').pop() || 'jpg'}`;

    console.log(`Uploading to R2 with key: ${r2TargetKey}`);

    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });

    // Convert ArrayBuffer to Uint8Array
    const photoBytes = new Uint8Array(photoData);

    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: r2TargetKey,
      Body: photoBytes,
      ContentType: contentType,
    });

    const r2UploadResponse = await s3Client.send(putCommand);
    console.log("R2 upload response:", r2UploadResponse);

    if (r2UploadResponse.$metadata.httpStatusCode !== 200) {
      throw new Error(`Failed to upload photo to R2. Status: ${r2UploadResponse.$metadata.httpStatusCode}`);
    }

    const r2PublicUrl = `https://pub-${CLOUDFLARE_ACCOUNT_ID}.r2.dev/${bucketName}/${r2TargetKey}`;
    console.log(`R2 Public URL: ${r2PublicUrl}`);

    return new Response(JSON.stringify({ r2PublicUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Edge Function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});