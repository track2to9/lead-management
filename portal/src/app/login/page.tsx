"use client";

import { useLogin, useRegister } from "@refinedev/core";
import { Form, Input, Button, Card, Typography, Space, Divider, message } from "antd";
import { MailOutlined, LockOutlined, BankOutlined } from "@ant-design/icons";
import { useState } from "react";

const { Title, Text, Link } = Typography;

export default function LoginPage() {
  const loginHook = useLogin();
  const registerHook = useRegister();
  const loginLoading = false;
  const registerLoading = false;
  const login = loginHook.mutate;
  const register = registerHook.mutate;
  const [isSignUp, setIsSignUp] = useState(false);

  function onFinish(values: { email: string; password: string; company_name?: string }) {
    if (isSignUp) {
      register(values, {
        onSuccess: () => message.success("인증 이메일을 확인해주세요."),
        onError: (err) => message.error(err.message),
      });
    } else {
      login(values);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex" }}>
      {/* Left branding */}
      <div style={{
        width: 480, background: "#0a0a0a", color: "#fff", padding: 40,
        display: "flex", flexDirection: "column", justifyContent: "space-between",
      }} className="hidden lg:flex">
        <Title level={3} style={{ color: "#fff", margin: 0 }}>
          Trade<span style={{ color: "#f15f23" }}>Voy</span>
        </Title>
        <div>
          <Title level={2} style={{ color: "#fff", lineHeight: 1.3 }}>
            해외 바이어,<br />AI가 찾아드립니다.
          </Title>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
            제품 정보만 알려주시면 AI가 10,000+ 소스에서<br />
            맞춤 바이어를 발굴하고, 전문가가 검증합니다.
          </Text>
          <Space size={32} style={{ marginTop: 32 }}>
            <div><div style={{ fontSize: 24, fontWeight: 900, color: "#fff" }}>50+</div><Text type="secondary">분석 국가</Text></div>
            <div><div style={{ fontSize: 24, fontWeight: 900, color: "#fff" }}>92%</div><Text type="secondary">검증 정확도</Text></div>
            <div><div style={{ fontSize: 24, fontWeight: 900, color: "#fff" }}>48h</div><Text type="secondary">평균 전달</Text></div>
          </Space>
        </div>
        <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
          &copy; 2026 TradeVoy · trade.devpartner.org
        </Text>
      </div>

      {/* Right form */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <Card style={{ width: 380, border: "none", boxShadow: "none" }}>
          <div className="lg:hidden" style={{ marginBottom: 24 }}>
            <Title level={4} style={{ margin: 0 }}>Trade<span style={{ color: "#f15f23" }}>Voy</span></Title>
          </div>

          <Title level={4}>{isSignUp ? "회원가입" : "로그인"}</Title>
          <Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
            {isSignUp ? "계정을 만들고 바이어 발굴을 시작하세요." : "고객 포털에 접속합니다."}
          </Text>

          <Form layout="vertical" onFinish={onFinish} autoComplete="off">
            <Form.Item name="email" rules={[{ required: true, type: "email", message: "이메일을 입력해주세요" }]}>
              <Input prefix={<MailOutlined />} placeholder="이메일" size="large" />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, min: 6, message: "6자 이상 비밀번호" }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="비밀번호" size="large" />
            </Form.Item>
            {isSignUp && (
              <Form.Item name="company_name">
                <Input prefix={<BankOutlined />} placeholder="회사명 (선택)" size="large" />
              </Form.Item>
            )}
            <Form.Item>
              <Button type="primary" htmlType="submit" block size="large"
                loading={loginLoading || registerLoading}
                style={{ background: "#0a0a0a", borderColor: "#0a0a0a" }}>
                {isSignUp ? "회원가입" : "로그인"}
              </Button>
            </Form.Item>
          </Form>

          <Divider plain>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {isSignUp ? "이미 계정이 있으신가요?" : "계정이 없으신가요?"}
            </Text>
          </Divider>
          <Button type="link" block onClick={() => setIsSignUp(!isSignUp)}>
            {isSignUp ? "로그인" : "회원가입"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
