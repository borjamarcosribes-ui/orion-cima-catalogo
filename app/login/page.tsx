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
      </section>
    </div>
  );
}