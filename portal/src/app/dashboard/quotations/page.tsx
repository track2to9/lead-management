"use client";

import { useList, useDelete } from "@refinedev/core";
import { Table, Tag, Button, Typography, Space, Select, Tooltip, Popconfirm, message, Input, DatePicker } from "antd";
import { PlusOutlined, FilePdfOutlined, PaperClipOutlined, WarningOutlined, DeleteOutlined, SearchOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Quotation } from "@/lib/types";
import ImportDropzone from "@/components/quotation/ImportDropzone";

const { Title, Text } = Typography;

type Filter = "all" | "manual" | "imported" | "unverified";

export default function QuotationsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [importOpen, setImportOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const { mutate: deleteQuotation } = useDelete();

  const { query } = useList<Quotation>({
    resource: "quotations",
    sorters: [{ field: "created_at", order: "desc" }],
    pagination: { pageSize: 200 },
  });

  function handleDelete(id: string, refNo: string) {
    deleteQuotation(
      { resource: "quotations", id },
      {
        onSuccess: () => {
          message.success(`${refNo} 삭제됨`);
          void query.refetch();
        },
        onError: (err) => {
          message.error(`삭제 실패: ${err?.message || "알 수 없는 오류"}`);
        },
      },
    );
  }

  const all = query.data?.data ?? [];
  const quotations = useMemo(() => {
    let list = all;
    // source 필터
    switch (filter) {
      case "manual":
        list = list.filter((q) => q.source === "manual"); break;
      case "imported":
        list = list.filter((q) => q.source === "imported_pdf"); break;
      case "unverified":
        list = list.filter((q) => q.source === "imported_pdf" && q.status === "imported_unverified"); break;
    }
    // 통합 검색: ref_no, 업체, 모델(columns), 통화
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter((row) => {
        const haystacks: string[] = [
          row.ref_no, row.client_name, row.currency,
          ...(row.columns || []).flatMap((c) => [c.label, c.key]),
        ].filter(Boolean) as string[];
        return haystacks.some((s) => s.toLowerCase().includes(q));
      });
    }
    // 날짜 범위: created_at 기준
    if (dateRange?.[0] && dateRange?.[1]) {
      const start = dateRange[0].startOf("day");
      const end = dateRange[1].endOf("day");
      list = list.filter((row) => {
        const d = row.created_at ? dayjs(row.created_at) : null;
        return d && d.isAfter(start) && d.isBefore(end);
      });
    }
    return list;
  }, [all, filter, searchText, dateRange]);

  const unverifiedCount = all.filter(
    (q) => q.source === "imported_pdf" && q.status === "imported_unverified",
  ).length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>견적서</Title>
          <Text type="secondary">{quotations.length}개 표시 중 (전체 {all.length}개)</Text>
        </div>
        <Space>
          <Button icon={<FilePdfOutlined />} onClick={() => setImportOpen(true)}>
            PDF 임포트
          </Button>
          <Link href="/dashboard/quotations/new">
            <Button type="primary" icon={<PlusOutlined />}>새 견적서</Button>
          </Link>
        </Space>
      </div>

      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Ref No, 업체, 모델(칼럼명), 통화 통합 검색"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 320 }}
          allowClear
        />
        <DatePicker.RangePicker
          placeholder={["시작일", "종료일"]}
          value={dateRange}
          onChange={(v) => setDateRange(v as [Dayjs | null, Dayjs | null] | null)}
        />
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
        {(searchText || dateRange) && (
          <Button size="small" onClick={() => { setSearchText(""); setDateRange(null); }}>
            초기화
          </Button>
        )}
      </Space>

      <Table
        dataSource={quotations}
        rowKey="id"
        loading={query.isLoading}
        pagination={{ pageSize: 20, showTotal: (t) => `총 ${t}개` }}
        columns={[
          {
            title: "Ref No",
            dataIndex: "ref_no",
            key: "ref_no",
            width: 200,
            sorter: (a: Quotation, b: Quotation) => (a.ref_no || "").localeCompare(b.ref_no || ""),
            render: (v: string, row: Quotation) => (
              <Space>
                <Link href={`/dashboard/quotations/${row.id}`}>
                  <Text strong style={{ color: "#1890ff", cursor: "pointer" }}>{v}</Text>
                </Link>
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
          {
            title: "업체", dataIndex: "client_name", key: "client", width: 200,
            sorter: (a: Quotation, b: Quotation) => (a.client_name || "").localeCompare(b.client_name || ""),
          },
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
          {
            title: "날짜", dataIndex: "date", key: "date", width: 120,
            sorter: (a: Quotation, b: Quotation) => (a.date || "").localeCompare(b.date || ""),
          },
          {
            title: "생성일", dataIndex: "created_at", key: "created", width: 120,
            sorter: (a: Quotation, b: Quotation) => (a.created_at || "").localeCompare(b.created_at || ""),
            defaultSortOrder: "descend" as const,
            render: (v: string) => v?.split("T")[0],
          },
          {
            title: "", key: "actions", width: 50, align: "center" as const,
            render: (_: unknown, row: Quotation) => (
              <Popconfirm
                title={`"${row.ref_no}" 견적서를 삭제할까요?`}
                description="되돌릴 수 없습니다."
                okText="삭제" cancelText="취소" okButtonProps={{ danger: true }}
                onConfirm={() => handleDelete(row.id, row.ref_no)}
              >
                <Button type="text" size="small" danger icon={<DeleteOutlined />}
                  onClick={(e) => e.stopPropagation()} />
              </Popconfirm>
            ),
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
