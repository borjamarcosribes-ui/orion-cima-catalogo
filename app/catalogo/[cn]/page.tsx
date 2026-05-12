import Link from 'next/link';
import { notFound } from 'next/navigation';
import type React from 'react';

import { getCatalogDetailByCn } from '@/lib/catalog';

type PageProps = {
  params: Promise<{ cn: string }>;
};

type DetailFieldProps = {
  label: string;
  value: React.ReactNode;
  emphasized?: boolean;
};

type BadgeDescriptor = {
  label: string;
  className: string;
};

function commercializationBadge(status: string): BadgeDescriptor {
  if (status === 'COMERCIALIZADO') {
    return { label: 'Comercializado', className: 'badge success' };
  }

  if (status === 'NO_COMERCIALIZADO') {
    return { label: 'No comercializado', className: 'badge danger' };
  }

  return { label: status, className: 'badge' };
}

function bifimedBadge(status: string): BadgeDescriptor {
  if (status === 'FINANCIADO') {
    return { label: 'Financiación: FINANCIADO', className: 'badge success' };
  }

  if (status === 'NO_FINANCIADO') {
    return { label: 'Financiación: NO_FINANCIADO', className: 'badge danger' };
  }

  if (status === 'EN_ESTUDIO') {
    return { label: 'Financiación: EN_ESTUDIO', className: 'badge warning' };
  }

  return { label: `Financiación: ${status}`, className: 'badge' };
}

function unitDoseBadge(isUnitDose: boolean | null): BadgeDescriptor {
  if (isUnitDose === true) {
    return { label: 'Dosis unitaria: Sí', className: 'badge success' };
  }

  if (isUnitDose === false) {
    return { label: 'No consta dosis unitaria', className: 'badge warning' };
  }

  return { label: 'Sin dato SCMFH', className: 'badge' };
}

function formatUnitDoseAvailability(isUnitDose: boolean | null): string {
  if (isUnitDose === true) {
    return 'Sí';
  }

  if (isUnitDose === false) {
    return 'No consta';
  }

  return 'Sin dato';
}

function unitDoseDescription(isUnitDose: boolean | null): string {
  if (isUnitDose === true) {
    return 'No requiere reenvasado según caché SCMFH.';
  }

  if (isUnitDose === false) {
    return 'SCMFH no marca este CN como disponible en dosis unitaria.';
  }

  return 'No hay dato SCMFH persistido para este CN.';
}

function supplyBadge(status: string): BadgeDescriptor {
  if (status === 'Sin problemas de suministro') {
    return { label: `Suministro: ${status}`, className: 'badge success' };
  }

  if (status === 'Con problemas de suministro') {
    return { label: `Suministro: ${status}`, className: 'badge warning' };
  }

  return { label: `Suministro: ${status}`, className: 'badge' };
}

