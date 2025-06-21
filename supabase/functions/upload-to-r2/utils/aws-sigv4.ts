import { createHash } from "https://esm.sh/@deno-std/hash@0.224.0/mod.ts"; // Menggunakan esm.sh untuk hash
import { hmac } from "https://esm.sh/hmac@v2.0.2"; // Menggunakan esm.sh untuk hmac

// Helper function to convert ArrayBuffer to hex string
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper function to convert string to ArrayBuffer
function strToBuffer(str: string): ArrayBuffer {
  return new TextEncoder().encode(str).buffer;
}

// Helper function to sign a string with HMAC-SHA256
async function sign(key: ArrayBuffer, msg: string): Promise<ArrayBuffer> {
  const signature = await hmac('sha256', key, strToBuffer(msg), 'arraybuffer');
  return signature;
}

// AWS Signature Version 4 signing logic
export async function signAwsV4(
  accessKeyId: string,
  secretAccessKey: string,
  region: string,
  service: string,
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string | ArrayBuffer | Uint8Array | Blob;
  }
): Promise<Record<string, string>> {
  const url = new URL(request.url);
  const host = url.host;
  const path = url.pathname;
  const query = url.searchParams.toString();
  const method = request.method.toUpperCase();
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);

  // 1. Create a canonical request
  let canonicalHeaders = '';
  let signedHeaders = '';
  const headersToSign: Record<string, string> = {};

  // Add host and x-amz-date to headers to sign
  headersToSign['host'] = host;
  headersToSign['x-amz-date'] = amzDate;

  // Add other headers from request
  for (const key in request.headers) {
    headersToSign[key.toLowerCase()] = request.headers[key];
  }

  const sortedHeaderKeys = Object.keys(headersToSign).sort();
  for (const key of sortedHeaderKeys) {
    canonicalHeaders += `${key}:${headersToSign[key].trim()}\n`;
  }
  signedHeaders = sortedHeaderKeys.join(';');

  let payloadHash = 'UNSIGNED-PAYLOAD';
  if (request.body) {
    const hash = createHash('sha256');
    if (typeof request.body === 'string') {
      hash.update(request.body);
    } else if (request.body instanceof Uint8Array || request.body instanceof ArrayBuffer) {
      hash.update(request.body);
    } else if (request.body instanceof Blob) {
      const buffer = await request.body.arrayBuffer();
      hash.update(new Uint8Array(buffer));
    }
    payloadHash = hash.toString();
  } else {
    payloadHash = createHash('sha256').update('').toString(); // Empty string hash for no body
  }

  const canonicalRequest = [
    method,
    path,
    query,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  // 2. Create a string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    createHash('sha256').update(canonicalRequest).toString(),
  ].join('\n');

  // 3. Calculate the signature
  const kSecret = strToBuffer(`AWS4${secretAccessKey}`);
  const kDate = await sign(kSecret, dateStamp);
  const kRegion = await sign(kDate, region);
  const kService = await sign(kRegion, service);
  const kSigning = await sign(kService, 'aws4_request');
  const signature = bufferToHex(await sign(kSigning, stringToSign));

  // 4. Add the Authorization header
  const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    'Authorization': authorizationHeader,
    'x-amz-date': amzDate,
    'host': host, // Ensure host is explicitly set in headers
    ...request.headers // Include any other original headers
  };
}