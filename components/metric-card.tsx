export function MetricCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <article className="card">
      <div className="badge primary">{label}</div>
      <div className="metric">{value}</div>
      <div className="muted">{hint}</div>
    </article>
  );
}
