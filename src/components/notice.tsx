export function Notice({ children, variant = "warning" }: { children: React.ReactNode; variant?: "warning" | "info" }) {
  return <p className={`notice ${variant}`}>{children}</p>;
}
