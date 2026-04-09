"use client";

import { useRef, useState } from "react";
import { Spin } from "antd";
import { DeleteOutlined, UploadOutlined } from "@ant-design/icons";
import { uploadImage, deleteImage } from "@/lib/storage";

interface Props {
  value?: string;          // current image URL
  onChange: (url: string | null) => void;
  folder: "logos" | "signatures";
  placeholder?: string;
  maxHeight?: number;
  style?: React.CSSProperties;
}

export default function ImageUploader({ value, onChange, folder, placeholder, maxHeight = 60, style }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // 이미지 파일만 허용
    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    // 5MB 제한
    if (file.size > 5 * 1024 * 1024) {
      alert("파일 크기는 5MB 이하만 가능합니다.");
      return;
    }

    setUploading(true);
    try {
      const url = await uploadImage(file, folder);
      onChange(url);
    } catch (err) {
      alert("업로드 실패: " + (err as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDelete() {
    if (!value) return;
    if (!confirm("이미지를 삭제하시겠습니까?")) return;
    await deleteImage(value);
    onChange(null);
  }

  if (uploading) {
    return (
      <div style={{ padding: 12, textAlign: "center", ...style }}>
        <Spin size="small" /> <span style={{ fontSize: 11, color: "#999", marginLeft: 4 }}>업로드 중...</span>
      </div>
    );
  }

  if (value) {
    return (
      <div style={{ position: "relative", display: "inline-block", ...style }}>
        <img
          src={value}
          alt={folder}
          style={{ maxHeight, display: "block", cursor: "pointer" }}
          onClick={() => fileRef.current?.click()}
          title="클릭하여 변경"
        />
        <button
          onClick={handleDelete}
          style={{
            position: "absolute", top: -6, right: -6,
            width: 18, height: 18, borderRadius: "50%",
            background: "#ff4d4f", color: "#fff", border: "none",
            fontSize: 9, cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center",
          }}
          title="삭제"
        >
          <DeleteOutlined />
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
      </div>
    );
  }

  return (
    <div
      onClick={() => fileRef.current?.click()}
      style={{
        border: "1px dashed #d9d9d9", padding: "8px 16px",
        display: "inline-flex", alignItems: "center", gap: 6,
        cursor: "pointer", color: "#999", fontSize: 11,
        borderRadius: 4, transition: "border-color 0.2s",
        ...style,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#f15f23")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#d9d9d9")}
    >
      <UploadOutlined /> {placeholder || `${folder === "logos" ? "로고" : "서명"} 이미지 업로드`}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
    </div>
  );
}
