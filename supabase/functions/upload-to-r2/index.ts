import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.616.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { supabasePhotoUrl, userId, locationName, supabaseFilePath } = await req.json();

    console.log("Edge Function: Received request to upload-to-r2");
    console.log("Edge Function: supabasePhotoUrl:", supabasePhotoUrl);
    console.log("Edge Function: userId:", userId);
    console.log("Edge Function: locationName:", locationName);
    console.log("Edge Function: supabaseFilePath:", supabaseFilePath);

    const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID');
    const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY');
    const R2_BUCKET_NAME = 'satpam'; // Hardcoded bucket name as per user's request
    const R2_PUBLIC_URL_BASE = `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}`;

    console.log("Edge Function: CLOUDFLARE_ACCOUNT_ID:", CLOUDFLARE_ACCOUNT_ID ? 'Set' : 'Not Set');
    console.log("Edge Function: R2_ACCESS_KEY_ID:", R2_ACCESS_KEY_ID ? 'Set' : 'Not Set');
    console.log("Edge Function: R2_SECRET_ACCESS_KEY:", R2_SECRET_ACCESS_KEY ? 'Set' : 'Not Set');
    console.log("Edge Function: R2_BUCKET_NAME:", R2_BUCKET_NAME);

    if (!CLOUDFLARE_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      console.error("Edge Function Error: Cloudflare R2 credentials are not set as environment variables.");
      return new Response(JSON.stringify({ error: 'Cloudflare R2 credentials are not set as environment variables.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // 1. Download photo from Supabase Storage
    console.log("Edge Function: Attempting to download photo from Supabase Storage...");
    const response = await fetch(supabasePhotoUrl);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Edge Function Error: Failed to download photo from Supabase Storage: ${response.statusText}. Response body: ${errorText}`);
      throw new Error(`Failed to download photo from Supabase Storage: ${response.statusText}`);
    }
    const photoBlob = await response.blob();
    const photoArrayBuffer = await photoBlob.arrayBuffer();
    const photoBuffer = new Uint8Array(photoArrayBuffer);
    console.log("Edge Function: Photo downloaded successfully. Blob type:", photoBlob.type, "Size:", photoBlob.size);

    // 2. Upload photo to Cloudflare R2
    console.log("Edge Function: Initializing S3Client for R2 upload...");
    const s3Client = new S3Client({
      region: 'us-east-1', // Specific region for Cloudflare R2
      endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { // Provide credentials directly
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
      sdkStreamMixin: false,
    });
    console.log("Edge Function: S3Client initialized.");

    const timestamp = new Date().toISOString().replace(/[:.-]/g, ''); // Format timestamp for filename
    const fileExtension = supabasePhotoUrl.split('.').pop();
    const r2Key = `${userId}/${locationName.replace(/\s/g, '_')}_${timestamp}.${fileExtension}`; // [UserID]/[NamaLokasi]_[Timestamp].jpg

    const uploadParams = {
      Bucket: R2_BUCKET_NAME,
      Key: r2Key,
      Body: photoBuffer,
      ContentType: photoBlob.type,
    };
    console.log("Edge Function: R2 upload parameters:", uploadParams);

    try {
      const uploadResult = await s3Client.send(new PutObjectCommand(uploadParams));
      console.log("Edge Function: Photo uploaded to R2 successfully. Result:", uploadResult);
    } catch (r2UploadError: any) {
      console.error("Edge Function Error: Failed to upload photo to R2:", r2UploadError);
      throw new Error(`Failed to upload photo to R2: ${r2UploadError.message}`);
    }

    const r2PublicUrl = `${R2_PUBLIC_URL_BASE}/${r2Key}`;
    console.log("Edge Function: R2 Public URL:", r2PublicUrl);

    // 3. Delete photo from Supabase Storage (using service role key for admin access)
    console.log("Edge Function: Initializing Supabase Admin client for storage deletion...");
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    console.log("Edge Function: Attempting to delete photo from Supabase Storage:", supabaseFilePath);
    const { error: deleteError } = await supabaseAdmin.storage
      .from('check-area-photos')
      .remove([supabaseFilePath]);

    if (deleteError) {
      console.warn("Edge Function Warning: Failed to delete photo from Supabase Storage:", deleteError.message);
      // Do not throw error here, as R2 upload was successful
    } else {
      console.log("Edge Function: Photo deleted from Supabase Storage successfully.");
    }

    return new Response(JSON.stringify({ r2Url: r2PublicUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error("Edge Function Critical Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});