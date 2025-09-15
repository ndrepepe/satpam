import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { S3Client, PutObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3.830.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, locationId, contentType, fileBuffer } = await req.json();

    if (!userId || !locationId || !contentType || !fileBuffer) {
      return new Response(JSON.stringify({ error: 'Missing userId, locationId, contentType, or fileBuffer' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const DOMAINESIA_ACCESS_KEY = Deno.env.get('DOMAINESIA_ACCESS_KEY');
    const DOMAINESIA_SECRET_KEY = Deno.env.get('DOMAINESIA_SECRET_KEY');
    const DOMAINESIA_ENDPOINT = Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.storage.googleapis.com') || 'https://storage.googleapis.com'; // Fallback or adjust as needed

    // NOTE: For DomaiNesia, the endpoint might be different.
    // If your DomaiNesia endpoint is fixed, replace the line above with:
    // const DOMAINESIA_ENDPOINT = "https://your-domainesia-s3-endpoint.com"; 
    // For example: "https://s3.domainesia.com" or similar.
    // The current SUPABASE_URL replacement is a guess based on common S3-compatible setups.
    // Please verify the correct DomaiNesia S3 endpoint.

    const DOMAINESIA_BUCKET_NAME = Deno.env.get('R2_BUCKET_NAME'); // Assuming R2_BUCKET_NAME is used for DomaiNesia bucket

    if (!DOMAINESIA_ACCESS_KEY || !DOMAINESIA_SECRET_KEY || !DOMAINESIA_ENDPOINT || !DOMAINESIA_BUCKET_NAME) {
      return new Response(JSON.stringify({ error: 'DomaiNesia credentials or bucket name missing in Edge Function secrets.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const s3Client = new S3Client({
      region: 'us-east-1', // Region bisa generik untuk custom endpoint S3-compatible
      endpoint: DOMAINESIA_ENDPOINT,
      credentials: {
        accessKeyId: DOMAINESIA_ACCESS_KEY,
        secretAccessKey: DOMAINESIA_SECRET_KEY,
      },
      forcePathStyle: false,
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileExt = contentType.split('/')[1] || 'jpeg';
    const filePath = `${userId}/${locationId}-${timestamp}.${fileExt}`;

    const uploadCommand = new PutObjectCommand({
      Bucket: DOMAINESIA_BUCKET_NAME,
      Key: filePath,
      Body: new Uint8Array(fileBuffer), // fileBuffer is already ArrayBuffer from client
      ContentType: contentType,
      ACL: 'public-read',
    });

    await s3Client.send(uploadCommand);

    const publicUrl = `${DOMAINESIA_ENDPOINT}/${DOMAINESIA_BUCKET_NAME}/${filePath}`; // Construct public URL

    return new Response(JSON.stringify({ publicUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Edge Function upload-report-photo error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});