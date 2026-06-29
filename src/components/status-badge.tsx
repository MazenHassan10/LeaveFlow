export function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`status status-${value.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
      {value}
    </span>
  );
}
