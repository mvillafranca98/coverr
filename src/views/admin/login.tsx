import type { FC } from "hono/jsx";
import { AdminLayout } from "./layout";

export const LoginPage: FC<{ sent?: boolean; error?: string }> = ({ sent, error }) => (
  <AdminLayout title="Coverr — Admin">
    <div style="max-width:400px;margin:60px auto 0">
      <div style="font-family:var(--mono);font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--accent)">
        Coverr
      </div>
      <h1 style="margin-top:8px">Panel de la banda</h1>
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
          <button class="btn" style="margin-top:12px;width:100%" type="submit">
            Enviar enlace
          </button>
          <p class="sub" style="margin-top:18px">
            ¿Todavía no tenés banda? <a href="/registro">Creala acá</a>
          </p>
        </form>
      )}
    </div>
  </AdminLayout>
);
