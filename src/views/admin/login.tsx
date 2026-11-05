import type { FC } from "hono/jsx";
import { CONTACT_EMAIL } from "../legal/constants";
import { AuthShell } from "./auth-shell";
import { AdminLayout } from "./layout";

export const LoginPage: FC<{
  sent?: boolean;
  error?: string;
  /** The session just ended because the operator suspended this band. */
  suspended?: boolean;
}> = ({ sent, error, suspended }) => (
  <AdminLayout
    title="Coverr — Admin"
    description="Entrá al panel de tu banda en Coverr con un enlace a tu correo. Sin contraseña."
  >
    <AuthShell>
      <h1>Panel de la banda</h1>
      {suspended ? (
        <div class="note crit">
          Esta cuenta está suspendida. Si creés que es un error, escribinos a{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </div>
      ) : null}
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

/**
 * Where a sign-in link lands: one button that spends the link and opens the
 * panel. Opening the link does not spend it on its own, because mail filters
 * open links to scan them, and a link spent by a scanner would greet the band
 * with "ya se usó" the moment they tapped it.
 */
export const SignInConfirmPage: FC<{ bandName: string; token: string }> = ({ bandName, token }) => (
  <AdminLayout title="Entrar — Coverr">
    <AuthShell>
      <h1>Entrar a {bandName}</h1>
      <form method="post" action="/admin/entrar">
        <p class="sub">Tocá el botón para abrir el panel. Este enlace sirve una sola vez.</p>
        <input type="hidden" name="t" value={token} />
        <button class="btn" type="submit">
          Entrar
        </button>
      </form>
    </AuthShell>
  </AdminLayout>
);

/**
 * Where a creation link from /registro lands. The band is created on the tap,
 * not on the opening, so a mail filter scanning the link creates nothing.
 */
/**
 * Where an email-change link lands: one button, so a mail filter opening the
 * link neither spends it nor moves the band.
 */
export const EmailChangeConfirmPage: FC<{ bandName: string; email: string; token: string }> = ({
  bandName,
  email,
  token,
}) => (
  <AdminLayout title="Confirmar el correo — Coverr">
    <AuthShell>
      <h1>Confirmar el correo de {bandName}</h1>
      <form method="post" action="/admin/correo">
        <p class="sub">
          Desde ahora {bandName} entra a Coverr con <b>{email}</b>. Este enlace sirve una sola vez.
        </p>
        <input type="hidden" name="t" value={token} />
        <button class="btn" type="submit">
          Confirmar el correo
        </button>
      </form>
    </AuthShell>
  </AdminLayout>
);

export const CreateBandConfirmPage: FC<{ bandName: string; token: string }> = ({
  bandName,
  token,
}) => (
  <AdminLayout title="Crear la banda — Coverr">
    <AuthShell>
      <h1>Crear {bandName}</h1>
      <form method="post" action="/admin/crear">
        <p class="sub">
          Tocá el botón para crear la banda y entrar a su panel. Este enlace sirve una sola vez.
        </p>
        <input type="hidden" name="t" value={token} />
        <button class="btn" type="submit">
          Crear la banda
        </button>
      </form>
    </AuthShell>
  </AdminLayout>
);
