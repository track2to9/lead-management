"use client";

import { useList, useCreate, useGetIdentity } from "@refinedev/core";
import { Card, Typography, Space, Spin, Row, Col } from "antd";
import { FileTextOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import type { QuotationTemplate } from "@/lib/types";

const { Title, Text } = Typography;

export default function NewQuotationPage() {
  const router = useRouter();
  const { data: identity } = useGetIdentity<{ id: string }>();
  const { query } = useList<QuotationTemplate>({
    resource: "quotation_templates",
    pagination: { pageSize: 50 },
  });
  const createHook = useCreate();
  const createQuotation = createHook.mutate;
  const creating = false;

  const templates = query.data?.data || [];

  function handleSelect(template: QuotationTemplate) {
    const now = new Date();
    const refNo = `QT${now.getFullYear().toString().slice(2)}-${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

    createQuotation(
      {
        resource: "quotations",
        values: {
          user_id: identity?.id,
          template_id: template.id,
          ref_no: refNo,
          date: now.toISOString().split("T")[0],
          status: "draft",
          columns: template.columns,
          currency: "USD",
          exchange_rates: { CNY: 7.2, KRW: 1380 },
          margin_mode: "forward",
          footer: template.footer_defaults || {},
          company_header: {
            name: "SPS ENG CO., LTD",
            address: "서울특별시 송파구",
            tel: "",
            web: "https://spseng.com",
          },
          global_costs: [],
        },
      },
      {
        onSuccess: (data) => {
          router.push(`/dashboard/quotations/${data.data.id}`);
        },
      },
    );
  }

  if (query.isLoading) return <div style={{ textAlign: "center", padding: 64 }}><Spin size="large" /></div>;

  return (
    <div>
      <Title level={4}>새 견적서</Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 24 }}>템플릿을 선택하면 견적서가 생성됩니다</Text>

      <Row gutter={[16, 16]}>
        {templates.map((t) => (
          <Col key={t.id} xs={24} sm={12} md={8}>
            <Card hoverable onClick={() => !creating && handleSelect(t)} style={{ height: "100%" }}>
              <Space direction="vertical">
                <FileTextOutlined style={{ fontSize: 24, color: "#f15f23" }} />
                <Title level={5} style={{ margin: 0 }}>{t.name}</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t.columns.length}개 필드: {t.columns.map((c) => c.label).join(", ")}
                </Text>
                {t.is_system && <Text type="secondary" style={{ fontSize: 11 }}>기본 템플릿</Text>}
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
