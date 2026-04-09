import { supabaseClient } from "./supabase-client";

const BUCKET = "quotation-assets";

/**
 * 이미지 파일을 Supabase Storage에 업로드하고 public URL을 반환.
 * @param file 업로드할 파일
 * @param folder "logos" | "signatures"
 * @returns public URL string
 */
export async function uploadImage(file: File, folder: "logos" | "signatures"): Promise<string> {
  const ext = file.name.split(".").pop() || "png";
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabaseClient.storage
    .from(BUCKET)
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabaseClient.storage.from(BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}

/**
 * Storage에서 파일 삭제.
 */
export async function deleteImage(url: string): Promise<void> {
  // URL에서 파일 경로 추출
  const match = url.match(/\/quotation-assets\/(.+)$/);
  if (!match) return;

  const { error } = await supabaseClient.storage
    .from(BUCKET)
    .remove([match[1]]);

  if (error) console.warn("Delete failed:", error.message);
}
