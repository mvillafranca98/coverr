import type { FC } from "hono/jsx";
import { AuthShell } from "./auth-shell";
import { AdminLayout } from "./layout";

export const LoginPage: FC<{ sent?: boolean; error?: string }> = ({ sent, error }) => (
  <AdminLayout
    title="Coverr — Admin"
    description="Entrá al panel de tu banda en Coverr con un enlace a tu correo. Sin contraseña."
  >
    <AuthShell>
      <h1>Panel de la banda</h1>
      {sent ? (
        <div class="note ok">
          Si ese correo pertenece a una banda, te enviamos un enlace para entrar. Revisá tu bandeja
          — el enlace vence en 15 minutos.
        </div>
      ) : (
        <form method="post" action="/admin/login">
          <p class="sub">Te mandamos un enlace para entrar. No hay contraseña.</p>
          {error ? <div class="note crit">{error}</div> : null}
          <label class="fl" for="email">
            Correo de la banda
          </label>
          <input type="email" name="email" id="email" required autocomplete="email" />
          <button class="btn" type="submit">
            Enviar enlace
          </button>
          <p class="auth__alt">
            ¿Todavía no tenés banda? <a href="/registro">Creala acá</a>
          </p>
        </form>
      )}
    </AuthShell>
  </AdminLayout>
);