function formatDate(value: string | null): string {
  if (!value) {
    return 'Sin dato';
  }

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function DetailField({ label, value, emphasized = false }: DetailFieldProps): React.ReactElement {
  return (
    <div
      style={{
        background: emphasized ? 'var(--primary-soft)' : 'var(--surface-alt)',
        border: emphasized ? '1px solid rgba(15, 107, 143, 0.16)' : '1px solid var(--border)',
        borderRadius: 14,
        display: 'grid',
        gap: 4,
        minHeight: 84,
        padding: '12px 14px',
      }}
    >
      <small className="muted" style={{ fontWeight: 750 }}>
        {label}
      </small>
      <div
        style={{
          color: emphasized ? 'var(--primary-strong)' : 'var(--text)',
          fontWeight: emphasized ? 850 : 650,
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div
      className="muted"
      style={{
        background: 'var(--surface-alt)',
        border: '1px dashed var(--border-strong)',
        borderRadius: 14,
        padding: '14px 16px',
      }}
    >
      {children}
    </div>
  );
}

function renderDocLink(label: string, href: string | null): React.ReactElement | null {
  if (!href) {
    return null;
  }

  return (
    <a href={href} target="_blank" rel="noreferrer" className="secondary-button">
      {label}
    </a>
  );
}

export default async function CatalogDetailPage({ params }: PageProps) {
  const { cn } = await params;
  const detail = await getCatalogDetailByCn(cn);

  if (!detail) {
    notFound();
  }

  const hasDocumentLinks = Boolean(
    detail.technicalSheetUrl || detail.leafletUrl || detail.docsHtmlUrl || detail.leafletHtmlUrl,
  );
  const commercialization = commercializationBadge(detail.commercializationStatus);
  const supply = detail.supplyStatus ? supplyBadge(detail.supplyStatus) : null;
  const unitDose = unitDoseBadge(detail.isUnitDose);
  const bifimedFunding = detail.bifimedFundingStatus ? bifimedBadge(detail.bifimedFundingStatus) : null;
  const hasBifimedData = Boolean(
    detail.bifimedFundingStatus ||
      detail.bifimedModality ||
      detail.bifimedRestrictedConditions ||
      detail.bifimedSpecialFundingConditions ||
      detail.bifimedNomenclatorState ||
      detail.bifimedSummary,
  );

  return (
    <div className="grid" style={{ gap: 22 }}>
      <section
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(223, 240, 246, 0.72))',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            background: 'linear-gradient(135deg, rgba(15, 107, 143, 0.16), rgba(8, 122, 85, 0.06))',
            borderRadius: 999,
            height: 190,
            position: 'absolute',
            right: -72,
            top: -112,
            width: 190,
          }}
        />
        <div className="section-title" style={{ alignItems: 'flex-start', gap: 18, position: 'relative' }}>
          <div style={{ display: 'grid', gap: 10 }}>
            <span className="badge primary" style={{ width: 'fit-content' }}>
              Ficha de medicamento
            </span>
            <div>
              <div className="muted" style={{ fontSize: '0.86rem', fontWeight: 800, letterSpacing: '0.06em' }}>
                CN {detail.cn}
              </div>
              <h1 style={{ letterSpacing: '-0.04em', lineHeight: 1.06, margin: '4px 0 0' }}>
                {detail.officialName ?? detail.presentation}
              </h1>
              <p className="muted" style={{ margin: '10px 0 0', maxWidth: 860 }}>
                {detail.presentation}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end', maxWidth: 520 }}>
            <span className={detail.includedInHospital ? 'badge success' : 'badge warning'}>
              Incluido en hospital: {detail.includedInHospital ? 'Sí' : 'No'}
            </span>
            {detail.hospitalStatusOriginal ? <span className="badge">Orion: {detail.hospitalStatusOriginal}</span> : null}
            <span className={commercialization.className}>{commercialization.label}</span>
            {supply ? <span className={supply.className}>{supply.label}</span> : null}
            <span className={unitDose.className}>{unitDose.label}</span>
            {bifimedFunding ? <span className={bifimedFunding.className}>{bifimedFunding.label}</span> : null}
          </div>
        </div>

        <div className="grid cols-3" style={{ gap: 12, position: 'relative' }}>
          <DetailField label="Principio activo" value={detail.activeIngredient ?? 'Sin dato CIMA'} emphasized />
          <DetailField label="Laboratorio" value={detail.laboratory ?? 'Sin dato CIMA'} emphasized />
          <DetailField label="ATC" value={detail.atcCode ?? 'Sin dato CIMA'} emphasized />
        </div>
      </section>

      <section className="card">
        <div className="section-title">
          <div>
            <h2>Identificación CIMA / Nomenclátor</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              Identificadores oficiales y presentación consolidada para el Código Nacional.
            </p>
          </div>
          <span className="badge">CN {detail.cn}</span>
        </div>

        <div className="grid cols-3" style={{ gap: 12 }}>
          <DetailField label="Código Nacional" value={detail.cn} emphasized />
          <DetailField label="Código DCP" value={detail.codDcp} emphasized />
          <DetailField label="Nombre oficial" value={detail.officialName ?? 'Sin dato CIMA'} />
          <div style={{ gridColumn: '1 / -1' }}>
            <DetailField label="Presentación Nomenclátor" value={detail.presentation} />
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-title">
          <div>
            <h2>Bloque hospitalario Orion</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              Información local detectada en la última carga operativa disponible.
            </p>
          </div>
          <span className={detail.includedInHospital ? 'badge success' : 'badge warning'}>
            {detail.includedInHospital ? 'Incluido' : 'No incluido'}
          </span>
        </div>

        <div className="grid cols-2" style={{ gap: 12 }}>
          <DetailField label="Estado hospitalario" value={detail.hospitalStatusOriginal ?? 'No detectado en Orion'} />
          <DetailField label="Código Orion" value={detail.orionCode ?? 'No detectado en Orion'} emphasized />
          <DetailField label="Última detección Orion" value={formatDate(detail.lastDetectedAt)} />
          <DetailField label="Última importación Orion" value={formatDate(detail.lastImportedAt)} />
          <div style={{ gridColumn: '1 / -1' }}>
            <DetailField label="Descripción local" value={detail.localDescription ?? 'Sin descripción local'} />
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-title">
          <div>
            <h2>Preparación / dosis unitaria</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              Información SCMFH persistida en caché local para uso operativo prudente.
            </p>
          </div>
          <span className={unitDose.className}>{unitDose.label}</span>
        </div>

        <p className="muted" style={{ margin: '0 0 16px' }}>
          {unitDoseDescription(detail.isUnitDose)}
        </p>

        <div className="grid cols-2" style={{ gap: 12 }}>
          <DetailField
            label="Disponible en dosis unitaria"
            value={formatUnitDoseAvailability(detail.isUnitDose)}
            emphasized={detail.isUnitDose === true}
          />
          <DetailField
            label="Reenvasado"
            value={detail.isUnitDose === true ? 'No requerido' : 'No determinado por SCMFH'}
            emphasized={detail.isUnitDose === true}
          />
          <DetailField label="Valor SCMFH original" value={detail.unitDoseRaw ?? 'Sin dato'} />
          <DetailField label="Cantidad" value={detail.unitDoseQuantity ?? 'Sin dato'} />
          <DetailField label="Última importación SCMFH" value={formatDate(detail.unitDoseImportedAt)} />
          <DetailField label="Fichero origen SCMFH" value={detail.unitDoseSourceFileName ?? 'Sin dato'} />
        </div>
      </section>

      <section className="card">
        <div className="section-title">
          <div>
            <h2>Datos regulatorios y características</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              Estado CIMA persistido localmente y características normalizadas disponibles.
            </p>
          </div>
          <span className="badge">CIMA</span>
        </div>

        <div className="grid cols-3" style={{ gap: 12 }}>
          <DetailField label="Estado de comercialización" value={detail.commercializationStatus} emphasized />
          <DetailField label="Estado de suministro" value={detail.supplyStatus ?? 'Sin dato CIMA'} />
          <DetailField label="ATC" value={detail.atcCode ?? 'Sin dato CIMA'} emphasized />
          <DetailField label="Principio activo" value={detail.activeIngredient ?? 'Sin dato CIMA'} emphasized />
          <DetailField label="Laboratorio" value={detail.laboratory ?? 'Sin dato CIMA'} emphasized />
          <DetailField label="Código DCP" value={detail.codDcp} />
        </div>

        <div style={{ marginTop: 16 }}>
          <h3 style={{ margin: '0 0 10px' }}>Características CIMA</h3>
          {detail.cimaCharacteristics.length === 0 ? (
            <EmptyNote>Sin características CIMA persistidas para este CN.</EmptyNote>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {detail.cimaCharacteristics.map((item) => (
                <span key={item.normalizedLabel} className="badge">
                  {item.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="section-title">
          <div>
            <h2>Documentación CIMA</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              Enlaces guardados en la caché local CIMA para consulta documental.
            </p>
          </div>
          <span className="badge">Documentos</span>
        </div>

        {hasDocumentLinks ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {renderDocLink('Ficha técnica PDF', detail.technicalSheetUrl)}
            {renderDocLink('Prospecto PDF', detail.leafletUrl)}
            {renderDocLink('Ficha técnica HTML', detail.docsHtmlUrl)}
            {renderDocLink('Prospecto HTML', detail.leafletHtmlUrl)}
          </div>
        ) : (
          <EmptyNote>Documentación CIMA no disponible en la caché local para este CN.</EmptyNote>
        )}
      </section>

      <section className="card">
        <div className="section-title">
          <div>
            <h2>Financiación BIFIMED</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              Resumen de financiación importado en caché local, si existe para este medicamento.
            </p>
          </div>
          <span className="badge primary">Resumen</span>
        </div>

        {!hasBifimedData ? (
          <EmptyNote>Sin datos BIFIMED persistidos para este CN.</EmptyNote>
        ) : (
          <div className="grid cols-2" style={{ gap: 12 }}>
            <DetailField label="Estado financiación" value={detail.bifimedFundingStatus ?? 'Sin dato BIFIMED'} emphasized />
            <DetailField label="Situación de financiación" value={detail.bifimedModality ?? 'Sin dato BIFIMED'} />
            <DetailField
              label="Condiciones financiación restringidas"
              value={detail.bifimedRestrictedConditions ?? 'Sin dato BIFIMED'}
            />
            <DetailField
              label="Condiciones especiales de financiación"
              value={detail.bifimedSpecialFundingConditions ?? 'Sin dato BIFIMED'}
            />
            <DetailField label="Estado de nomenclátor" value={detail.bifimedNomenclatorState ?? 'Sin dato BIFIMED'} />
            <div style={{ gridColumn: '1 / -1' }}>
              <DetailField label="Resumen" value={detail.bifimedSummary ?? 'Sin dato BIFIMED'} />
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <div className="section-title">
          <div>
            <h2>Indicaciones BIFIMED</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              Detalle por indicación importado desde BIFIMED cuando está disponible.
            </p>
          </div>
          <span className="badge">Detalle por indicación</span>
        </div>

        {detail.bifimedIndications.length === 0 ? (
          <EmptyNote>Sin indicaciones BIFIMED persistidas para este CN.</EmptyNote>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Indicación autorizada</th>
                  <th>Situación expediente indicación</th>
                  <th>Resolución expediente de financiación indicación</th>
                </tr>
              </thead>
              <tbody>
                {detail.bifimedIndications.map((item, index) => (
                  <tr key={`${detail.cn}-${index}`}>
                    <td>{item.authorizedIndication}</td>
                    <td>{item.indicationFileStatus ?? 'Sin dato'}</td>
                    <td>{item.indicationFundingResolution ?? 'Sin dato'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div>
        <Link href="/catalogo" className="secondary-button">
          Volver al catálogo
        </Link>
      </div>
    </div>
  );
}
