import { Card } from "./ui/card";

export function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="summary-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </Card>
  );
}
