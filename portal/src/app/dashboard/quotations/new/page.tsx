"use client";

import { useList, useCreate, useGetIdentity } from "@refinedev/core";
import { Card, Typography, Space, Spin, Row, Col } from "antd";
import { FileTextOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import type { QuotationTemplate } from "@/lib/types";

const { Title, Text } = Typography;

interface CompanyDefaults {
  logo_url?: string;
  company_name?: string;
  address?: string;
  tel?: string;
  website?: string;
  from_name?: string;
  sig_company?: string;
  sig_name?: string;
  sig_title?: string;
  sig_image_url?: string;
  greeting?: string;
  intro?: string;
  default_footer?: Record<string, string>;
}

export default function NewQuotationPage() {
  const router = useRouter();
  const { data: identity } = useGetIdentity<{ id: string }>();
  const { query } = useList<QuotationTemplate>({
    resource: "quotation_templates",
    pagination: { pageSize: 50 },
  });
  // 회사 기본 설정 로드
  const { query: defaultsQuery } = useList<CompanyDefaults>({
    resource: "company_defaults",
    filters: [{ field: "user_id", operator: "eq", value: identity?.id }],
    pagination: { pageSize: 1 },
    queryOptions: { enabled: !!identity?.id },
  });
  const createHook = useCreate();
  const createQuotation = createHook.mutate;
  const creating = false;

  const templates = query.data?.data || [];
  const defaults = defaultsQuery.data?.data?.[0];

  function handleSelect(template: QuotationTemplate) {
    const now = new Date();
    const refNo = `QT${now.getFullYear().toString().slice(2)}-${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

    // 회사 기본값이 있으면 사용, 없으면 빈 값
    const companyHeader = defaults ? {
      logo_url: defaults.logo_url || "",
      name: defaults.company_name || "",
      address: defaults.address || "",
      tel: defaults.tel || "",
      web: defaults.website || "",
      from_name: defaults.from_name || defaults.company_name || "",
      doc_title: "Quotation",
      attn: "To whom it may concern",
      subject: "",
      greeting: defaults.greeting || "Dear Sir,",
      intro: defaults.intro || "We are pleased to offer the following goods as per terms and conditions set forth hereunder.",
    } : {
      name: "", address: "", tel: "", web: "",
      doc_title: "Quotation",
      greeting: "Dear Sir,",
      intro: "We are pleased to offer the following goods as per terms and conditions set forth hereunder.",
    };

    // 푸터: 템플릿 기본값 + 회사 서명 정보
    const footer = {
      ...(template.footer_defaults || {}),
      ...(defaults?.default_footer || {}),
      sig_company: defaults?.sig_company || defaults?.from_name || "",
      sig_name: defaults?.sig_name || "",
      sig_title: defaults?.sig_title || "",
      sig_image_url: defaults?.sig_image_url || "",
    };

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
          footer,
          company_header: companyHeader,
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
