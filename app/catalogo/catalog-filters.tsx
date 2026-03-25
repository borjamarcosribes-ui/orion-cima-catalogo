'use client';

import Link from 'next/link';
import { useState } from 'react';

type CatalogFiltersFormProps = {
  q: string;
  activeIngredient: string;
  cn: string;
  laboratory: string;
  atc: string;
  commercialized: string;
  included: string;
  hospitalStatus: string;
  bifimed: string;
};

export function CatalogFiltersForm(props: CatalogFiltersFormProps) {
  const [included, setIncluded] = useState(props.included);
  const [hospitalStatus, setHospitalStatus] = useState(included === 'SI' ? props.hospitalStatus : '');

  return (
    <form method="get" className="grid cols-3" style={{ gap: 12, marginTop: 16 }}>
      <label>
        <small className="muted">Nombre del medicamento</small>
        <input name="q" defaultValue={props.q} />
      </label>

      <label>
        <small className="muted">Principio activo</small>
        <input name="activeIngredient" defaultValue={props.activeIngredient} />
      </label>

      <label>
        <small className="muted">CN</small>
        <input name="cn" defaultValue={props.cn} />
      </label>

      <label>
        <small className="muted">Laboratorio</small>
        <input name="laboratory" defaultValue={props.laboratory} />
      </label>

      <label>
        <small className="muted">ATC</small>
        <input name="atc" defaultValue={props.atc} />
      </label>

      <label>
        <small className="muted">Comercializado</small>
        <select name="commercialized" defaultValue={props.commercialized}>
          <option value="">Todos</option>
          <option value="COMERCIALIZADO">Comercializado</option>
          <option value="NO_COMERCIALIZADO">No comercializado</option>
        </select>
      </label>

      <label>
        <small className="muted">Incluido en hospital</small>
        <select
          name="included"
          value={included}
          onChange={(event) => {
            const nextIncluded = event.target.value;
            setIncluded(nextIncluded);

            if (nextIncluded !== 'SI') {
              setHospitalStatus('');
            }
          }}
        >
          <option value="">Todos</option>
          <option value="SI">Sí</option>
          <option value="NO">No</option>
        </select>
      </label>

      <label>
        <small className="muted">Estado en hospital</small>
        <select
          name="hospitalStatus"
          value={hospitalStatus}
          disabled={included !== 'SI'}
          onChange={(event) => setHospitalStatus(event.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="ACTIVO">Activo</option>
          <option value="INACTIVO">Inactivo</option>
          <option value="LAB">LAB</option>
          <option value="OTROS">Otros estados</option>
        </select>
      </label>

      <label>
        <small className="muted">BIFIMED</small>
        <select name="bifimed" defaultValue={props.bifimed}>
          <option value="">Todos</option>
          <option value="FINANCIADO">Financiado</option>
          <option value="NO_FINANCIADO">No financiado</option>
          <option value="EN_ESTUDIO">En estudio</option>
        </select>
      </label>

      <div className="actions-row" style={{ marginTop: 0 }}>
        <button type="submit" className="primary-button">
          Aplicar filtros
        </button>
        <Link className="secondary-button" href="/catalogo">
          Limpiar
        </Link>
      </div>
    </form>
  );
}