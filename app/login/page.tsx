import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import LoginForm from '@/app/login/login-form';

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect('/');
  }

  return (
    <div className="grid" style={{ gap: 24, maxWidth: 520, margin: '24px auto' }}>
      <section className="card">
        <div className="section-title">
          <div>
            <div className="badge primary">Acceso</div>
            <h1>Iniciar sesión</h1>
          </div>
        </div>

        <LoginForm />

        <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
          <p className="muted" style={{ margin: 0 }}>
            Si todavía no tienes cuenta, puedes solicitar acceso desde aquí.
          </p>

          <div className="actions-row" style={{ marginTop: 0 }}>
            <Link href="/registro" className="secondary-button">
              Solicitar cuenta
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}