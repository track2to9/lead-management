"use client";

import { useList } from "@refinedev/core";
import { Table, Tag, Button, Typography, Space, Select, Tooltip } from "antd";
import { PlusOutlined, FilePdfOutlined, PaperClipOutlined, WarningOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Quotation } from "@/lib/types";
import ImportDropzone from "@/components/quotation/ImportDropzone";

const { Title, Text } = Typography;

type Filter = "all" | "manual" | "imported" | "unverified";

export default function QuotationsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [importOpen, setImportOpen] = useState(false);

  const { query } = useList<Quotation>({
    resource: "quotations",
    sorters: [{ field: "created_at", order: "desc" }],
    pagination: { pageSize: 200 },
  });

  const all = query.data?.data ?? [];
  const quotations = useMemo(() => {
    switch (filter) {
      case "manual":
        return all.filter((q) => q.source === "manual");
      case "imported":
        return all.filter((q) => q.source === "imported_pdf");
      case "unverified":
        return all.filter(
          (q) => q.source === "imported_pdf" && q.status === "imported_unverified",
        );
      default:
        return all;
    }
  }, [all, filter]);

  const unverifiedCount = all.filter(
    (q) => q.source === "imported_pdf" && q.status === "imported_unverified",
  ).length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>견적서</Title>
          <Text type="secondary">{quotations.length}개 표시 중 (전체 {all.length}개)</Text>
        </div>
        <Space>
          <Select
            value={filter}
            style={{ width: 180 }}
            onChange={(v) => setFilter(v)}
            options={[
              { value: "all", label: "전체" },
              { value: "manual", label: "수기 작성" },
              { value: "imported", label: "임포트됨" },
              { value: "unverified", label: `검증 필요${unverifiedCount ? ` (${unverifiedCount})` : ""}` },
            ]}
          />
          <Button icon={<FilePdfOutlined />} onClick={() => setImportOpen(true)}>
            PDF 임포트
          </Button>
          <Link href="/dashboard/quotations/new">
            <Button type="primary" icon={<PlusOutlined />}>새 견적서</Button>
          </Link>
        </Space>
      </div>

      <Table
        dataSource={quotations}
        rowKey="id"
        loading={query.isLoading}
        pagination={{ pageSize: 20, showTotal: (t) => `총 ${t}개` }}
        onRow={(record) => ({
          onClick: () => (window.location.href = `/dashboard/quotations/${record.id}`),
          style: { cursor: "pointer" },
        })}
        columns={[
          {
            title: "Ref No",
            dataIndex: "ref_no",
            key: "ref_no",
            width: 200,
            render: (v: string, row: Quotation) => (
              <Space>
                <Text strong>{v}</Text>
                {row.source === "imported_pdf" && row.status === "imported_unverified" && (
                  <Tooltip title="PDF 임포트, 검증 필요">
                    <WarningOutlined style={{ color: "#d48806" }} />
                  </Tooltip>
                )}
                {row.source === "imported_pdf" && row.status !== "imported_unverified" && (
                  <Tooltip title="PDF에서 임포트">
                    <PaperClipOutlined style={{ color: "#8c8c8c" }} />
                  </Tooltip>
                )}
              </Space>
            ),
          },
          { title: "업체", dataIndex: "client_name", key: "client", width: 200 },
          {
            title: "통화", dataIndex: "currency", key: "currency", width: 80,
            render: (v: string) => <Tag>{v}</Tag>,
          },
          {
            title: "상태", dataIndex: "status", key: "status", width: 120,
            render: (s: Quotation["status"]) => {
              if (s === "final") return <Tag color="green">완료</Tag>;
              if (s === "imported_unverified") return <Tag color="gold">검증 필요</Tag>;
              return <Tag>작성 중</Tag>;
            },
          },
          { title: "날짜", dataIndex: "date", key: "date", width: 120 },
          {
            title: "생성일", dataIndex: "created_at", key: "created", width: 120,
            render: (v: string) => v?.split("T")[0],
          },
        ]}
      />

      <ImportDropzone
        open={importOpen}
        onClose={() => {
          setImportOpen(false);
          void query.refetch();
        }}
        onAllDone={() => void query.refetch()}
      />
    </div>
  );
}
