export function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="summary-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
