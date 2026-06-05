"use client";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const B2_ENDPOINT = "https://s3.ca-east-006.backblazeb2.com";
const B2_REGION = "ca-east-006";

// Inisialisasi S3 Client untuk Backblaze B2
const s3Client = new S3Client({
  endpoint: B2_ENDPOINT,
  region: B2_REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_B2_ACCESS_KEY_ID || "",
    secretAccessKey: import.meta.env.VITE_B2_SECRET_ACCESS_KEY || "",
  },
});

export const uploadToBackblaze = async (
  fileBlob: Blob,
  fileName: string,
  contentType: string
): Promise<string> => {
  const bucketName = import.meta.env.VITE_B2_BUCKET_NAME || "satpam";

  const arrayBuffer = await fileBlob.arrayBuffer();
  const fileData = new Uint8Array(arrayBuffer);

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: fileName,
    Body: fileData,
    ContentType: contentType,
  });

  await s3Client.send(command);

  // Mengembalikan URL publik S3 Backblaze B2
  return `https://${bucketName}.s3.ca-east-006.backblazeb2.com/${fileName}`;
};