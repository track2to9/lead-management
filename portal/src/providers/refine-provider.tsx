"use client";

import { Suspense } from "react";
import { Refine } from "@refinedev/core";
import routerProvider from "@refinedev/nextjs-router";
import { dataProvider } from "@refinedev/supabase";
import { RefineThemes } from "@refinedev/antd";
import { App as AntdApp, ConfigProvider, Spin } from "antd";
import koKR from "antd/locale/ko_KR";
import { supabaseClient } from "@/lib/supabase-client";
import { authProvider } from "./auth-provider";

export function RefineProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><Spin size="large" /></div>}>
    <ConfigProvider
      locale={koKR}
      theme={{
        ...RefineThemes.Blue,
        token: {
          colorPrimary: "#f15f23",
          borderRadius: 8,
        },
      }}
    >
      <AntdApp>
        <Refine
          dataProvider={dataProvider(supabaseClient)}
          authProvider={authProvider}
          routerProvider={routerProvider}
          notificationProvider={{
            open: () => {},
            close: () => {},
          }}
          resources={[
            {
              name: "projects",
              list: "/dashboard",
              show: "/dashboard/project/:id",
              create: "/dashboard/new",
              meta: { label: "프로젝트" },
            },
            {
              name: "prospects",
              list: "/dashboard/project/:projectId",
              show: "/dashboard/project/:projectId/prospect/:id",
              meta: { label: "바이어", parent: "projects" },
            },
            {
              name: "feedback",
              meta: { label: "피드백" },
            },
            {
              name: "exhibitions",
              meta: { label: "전시회" },
            },
            { name: "evidence" },
            { name: "company_defaults" },
            {
              name: "quotation_templates",
              meta: { label: "견적서 템플릿" },
            },
            {
              name: "quotations",
              list: "/dashboard/quotations",
              create: "/dashboard/quotations/new",
              edit: "/dashboard/quotations/:id",
              meta: { label: "견적서" },
            },
            {
              name: "quotation_items",
              meta: { label: "견적서 아이템" },
            },
          ]}
          options={{
            syncWithLocation: true,
            warnWhenUnsavedChanges: true,
          }}
        >
          {children}
        </Refine>
      </AntdApp>
    </ConfigProvider>
    </Suspense>
  );
}
