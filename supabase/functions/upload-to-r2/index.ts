import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fungsi untuk membuat signature v4 (disederhanakan untuk R2)
async function createSignature(secretKey: string, date: string, region: string, service: string, stringToSign: string) {
  const encoder = new TextEncoder();
  const keyDate = await hmacSha256(encoder.encode("AWS4" + secretKey), date);
  const keyRegion = await hmacSha256(keyDate, encoder.encode(region));
  const keyService = await hmacSha256(keyRegion, encoder.encode(service));
  const signingKey = await hmacSha256(keyService, encoder.encode("aws4_request"));
  return await hmacSha256(signingKey, encoder.encode(stringToSign));
}

async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, data));
}

serve(async (req) => {
  console.log("R2 Upload Function Called");
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validasi content type
    const contentTypeHeader = req.headers.get('content-type');
    if (!contentTypeHeader || !contentTypeHeader.includes('application/json')) {
      throw new Error('Content-Type must be application/json');
    }

    const body = await req.json();
    console.log("Received body keys:", Object.keys(body));

    // Validasi required fields
    const { userId, locationName, photoData, contentType } = body;
    
    if (!userId) throw new Error('userId is required');
    if (!locationName) throw new Error('locationName is required');
    if (!photoData) throw new Error('photoData is required');
    if (!contentType) throw new Error('contentType is required');

    console.log("Validated input fields");

    // Dapatkan environment variables
    const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID');
    const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY');

    if (!CLOUDFLARE_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      throw new Error('Missing R2 environment variables');
    }

    console.log("Environment variables loaded");

    // Konversi photoData ke Uint8Array
    let photoBytes: Uint8Array;
    if (Array.isArray(photoData)) {
      photoBytes = new Uint8Array(photoData);
    } else if (typeof photoData === 'object' && photoData.type === 'Buffer') {
      photoBytes = new Uint8Array(photoData.data);
    } else {
      throw new Error('Invalid photoData format');
    }

    const contentLength = photoBytes.length;
    console.log("Photo data size:", contentLength);

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileExt = contentType.split('/')[1] || 'jpg';
    const safeLocationName = locationName.replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `${userId}/${safeLocationName}_${timestamp}.${fileExt}`;
    console.log("Generated filename:", filename);

    // Upload menggunakan signed URL approach (lebih sederhana)
    const r2Endpoint = `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/satpam/${filename}`;
    
    console.log("Attempting upload to:", r2Endpoint);
    
    const uploadResponse = await fetch(r2Endpoint, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${btoa(`${R2_ACCESS_KEY_ID}:${R2_SECRET_ACCESS_KEY}`)}`,
        'Content-Type': contentType,
        'Content-Length': contentLength.toString(),
      },
      body: photoBytes,
    });

    console.log("Upload response status:", uploadResponse.status);
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("Upload error response:", errorText);
      throw new Error(`R2 upload failed: ${uploadResponse.status} - ${errorText}`);
    }

    const publicUrl = `https://pub-${CLOUDFLARE_ACCOUNT_ID}.r2.dev/satpam/${filename}`;
    console.log("Upload successful, public URL:", publicUrl);

    return new Response(
      JSON.stringify({ 
        success: true,
        r2PublicUrl: publicUrl
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        stack: error.stack
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});