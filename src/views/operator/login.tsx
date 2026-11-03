import type { FC } from "hono/jsx";
import { OperatorLayout } from "./layout";

/**
 * Operator sign-in. Says the same thing after any address, operator or not,
 * so the page cannot be used to find out who runs Coverr.
 */
export const OperatorLoginPage: FC<{ sent?: boolean; error?: string }> = ({ sent, error }) => (
  <OperatorLayout title="Coverr — Operación">
    <div class="auth">
      <div class="auth__card">
        <h1>Operación</h1>
        {sent ? (
          <div class="note ok">
            Si ese correo es de un operador, te enviamos un enlace para entrar. Vence en 15 minutos.
          </div>
        ) : (
          <form method="post" action="/operador/acceso">
            <p class="sub">Te mandamos un enlace para entrar. No hay contraseña.</p>
            {error ? <div class="note crit">{error}</div> : null}
            <label class="fl" for="email">
              Correo
            </label>
            <input type="email" name="email" id="email" required autocomplete="email" />
            <button class="btn" type="submit">
              Enviar enlace
            </button>
          </form>
        )}
      </div>
    </div>
  </OperatorLayout>
);
