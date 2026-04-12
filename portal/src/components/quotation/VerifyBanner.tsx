"use client";

import { Alert, Button, Space, Typography } from "antd";
import { FilePdfOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { useState } from "react";
import { supabaseClient } from "@/lib/supabase-client";
import type { Quotation } from "@/lib/types";

const { Text } = Typography;

interface Props {
  quotation: Quotation;
  onVerified: (updated: Quotation) => void;
}

export default function VerifyBanner({ quotation, onVerified }: Props) {
  const [signing, setSigning] = useState(false);
  const [verifying, setVerifying] = useState(false);

  if (quotation.source !== "imported_pdf") return null;
  const needsReview = quotation.status === "imported_unverified";

  async function openOriginal() {
    if (!quotation.import_pdf_url) return;
    setSigning(true);
    try {
      const { data, error } = await supabaseClient.storage
        .from("quotation-imports")
        .createSignedUrl(quotation.import_pdf_url, 300);
      if (error) throw error;
      window.open(data.signedUrl, "_blank", "noopener");
    } finally {
      setSigning(false);
    }
  }

  async function markVerified() {
    setVerifying(true);
    try {
      const { data, error } = await supabaseClient
        .from("quotations")
        .update({ status: "draft", verified_at: new Date().toISOString() })
        .eq("id", quotation.id)
        .select()
        .single();
      if (error || !data) throw error ?? new Error("Update failed");
      onVerified(data as Quotation);
    } finally {
      setVerifying(false);
    }
  }

  const note = quotation.import_confidence?.notes_for_human;
  const failure = quotation.import_confidence?.failure_reason;

  return (
    <Alert
      type={failure ? "error" : needsReview ? "warning" : "info"}
      showIcon
      style={{ marginBottom: 16 }}
      message={
        failure
          ? "이 PDF는 자동 추출에 실패했습니다"
          : needsReview
          ? "이 견적서는 PDF에서 자동 추출되었습니다"
          : "PDF에서 임포트된 견적서 (검증 완료)"
      }
      description={
        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          {failure && <Text type="danger">{failure}</Text>}
          {note && !failure && <Text type="secondary">{note}</Text>}
          {!failure && needsReview && (
            <Text type="secondary">
              노란 셀은 신뢰도가 낮은 필드입니다. 확인 후 고치세요. 복제해서 새 견적서로 쓰는 경우 수정 불필요.
            </Text>
          )}
          <Space>
            {quotation.import_pdf_url && (
              <Button
                size="small"
                icon={<FilePdfOutlined />}
                loading={signing}
                onClick={openOriginal}
              >
                원본 PDF 보기
              </Button>
            )}
            {needsReview && (
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                loading={verifying}
                onClick={markVerified}
              >
                확인 완료
              </Button>
            )}
          </Space>
        </Space>
      }
    />
  );
}
