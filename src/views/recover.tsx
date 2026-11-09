import type { FC } from "hono/jsx";
import { Layout } from "./layout";
import { LegalLinks } from "./legal/links";

/**
 * Deliberately says the same thing whether or not the address is registered.
 * "Correo no registrado" would let anyone check who bought a ticket, which is
 * a privacy leak for a small scene where everyone knows everyone.
 */
export const RecoverPage: FC<{ sent?: boolean; error?: string }> = ({ sent, error }) => (
  <Layout title="Recuperar mis boletos">
    <header class="hero">
      <div class="band">Coverr</div>
      <h1>Recuperar mis boletos</h1>
      <p class="blurb">
        Escribí el correo que usaste al comprar y te mandamos tus boletos para los eventos que
        vienen.
      </p>
    </header>

    {sent ? (
      <div class="step">
        <div class="free" style="margin-top:0">
          <span>✓</span>
          <div>
            Si ese correo tiene boletos para un evento que viene, ya te los enviamos. Revisá tu
            bandeja de entrada — y también la carpeta de spam.
          </div>
        </div>
        <p class="hint" style="margin-top:16px">
          ¿No llegó nada en unos minutos? Puede que hayás comprado con otro correo. Escribile a la
          banda y te ayudan.
        </p>
      </div>
    ) : (
      <form method="post" action="/recuperar">
        <section class="step">
          {error ? (
            <div class="err" style="margin-bottom:14px">
              {error}
            </div>
          ) : null}
          <label class="fl" for="email">
            Correo electrónico
          </label>
          <input
            type="email"
            name="email"
            id="email"
            required
            autocomplete="email"
            placeholder="vos@ejemplo.com"
          />
          <button type="submit" class="submit">
            Reenviar mis boletos
          </button>
        </section>
      </form>
    )}

    <footer>
      <div>Coverr</div>
      <LegalLinks />
    </footer>
  </Layout>
);
