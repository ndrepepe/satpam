"use client";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const B2_ENDPOINT = "https://s3.ca-east-006.backblazeb2.com";
const B2_REGION = "ca-east-006";

const accessKeyId = import.meta.env.VITE_B2_ACCESS_KEY_ID;
const secretAccessKey = import.meta.env.VITE_B2_SECRET_ACCESS_KEY;
const bucketName = import.meta.env.VITE_B2_BUCKET_NAME || "satpam";

if (!accessKeyId || !secretAccessKey) {
  console.warn(
    "[Backblaze B2] Peringatan: Kredensial VITE_B2_ACCESS_KEY_ID atau VITE_B2_SECRET_ACCESS_KEY tidak ditemukan di file .env!"
  );
}

// Inisialisasi S3 Client untuk Backblaze B2
const s3Client = new S3Client({
  endpoint: B2_ENDPOINT,
  region: B2_REGION,
  credentials: {
    accessKeyId: accessKeyId || "",
    secretAccessKey: secretAccessKey || "",
  },
});

export const uploadToBackblaze = async (
  fileBlob: Blob,
  fileName: string,
  contentType: string
): Promise<string> => {
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("Kredensial Backblaze B2 belum dikonfigurasi di file .env aplikasi.");
  }

  const arrayBuffer = await fileBlob.arrayBuffer();
  const fileData = new Uint8Array(arrayBuffer);

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: fileName,
    Body: fileData,
    ContentType: contentType,
  });

  try {
    await s3Client.send(command);
    return `https://${bucketName}.s3.ca-east-006.backblazeb2.com/${fileName}`;
  } catch (error: any) {
    console.error("[Backblaze B2] Error detail saat upload:", error);
    throw new Error(
      `Gagal mengunggah ke Backblaze B2. Pastikan aturan CORS di bucket Anda sudah diaktifkan. Detail: ${error.message}`
    );
  }
};