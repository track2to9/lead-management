"use client";

import { Input, Typography } from "antd";

const { Text } = Typography;

interface Props {
  footer: Record<string, string>;
  onChange: (footer: Record<string, string>) => void;
}

const FIELDS = [
  { key: "payment_terms", label: "Payment Terms", placeholder: "T/T in 30 days after invoice date" },
  { key: "delivery", label: "Delivery", placeholder: "Within 8 weeks after order confirmation" },
  { key: "packing", label: "Packing", placeholder: "Export standard wooden case" },
  { key: "validity", label: "Validity", placeholder: "31 Jan, 2026" },
  { key: "remarks", label: "Remarks", placeholder: "" },
];

export default function FooterFields({ footer, onChange }: Props) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {FIELDS.map((f) => (
        <div key={f.key}>
          <Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 2 }}>{f.label}</Text>
          {f.key === "remarks" ? (
            <Input.TextArea size="small" rows={2} value={footer[f.key] || ""} placeholder={f.placeholder}
              onChange={(e) => onChange({ ...footer, [f.key]: e.target.value })} />
          ) : (
            <Input size="small" value={footer[f.key] || ""} placeholder={f.placeholder}
              onChange={(e) => onChange({ ...footer, [f.key]: e.target.value })} />
          )}
        </div>
      ))}
    </div>
  );
}
