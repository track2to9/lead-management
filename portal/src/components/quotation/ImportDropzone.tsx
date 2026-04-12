"use client";

import { useState } from "react";
import { Modal, Upload, Button, List, Tag, Typography, Space } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import { supabaseClient } from "@/lib/supabase-client";

const { Dragger } = Upload;
const { Text } = Typography;

type FileStatus = "pending" | "uploading" | "done" | "failed";

interface RowState {
  uid: string;
  name: string;
  status: FileStatus;
  error?: string;
  quotationId?: string;
  confidenceAvg?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onAllDone: () => void;
}

export default function ImportDropzone({ open, onClose, onAllDone }: Props) {
  const [rows, setRows] = useState<RowState[]>([]);
  const [running, setRunning] = useState(false);

  async function runSequentialUpload(files: File[], fileRows: RowState[]) {
    setRunning(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const uid = fileRows[i].uid;
      updateRow(uid, { status: "uploading" });

      try {
        const { data: session } = await supabaseClient.auth.getSession();
        const token = session.session?.access_token;
        if (!token) throw new Error("Not logged in");

        const fd = new FormData();
        fd.append("file", file);

        const res = await fetch("/api/quotations/import", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        const body = await res.json();

        if (!res.ok) {
          updateRow(uid, { status: "failed", error: body.error ?? `HTTP ${res.status}` });
          continue;
        }

        const confs = extractConfidences(body.quotation?.import_confidence);
        const avg = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : undefined;

        updateRow(uid, {
          status: "done",
          quotationId: body.quotation?.id,
          confidenceAvg: avg,
        });
      } catch (e) {
        updateRow(uid, { status: "failed", error: (e as Error).message });
      }
    }
    setRunning(false);
    onAllDone();
  }

  function updateRow(uid: string, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
  }

  function handleBeforeUpload(file: File, fileList: File[]) {
    // Ant Design calls beforeUpload once per file but passes the full fileList each time.
    // Only process on the last file to avoid duplicate entries.
    if (file === fileList[fileList.length - 1]) {
      const newRows: RowState[] = fileList.map((f) => ({
        uid: `${f.name}-${Date.now()}-${Math.random()}`,
        name: f.name,
        status: "pending" as FileStatus,
      }));
      setRows((prev) => [...prev, ...newRows]);
      void runSequentialUpload(fileList, newRows);
    }
    return false; // prevent default upload
  }

  return (
    <Modal
      title="PDF 견적서 임포트"
      open={open}
      onCancel={running ? undefined : onClose}
      footer={[
        <Button key="close" onClick={onClose} disabled={running}>
          닫기
        </Button>,
      ]}
      width={640}
    >
      <Dragger
        multiple
        accept="application/pdf"
        beforeUpload={handleBeforeUpload}
        showUploadList={false}
        disabled={running}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">PDF 파일을 여기로 끌어다 놓으세요</p>
        <p className="ant-upload-hint">여러 파일을 한 번에 선택할 수 있습니다. 파일당 최대 20MB.</p>
      </Dragger>

      <List
        style={{ marginTop: 16 }}
        dataSource={rows}
        locale={{ emptyText: "대기 중..." }}
        renderItem={(row) => (
          <List.Item>
            <Space>
              <Text>{row.name}</Text>
              <StatusTag row={row} />
              {row.error && <Text type="danger">{row.error}</Text>}
            </Space>
          </List.Item>
        )}
      />
    </Modal>
  );
}

function StatusTag({ row }: { row: RowState }) {
  switch (row.status) {
    case "pending":
      return <Tag>대기</Tag>;
    case "uploading":
      return <Tag color="processing">추출 중</Tag>;
    case "done":
      return (
        <Tag color="success">
          완료{row.confidenceAvg !== undefined ? ` (${Math.round(row.confidenceAvg * 100)}%)` : ""}
        </Tag>
      );
    case "failed":
      return <Tag color="error">실패</Tag>;
  }
}

function extractConfidences(
  imp: Record<string, unknown> | null | undefined,
): number[] {
  if (!imp) return [];
  const out: number[] = [];
  for (const v of Object.values(imp)) {
    if (typeof v === "number") out.push(v);
  }
  return out;
}
