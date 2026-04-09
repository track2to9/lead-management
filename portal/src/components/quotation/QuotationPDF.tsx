"use client";

import { Modal, Button, Space, Tag } from "antd";
import { FilePdfOutlined, DownloadOutlined } from "@ant-design/icons";
import { useRef } from "react";
import type { Quotation, QuotationItem } from "@/lib/types";
import { formatCurrency } from "@/lib/quotation-calc";

interface Props {
  quotation: Quotation;
  items: QuotationItem[];
  open: boolean;
  onClose: () => void;
}

export default function QuotationPDF({ quotation, items, open, onClose }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);

  async function handleDownload() {
    const el = contentRef.current;
    if (!el) return;
    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");

    const canvas = await html2canvas(el, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${quotation.ref_no}.pdf`);
  }

  const h = quotation.company_header || {};
  const f = quotation.footer || {};
  const total = items.reduce((s, i) => s + (Number(i.cells?.amount) || 0), 0);

  return (
    <Modal open={open} onCancel={onClose} width={700} footer={
      <Space>
        <Button icon={<DownloadOutlined />} type="primary" onClick={handleDownload}>PDF 다운로드</Button>
        <Button onClick={onClose}>닫기</Button>
      </Space>
    } title={<><FilePdfOutlined /> PDF 미리보기 {quotation.status === "draft" && <Tag>DRAFT</Tag>}</>}>
      <div ref={contentRef} style={{ padding: 32, background: "white", fontFamily: "Arial, sans-serif", fontSize: 12, lineHeight: 1.6, position: "relative" }}>
        {quotation.status === "draft" && (
          <div style={{ position: "absolute", top: "40%", left: "50%", transform: "translate(-50%, -50%) rotate(-30deg)", fontSize: 60, color: "rgba(0,0,0,0.06)", fontWeight: 900, pointerEvents: "none" }}>
            DRAFT
          </div>
        )}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>{h.name || "Company Name"}</div>
          {h.address && <div style={{ fontSize: 10, color: "#666" }}>{h.address}</div>}
          {h.tel && <div style={{ fontSize: 10, color: "#666" }}>Tel: {h.tel}</div>}
          {h.web && <div style={{ fontSize: 10, color: "#666" }}>{h.web}</div>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <div><strong>Ref No:</strong> {quotation.ref_no}</div>
          <div><strong>Date:</strong> {quotation.date}</div>
        </div>
        {quotation.client_name && <div style={{ marginBottom: 16 }}><strong>To:</strong> {quotation.client_name}</div>}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16, fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ border: "1px solid #000", padding: "4px 6px", background: "#f5f5f5" }}>No</th>
              {quotation.columns.map((col) => (
                <th key={col.key} style={{ border: "1px solid #000", padding: "4px 6px", background: "#f5f5f5" }}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id}>
                <td style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "center" }}>{idx + 1}</td>
                {quotation.columns.map((col) => (
                  <td key={col.key} style={{ border: "1px solid #000", padding: "4px 6px", textAlign: col.type === "currency" || col.type === "number" ? "right" : "left" }}>
                    {col.type === "currency" ? formatCurrency(Number(item.cells?.[col.key]) || 0, quotation.currency) : String(item.cells?.[col.key] || "")}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td colSpan={quotation.columns.length} style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right", fontWeight: 700 }}>TTL</td>
              <td style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right", fontWeight: 700 }}>{formatCurrency(total, quotation.currency)}</td>
            </tr>
          </tbody>
        </table>
        <div style={{ fontSize: 10, lineHeight: 1.8 }}>
          {f.payment_terms && <div><strong>Payment:</strong> {f.payment_terms}</div>}
          {f.delivery && <div><strong>Delivery:</strong> {f.delivery}</div>}
          {f.packing && <div><strong>Packing:</strong> {f.packing}</div>}
          {f.validity && <div><strong>Validity:</strong> {f.validity}</div>}
          {f.remarks && <div><strong>Remarks:</strong> {f.remarks}</div>}
        </div>
      </div>
    </Modal>
  );
}
