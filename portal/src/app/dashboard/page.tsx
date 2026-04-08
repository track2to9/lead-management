"use client";

import { useList, useGetIdentity } from "@refinedev/core";
import { Table, Tag, Card, Statistic, Button, Empty, Space, Typography } from "antd";
import { PlusOutlined, CheckCircleOutlined } from "@ant-design/icons";
import Link from "next/link";
import type { Project } from "@/lib/types";

const { Title, Text } = Typography;

export default function DashboardPage() {
  const { data: identity } = useGetIdentity<{ id: string }>();
  const { query } = useList<Project>({
    resource: "projects",
    filters: [{ field: "user_id", operator: "eq", value: identity?.id }],
    sorters: [{ field: "created_at", order: "desc" }],
    queryOptions: { enabled: !!identity?.id },
  });

  const projects = query.data?.data || [];
  const isLoading = query.isLoading;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>프로젝트</Title>
          <Text type="secondary">{projects.length > 0 ? `${projects.length}개의 분석 프로젝트` : "해외 바이어 발굴을 시작하세요"}</Text>
        </div>
        <Link href="/dashboard/new">
          <Button type="primary" icon={<PlusOutlined />}>새 분석 요청</Button>
        </Link>
      </div>

      {projects.length === 0 && !isLoading ? (
        <div>
          <Card style={{ textAlign: "center", padding: "48px 0" }}>
            <Empty description={<><Title level={5}>아직 프로젝트가 없습니다</Title><Text type="secondary">제품과 타겟 시장 정보를 입력하면 AI가 맞춤 바이어를 찾아드립니다.</Text></>} />
            <Link href="/dashboard/new"><Button type="primary" icon={<PlusOutlined />} size="large" style={{ marginTop: 16 }}>첫 분석 요청하기</Button></Link>
          </Card>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 24 }}>
            {[
              { n: "01", t: "분석 요청", d: "제품, 타겟 고객, 국가 입력" },
              { n: "02", t: "AI 발굴", d: "10,000+ 소스에서 바이어 탐색" },
              { n: "03", t: "결과 확인", d: "매칭 점수, 근거, 전략 확인" },
              { n: "04", t: "피드백", d: "승인/제외로 리스트 개선" },
            ].map((s) => (
              <Card key={s.n} size="small">
                <Tag color="orange" style={{ fontWeight: 700, marginBottom: 8 }}>{s.n}</Tag>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{s.t}</div>
                <Text type="secondary" style={{ fontSize: 12 }}>{s.d}</Text>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <Table
          dataSource={projects}
          rowKey="id"
          loading={isLoading}
          pagination={false}
          onRow={(record) => ({
            onClick: () => window.location.href = `/dashboard/project/${record.id}`,
            style: { cursor: "pointer" },
          })}
          columns={[
            {
              title: "프로젝트", dataIndex: "name", key: "name",
              render: (name: string, record: Project) => (
                <div>
                  <div style={{ fontWeight: 600 }}>{name}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{record.product} · {record.created_at?.split("T")[0]}</Text>
                </div>
              ),
            },
            { title: "국가", dataIndex: "countries", key: "countries", width: 120 },
            {
              title: "분석", dataIndex: "total_companies", key: "total", width: 80, align: "right" as const,
              render: (v: number) => <span style={{ fontWeight: 700 }}>{v}</span>,
            },
            {
              title: "HIGH", dataIndex: "high_count", key: "high", width: 80, align: "right" as const,
              render: (v: number) => <span style={{ fontWeight: 700, color: "#f15f23" }}>{v}</span>,
            },
            {
              title: "이메일", dataIndex: "emails_drafted", key: "emails", width: 80, align: "right" as const,
            },
            {
              title: "상태", dataIndex: "status", key: "status", width: 100, align: "right" as const,
              render: (status: string) => (
                <Tag color={status === "active" ? "green" : status === "reviewing" ? "orange" : "default"}>
                  {status === "active" ? "진행 중" : status === "reviewing" ? "검토 중" : "완료"}
                </Tag>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
