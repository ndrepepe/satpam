import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { signAwsV4 } from "https://deno.land/x/aws_s3_presign@v0.2.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Edge Function: Received request.");
    const { userId, locationName, supabasePhotoUrl, photoId } = await req.json();

    if (!userId || !locationName || !supabasePhotoUrl || !photoId) {
      return new Response(JSON.stringify({ error: 'Missing userId, locationName, supabasePhotoUrl, or photoId' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID');
    const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY');
    const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');

    if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !CLOUDFLARE_ACCOUNT_ID) {
      console.error("Edge Function: Missing R2 credentials or Cloudflare Account ID.");
      return new Response(JSON.stringify({ error: 'Missing R2 credentials or Cloudflare Account ID' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }
    console.log("Edge Function: R2 credentials found.");
    console.log(`Edge Function: Received request for userId: ${userId} locationName: ${locationName}`);

    // 1. Download photo from Supabase Storage
    console.log(`Edge Function: Attempting to download photo from Supabase URL: ${supabasePhotoUrl}`);
    const photoResponse = await fetch(supabasePhotoUrl);
    if (!photoResponse.ok) {
      throw new Error(`Failed to download photo from Supabase Storage: ${photoResponse.statusText}`);
    }
    const photoBuffer = await photoResponse.arrayBuffer();
    console.log(`Edge Function: Photo downloaded successfully. Size: ${photoBuffer.byteLength} bytes.`);

    // 2. Upload to Cloudflare R2
    const bucketName = 'satpam'; // Your R2 bucket name
    const timestamp = new Date().toISOString().replace(/[:.-]/g, '');
    const r2TargetKey = `${userId}/${locationName.replace(/\s/g, '_')}_${timestamp}.jpeg`; // Ensure valid key name
    const r2UploadUrl = `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucketName}/${r2TargetKey}`;
    const contentType = 'image/jpeg'; // Assuming JPEG, adjust if needed

    console.log(`Edge Function: R2 Target Key: ${r2TargetKey}`);
    console.log(`Edge Function: R2 Upload URL: ${r2UploadUrl}`);

    console.log("Edge Function: Before signAwsV4 call.");
    const signedHeaders = await signAwsV4({
      url: r2UploadUrl,
      method: 'PUT',
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
      region: 'auto', // R2 uses 'auto' or a specific region if you set it up
      service: 's3',
      body: photoBuffer,
      headers: {
        'Content-Type': contentType,
      },
    });
    console.log("Edge Function: After signAwsV4 call. Signed Headers:", JSON.stringify(signedHeaders));

    console.log("Edge Function: Before R2 fetch call.");
    // Create the Request object to log its details
    const request = new Request(r2UploadUrl, {
      method: 'PUT',
      headers: signedHeaders,
      body: photoBuffer,
    });
    console.log("Edge Function: R2 Request URL:", request.url);
    console.log("Edge Function: R2 Request Method:", request.method);
    console.log("Edge Function: R2 Request Headers:", JSON.stringify(Object.fromEntries(request.headers.entries())));
    // Note: Logging request.body directly is not feasible as it's a stream and can only be read once.

    const response = await fetch(request);
    console.log("Edge Function: After R2 fetch call. Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Edge Function: R2 Upload failed with status ${response.status}: ${errorText}`);
      throw new Error(`Failed to upload photo to R2: ${response.status} - ${errorText}`);
    }
    console.log("Edge Function: Photo uploaded to R2 successfully.");

    // 3. Delete photo from Supabase Storage
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Use service role key for admin operations
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { error: deleteError } = await supabaseClient.storage
      .from('check-area-photos')
      .remove([`${userId}/${photoId}`]); // Use the original photoId (filename)

    if (deleteError) {
      console.error("Edge Function: Error deleting photo from Supabase Storage:", deleteError);
      // Don't throw error here, as R2 upload was successful. Just log.
    } else {
      console.log("Edge Function: Photo deleted from Supabase Storage successfully.");
    }

    // 4. Return R2 public URL
    const r2PublicUrl = `https://pub-${CLOUDFLARE_ACCOUNT_ID}.r2.dev/${bucketName}/${r2TargetKey}`; // Public URL format
    console.log(`Edge Function: R2 Public URL: ${r2PublicUrl}`);

    return new Response(JSON.stringify({ r2PublicUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Edge Function: Caught error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});