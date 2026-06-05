"use client";

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Mengambil nilai dari .env
const B2_ENDPOINT = import.meta.env.VITE_B2_ENDPOINT?.trim();
const B2_REGION = import.meta.env.VITE_B2_REGION?.trim() || "ca-east-006";
const accessKeyId = import.meta.env.VITE_B2_ACCESS_KEY_ID?.trim();
const secretAccessKey = import.meta.env.VITE_B2_SECRET_ACCESS_KEY?.trim();
const bucketName = import.meta.env.VITE_B2_BUCKET_NAME?.trim() || "cekarea";

// Inisialisasi S3 Client dengan konfigurasi super stabil untuk Mobile
const s3Client = new S3Client({
  endpoint: B2_ENDPOINT,
  region: B2_REGION,
  credentials: {
    accessKeyId: accessKeyId || "",
    secretAccessKey: secretAccessKey || "",
  },
  forcePathStyle: true,
  maxAttempts: 1,
  // Menonaktifkan payload signing yang sering menyebabkan 'Failed to fetch' karena masalah CORS/Header
  signer: { sign: async (request) => request }, 
});

/**
 * Fungsi Unggah dengan Deteksi Error Mendalam
 */
export const uploadToBackblaze = async (
  fileBlob: Blob,
  fileName: string,
  contentType: string
): Promise<string> => {
  if (!accessKeyId || !secretAccessKey || !B2_ENDPOINT) {
    throw new Error("Konfigurasi Backblaze B2 di .env tidak lengkap.");
  }

  // Gunakan Client S3 standar tapi dengan konfigurasi manual untuk PUT
  const finalS3Client = new S3Client({
    endpoint: B2_ENDPOINT,
    region: B2_REGION,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  const arrayBuffer = await fileBlob.arrayBuffer();
  const fileData = new Uint8Array(arrayBuffer);

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: fileName,
    Body: fileData,
    ContentType: contentType,
    // Sangat Penting: Menghindari header hashing yang berat untuk mobile
    ChecksumAlgorithm: undefined,
  });

  try {
    console.log(`[B2-Debug] Mencoba upload ke: ${B2_ENDPOINT}/${bucketName}/${fileName}`);
    await finalS3Client.send(command);
    
    const cleanEndpoint = B2_ENDPOINT.replace("https://", "").replace("http://", "");
    return `https://${cleanEndpoint}/${bucketName}/${fileName}`;
  } catch (error: any) {
    console.error("[B2-Critical] Gagal total:", error);

    // Analisis Error Mendalam
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error(
        "Koneksi Ditolak (Network Error). Ini biasanya karena: \n" +
        "1. Aturan CORS di Backblaze belum disimpan sebagai 'Custom'.\n" +
        "2. Provider internet Anda memblokir koneksi ke Backblaze.\n" +
        "3. Coba gunakan Jaringan WiFi atau VPN jika di mobile."
      );
    }
    
    throw new Error(`Error B2 (${error.name}): ${error.message}`);
  }
};

export const getPresignedUrl = async (fileUrl: string): Promise<string> => {
  if (!fileUrl) return "";
  try {
    const urlObj = new URL(fileUrl);
    let key = decodeURIComponent(urlObj.pathname.substring(1));
    if (key.startsWith(`${bucketName}/`)) key = key.substring(bucketName.length + 1);

    const command = new GetObjectCommand({ Bucket: bucketName, Key: key });
    return await getSignedUrl(s3Client as any, command as any, { expiresIn: 3600 });
  } catch (error) {
    return fileUrl;
  }
};