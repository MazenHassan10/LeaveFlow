export function CardList({ empty, children }: { empty: string; children: React.ReactNode[] | React.ReactNode }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children;
  return Array.isArray(items) && items.length === 0
    ? <p className="empty">{empty}</p>
    : <div className="stack">{items}</div>;
}
