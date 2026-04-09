"use client";

import { useList } from "@refinedev/core";
import { Table, Tag, Button, Typography, Space } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import Link from "next/link";
import type { Quotation } from "@/lib/types";

const { Title, Text } = Typography;

export default function QuotationsPage() {
  const { query } = useList<Quotation>({
    resource: "quotations",
    sorters: [{ field: "created_at", order: "desc" }],
  });

  const quotations = query.data?.data || [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>견적서</Title>
          <Text type="secondary">{quotations.length}개의 견적서</Text>
        </div>
        <Link href="/dashboard/quotations/new">
          <Button type="primary" icon={<PlusOutlined />}>새 견적서</Button>
        </Link>
      </div>

      <Table
        dataSource={quotations}
        rowKey="id"
        loading={query.isLoading}
        pagination={{ pageSize: 20, showTotal: (t) => `총 ${t}개` }}
        onRow={(record) => ({
          onClick: () => window.location.href = `/dashboard/quotations/${record.id}`,
          style: { cursor: "pointer" },
        })}
        columns={[
          {
            title: "Ref No", dataIndex: "ref_no", key: "ref_no", width: 160,
            render: (v: string) => <Text strong>{v}</Text>,
          },
          { title: "업체", dataIndex: "client_name", key: "client", width: 200 },
          {
            title: "통화", dataIndex: "currency", key: "currency", width: 80,
            render: (v: string) => <Tag>{v}</Tag>,
          },
          {
            title: "상태", dataIndex: "status", key: "status", width: 100,
            render: (s: string) => (
              <Tag color={s === "final" ? "green" : "default"}>
                {s === "final" ? "완료" : "작성 중"}
              </Tag>
            ),
          },
          { title: "날짜", dataIndex: "date", key: "date", width: 120 },
          {
            title: "생성일", dataIndex: "created_at", key: "created", width: 120,
            render: (v: string) => v?.split("T")[0],
          },
        ]}
      />
    </div>
  );
}
