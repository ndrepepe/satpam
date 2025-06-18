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

    if (!supabasePhotoUrl || !userId || !locationName || !supabaseFilePath) {
      return new Response(JSON.stringify({ error: 'Missing required parameters: supabasePhotoUrl, userId, locationName, or supabaseFilePath' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID');
    const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY');
    const R2_BUCKET_NAME = 'satpam'; // Hardcoded bucket name as per user's request
    const R2_PUBLIC_URL_BASE = `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}`;

    if (!CLOUDFLARE_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      return new Response(JSON.stringify({ error: 'Cloudflare R2 credentials are not set as environment variables.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // 1. Download photo from Supabase Storage
    const response = await fetch(supabasePhotoUrl);
    if (!response.ok) {
      throw new Error(`Failed to download photo from Supabase Storage: ${response.statusText}`);
    }
    const photoBlob = await response.blob();
    const photoArrayBuffer = await photoBlob.arrayBuffer();
    const photoBuffer = new Uint8Array(photoArrayBuffer);

    // 2. Upload photo to Cloudflare R2
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    const timestamp = new Date().toISOString().replace(/[:.-]/g, ''); // Format timestamp for filename
    const fileExtension = supabasePhotoUrl.split('.').pop();
    const r2Key = `${userId}/${locationName.replace(/\s/g, '_')}_${timestamp}.${fileExtension}`; // [UserID]/[NamaLokasi]_[Timestamp].jpg

    const uploadParams = {
      Bucket: R2_BUCKET_NAME,
      Key: r2Key,
      Body: photoBuffer,
      ContentType: photoBlob.type,
    };

    await s3Client.send(new PutObjectCommand(uploadParams));

    const r2PublicUrl = `${R2_PUBLIC_URL_BASE}/${r2Key}`;

    // 3. Delete photo from Supabase Storage (using service role key for admin access)
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

    const { error: deleteError } = await supabaseAdmin.storage
      .from('check-area-photos')
      .remove([supabaseFilePath]);

    if (deleteError) {
      console.warn("Warning: Failed to delete photo from Supabase Storage:", deleteError.message);
      // Do not throw error here, as R2 upload was successful
    }

    return new Response(JSON.stringify({ r2Url: r2PublicUrl }), {
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