import type { FC } from "hono/jsx";
import { AuthShell } from "./admin/auth-shell";
import { AdminLayout } from "./admin/layout";
import { type DemoShow, pickDemoShow } from "./demo-shows";

/**
 * Band signup. Deliberately two fields: a musician arriving from a link in a
 * DM will not fill in a form with eight. Everything else — bank accounts,
 * members, splits — is asked for once they are inside and can see why it
 * matters.
 *
 * No password. The magic link that logs them in is the same one used forever
 * after, so there is nothing to forget and nothing to leak.
 */
export const SignupPage: FC<{
  error?: string;
  name?: string;
  email?: string;
  /** The invented show its examples come from; a random one unless given. */
  example?: DemoShow;
}> = ({ error, name, email, example = pickDemoShow() }) => (
  <AdminLayout
    title="Crear tu banda — Coverr"
    description="Creá tu banda en Coverr: preventa con el dinero directo a tu cuenta, códigos QR al instante, entrada sin señal y el reparto al final."
  >
    <AuthShell>
      <h1>Crear tu banda</h1>
      <p class="sub">Sin contraseña. Te mandamos un enlace para entrar cada vez.</p>
      {error ? <div class="note crit">{error}</div> : null}
      <form method="post" action="/registro">
        <label class="fl" for="name">
          Nombre de la banda
        </label>
        <input
          type="text"
          name="name"
          id="name"
          required
          value={name ?? ""}
          placeholder={example.band}
        />

        <label class="fl" for="email">
          Correo
        </label>
        <input
          type="email"
          name="email"
          id="email"
          required
          autocomplete="email"
          value={email ?? ""}
        />
        <p class="auth__hint">
          Con este correo entrás al panel, y es el que ven tus compradores para escribirte.
        </p>

        <button class="btn" type="submit">
          Crear
        </button>
      </form>
      <p class="auth__alt">
        ¿Ya tenés banda? <a href="/admin/acceso">Entrar</a>
      </p>
    </AuthShell>
  </AdminLayout>
);

export const SignupSentPage: FC<{ email: string }> = ({ email }) => (
  <AdminLayout title="Revisá tu correo — Coverr">
    <AuthShell>
      <h1>Revisá tu correo</h1>
      <div class="note ok">
        Te mandamos un enlace a <b>{email}</b>. Tocalo para crear tu banda y entrar a su panel —
        sirve una sola vez y vence en 15 minutos.
      </div>
      <p class="sub">Si no llega en un par de minutos, revisá la carpeta de spam.</p>
    </AuthShell>
  </AdminLayout>
);

/**
 * Shown on the band home until the band can actually sell. Ordered by what
 * blocks what: no bank account means no publishable event, so it comes first.
 */
export const OnboardingChecklist: FC<{
  hasAccount: boolean;
  hasMembers: boolean;
  hasEvent: boolean;
}> = ({ hasAccount, hasMembers, hasEvent }) => {
  const steps = [
    {
      done: hasAccount,
      label: "Agregá tu cuenta bancaria",
      why: "Es a donde te transfieren. Sin esto no podés publicar un evento.",
      href: "/admin/banda",
      cta: "Agregar cuenta",
    },
    {
      done: hasMembers,
      label: "Agregá a los integrantes",
      why: "Para repartir las ganancias al final.",
      href: "/admin/banda",
      cta: "Agregar integrantes",
    },
    {
      done: hasEvent,
      label: "Creá tu primer evento",
      why: "Te da el enlace que ponés en el flyer o la bio.",
      href: "/admin/nuevo",
      cta: "Crear evento",
    },
  ];
  const next = steps.find((x) => !x.done);
  if (!next) return null;

  return (
    <div class="note warn">
      <b>Te falta poco para vender.</b>
      {/* The note's own ink throughout: the band greys are made for the dark page
          and all but vanish on yellow. A done step reads from its strikethrough. */}
      <ol style="margin:10px 0 0;padding-left:20px">
        {steps.map((x) => (
          <li key={x.label} style={x.done ? "text-decoration:line-through" : ""}>
            {x.label}
            {x.done ? null : <span> — {x.why}</span>}
          </li>
        ))}
      </ol>
      <div style="margin-top:12px">
        <a class="btn sm" href={next.href} style="text-decoration:none;display:inline-block">
          {next.cta}
        </a>
      </div>
    </div>
  );
};
