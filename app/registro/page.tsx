import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import RegisterForm from '@/app/registro/register-form';

export default async function RegisterPage() {
  const session = await auth();

  if (session?.user) {
    redirect('/');
  }

  return (
    <div className="grid" style={{ gap: 24, maxWidth: 560, margin: '24px auto' }}>
      <section className="card">
        <div className="section-title">
          <div>
            <div className="badge primary">Alta</div>
            <h1>Solicitar cuenta</h1>
          </div>
        </div>

        <p className="muted" style={{ marginTop: 0 }}>
          La cuenta no quedará activa automáticamente. Un usuario con permisos de
          administración debe aprobarla antes de que puedas iniciar sesión.
        </p>

        <RegisterForm />
      </section>
    </div>
  );
}