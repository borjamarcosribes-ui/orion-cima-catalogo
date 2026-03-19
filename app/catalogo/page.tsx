import { catalogDemoRows } from '@/lib/demo-data';

export default function CatalogPage() {
  return (
    <div className="grid" style={{ gap: 24 }}>
      <section className="card">
        <div className="section-title">
          <div>
            <div className="badge primary">Catálogo operativo</div>
            <h1>Vista demo del catálogo consolidado por CN</h1>
          </div>
          <span className="badge success">Proyección demo, no lectura real desde Prisma</span>
        </div>
        <p className="muted">
          Esta tabla es una proyección demo alineada con el dominio del catálogo, no una lectura directa de la tabla
          medicines_master. Sirve para mostrar cómo se vería el catálogo cuando exista persistencia real.
        </p>
      </section>

      <section className="card">
        <table className="table">
          <thead>
            <tr>
              <th>CN</th>
              <th>Etiqueta preferente</th>
              <th>Código Orion</th>
              <th>Último snapshot</th>
              <th>Estado CIMA</th>
            </tr>
          </thead>
          <tbody>
            {catalogDemoRows.map((medicine) => (
              <tr key={medicine.nationalCode}>
                <td><strong>{medicine.nationalCode}</strong></td>
                <td>{medicine.preferredLabel}</td>
                <td>{medicine.latestOrionCode}</td>
                <td>{medicine.latestSnapshotLabel}</td>
                <td><span className="badge warning">{medicine.cimaEnrichmentStatus}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
