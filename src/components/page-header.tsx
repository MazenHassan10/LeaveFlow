export function PageHeader({ eyebrow, title, metric, metricLabel }: {
  eyebrow: string;
  title: string;
  metric?: string;
  metricLabel?: string;
}) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      {metric ? (
        <div className="metric">
          <strong>{metric}</strong>
          <span>{metricLabel}</span>
        </div>
      ) : null}
    </header>
  );
}
