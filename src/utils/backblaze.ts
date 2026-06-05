"use client";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Mengambil dan membersihkan nilai endpoint dari .env
let rawEndpoint = import.meta.env.VITE_B2_ENDPOINT?.trim() || "";
if (!rawEndpoint) {
  rawEndpoint = "https://s3.ca-east-006.backblazeb2.com";
} else {
  // Jika user lupa memasukkan protokol http/https, tambahkan secara otomatis
  if (!rawEndpoint.startsWith("http://") && !rawEndpoint.startsWith("https://")) {
    rawEndpoint = `https://${rawEndpoint}`;
  }
}

const B2_ENDPOINT = rawEndpoint;
const B2_REGION = import.meta.env.VITE_B2_REGION?.trim() || "ca-east-006";

const accessKeyId = import.meta.env.VITE_B2_ACCESS_KEY_ID?.trim();
const secretAccessKey = import.meta.env.VITE_B2_SECRET_ACCESS_KEY?.trim();
const bucketName = import.meta.env.VITE_B2_BUCKET_NAME?.trim() || "satpam";

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
    // Mengembalikan URL publik yang sesuai dengan endpoint yang digunakan
    const cleanEndpoint = B2_ENDPOINT.replace("https://", "").replace("http://", "");
    return `https://${bucketName}.${cleanEndpoint}/${fileName}`;
  } catch (error: any) {
    console.error("[Backblaze B2] Error detail saat upload:", error);
    throw new Error(
      `Gagal mengunggah ke Backblaze B2. Pastikan aturan CORS di bucket Anda sudah diaktifkan. Detail: ${error.message}`
    );
  }
};