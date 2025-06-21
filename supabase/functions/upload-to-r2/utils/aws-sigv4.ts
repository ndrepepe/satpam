// Helper function to convert ArrayBuffer to hex string
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper function to convert string to Uint8Array
function strToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// Helper function to sign a string with HMAC-SHA256 using Web Crypto API
async function sign(key: ArrayBuffer, msg: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    strToUint8Array(msg)
  );
  return signature;
}

// Helper function to create SHA256 hash using Web Crypto API
async function sha256(data: string | ArrayBuffer | Uint8Array | Blob): Promise<string> {
  let buffer: ArrayBuffer;
  if (typeof data === 'string') {
    buffer = strToUint8Array(data).buffer;
  } else if (data instanceof Uint8Array) {
    buffer = data.buffer;
  } else if (data instanceof ArrayBuffer) {
    buffer = data;
  } else if (data instanceof Blob) {
    buffer = await data.arrayBuffer();
  } else {
    throw new Error("Unsupported data type for hashing.");
  }
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
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
    payloadHash = await sha256(request.body);
  } else {
    payloadHash = await sha256(''); // Empty string hash for no body
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
    await sha256(canonicalRequest),
  ].join('\n');

  // 3. Calculate the signature
  const kSecret = strToUint8Array(`AWS4${secretAccessKey}`).buffer;
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