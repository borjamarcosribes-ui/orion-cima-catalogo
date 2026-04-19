import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import {
  approveUserAction,
  rejectUserAction,
} from '@/app/usuarios/actions';
import { prisma } from '@/lib/prisma';

type AppRole = 'ADMIN' | 'LECTURA';
type UserApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

function formatDate(value: Date | null): string {
  if (!value) {
    return '—';
  }

  return value.toLocaleString('es-ES');
}

function formatApprovalStatus(status: UserApprovalStatus): string {
  switch (status) {
    case 'PENDING':
      return 'Pendiente';
    case 'APPROVED':
      return 'Aprobada';
    case 'REJECTED':
      return 'Rechazada';
    default:
      return status;
  }
}

export default async function UsuariosPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const role =
    ((session.user as typeof session.user & { role?: AppRole }).role ??
      'LECTURA') as AppRole;

  if (role !== 'ADMIN') {
    redirect('/');
  }

  const [pendingUsers, recentUsers] = await Promise.all([
    prisma.appUser.findMany({
      where: {
        approvalStatus: 'PENDING',
      },
      orderBy: {
        requestedAt: 'asc',
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        requestedAt: true,
        createdAt: true,
      },
    }),
    prisma.appUser.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        isActive: true,
        approvalStatus: true,
        requestedAt: true,
        approvedAt: true,
        rejectedAt: true,
        createdAt: true,
      },
    }),
  ]);

  return (
    <div className="grid" style={{ gap: 24 }}>
      <section className="card">
        <div className="section-title">
          <div>
            <div className="badge primary">Administración</div>
            <h1>Gestión de usuarios</h1>
          </div>
        </div>

        <p className="muted" style={{ margin: 0 }}>
          Desde aquí puedes aprobar o rechazar solicitudes de alta. Las nuevas
          cuentas se crean con rol de lectura y quedan inactivas hasta su
          aprobación.
        </p>
      </section>

      <section className="card">
        <div className="section-title">
          <h2>Solicitudes pendientes</h2>
          <span className="badge">{pendingUsers.length}</span>
        </div>

        {pendingUsers.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No hay solicitudes pendientes.
          </p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Solicitada</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pendingUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{user.displayName ?? 'Sin nombre'}</td>
                    <td>{user.email}</td>
                    <td>{formatDate(user.requestedAt ?? user.createdAt)}</td>
                    <td>
                      <div
                        className="actions-row"
                        style={{ marginTop: 0, flexWrap: 'nowrap' }}
                      >
                        <form action={approveUserAction}>
                          <input type="hidden" name="userId" value={user.id} />
                          <button type="submit" className="primary-button">
                            Aprobar
                          </button>
                        </form>

                        <form action={rejectUserAction}>
                          <input type="hidden" name="userId" value={user.id} />
                          <button type="submit" className="secondary-button">
                            Rechazar
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="section-title">
          <h2>Usuarios recientes</h2>
          <span className="badge">{recentUsers.length}</span>
        </div>

        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Aprobación</th>
                <th>Activa</th>
                <th>Creada</th>
              </tr>
            </thead>
            <tbody>
              {recentUsers.map((user) => (
                <tr key={user.id}>
                  <td>{user.displayName ?? 'Sin nombre'}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>{formatApprovalStatus(user.approvalStatus as UserApprovalStatus)}</td>
                  <td>{user.isActive ? 'Sí' : 'No'}</td>
                  <td>{formatDate(user.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}