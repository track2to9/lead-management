"use client";

import { useGetIdentity, useLogout } from "@refinedev/core";
import { Layout, Menu, Button, Typography, Spin } from "antd";
import { DashboardOutlined, PlusOutlined, SettingOutlined, LogoutOutlined, GlobalOutlined } from "@ant-design/icons";
import Link from "next/link";
import { usePathname } from "next/navigation";

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: identity, isLoading } = useGetIdentity<{ name: string; email: string }>();
  const { mutate: logout } = useLogout();
  const pathname = usePathname();

  if (isLoading) return <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><Spin size="large" /></div>;

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider width={240} style={{ background: "#fff", borderRight: "1px solid #f0f0f0" }} breakpoint="lg" collapsedWidth={0}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f0f0f0" }}>
          <Link href="/dashboard" style={{ fontWeight: 900, fontSize: 18, color: "#000" }}>
            Trade<span style={{ color: "#f15f23" }}>Voy</span>
          </Link>
        </div>

        <div style={{ padding: "12px 20px", borderBottom: "1px solid #f0f0f0" }}>
          <Text type="secondary" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>Workspace</Text>
          <div style={{ fontWeight: 700, fontSize: 14, marginTop: 2 }}>{identity?.name || "..."}</div>
        </div>

        <Menu
          mode="inline"
          selectedKeys={[pathname]}
          style={{ border: "none" }}
          items={[
            { key: "/dashboard", icon: <DashboardOutlined />, label: <Link href="/dashboard">대시보드</Link> },
            { key: "/dashboard/new", icon: <PlusOutlined />, label: <Link href="/dashboard/new">새 분석 요청</Link> },
            { type: "divider" },
            { key: "ext", icon: <GlobalOutlined />, label: <a href="https://tradevoy.devpartner.org" target="_blank">TradeVoy 홈</a> },
          ]}
        />

        <div style={{ position: "absolute", bottom: 0, width: "100%", borderTop: "1px solid #f0f0f0", padding: "12px 20px" }}>
          <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis" }}>
            {identity?.email}
          </Text>
          <Button type="text" icon={<LogoutOutlined />} size="small" onClick={() => logout()} style={{ color: "#999" }}>
            로그아웃
          </Button>
        </div>
      </Sider>

      <Layout>
        <Header style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
          <Button type="text" onClick={() => logout()} style={{ color: "#999", fontSize: 12 }}>로그아웃</Button>
        </Header>
        <Content style={{ padding: 24, background: "#fafafa", overflow: "auto" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            {children}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
