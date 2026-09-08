import type { FC } from "hono/jsx";
import { AdminLayout } from "./admin";

/**
 * Band signup. Deliberately two fields: a musician arriving from a link in a
 * DM will not fill in a form with eight. Everything else — bank accounts,
 * members, splits — is asked for once they are inside and can see why it
 * matters.
 *
 * No password. The magic link that logs them in is the same one used forever
 * after, so there is nothing to forget and nothing to leak.
 */
export const SignupPage: FC<{ error?: string; name?: string; email?: string }> = ({
  error,
  name,
  email,
}) => (
  <AdminLayout title="Crear tu banda — Coverr">
    <div style="max-width:420px;margin:52px auto 0">
      <div style="font-family:var(--mono);font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--accent)">
        Coverr
      </div>
      <h1 style="margin-top:8px">Crear tu banda</h1>
      <p class="sub">
        Sin contraseña. Te mandamos un enlace para entrar cada vez.
      </p>
      {error ? <div class="note crit">{error}</div> : null}
      <form method="post" action="/registro">
        <label class="fl" for="name">
          Nombre de la banda
        </label>
        <input type="text" name="name" id="name" required value={name ?? ""} placeholder="daydrinking" />

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
        <p class="sub" style="margin:6px 0 0">
          Con este correo entrás al panel, y es el que ven tus compradores para escribirte.
        </p>

        <button class="btn" type="submit" style="margin-top:18px;width:100%">
          Crear
        </button>
      </form>
      <p class="sub" style="margin-top:20px">
        ¿Ya tenés banda? <a href="/admin/acceso">Entrar</a>
      </p>
    </div>
  </AdminLayout>
);

export const SignupSentPage: FC<{ email: string }> = ({ email }) => (
  <AdminLayout title="Revisá tu correo — Coverr">
    <div style="max-width:420px;margin:52px auto 0">
      <div style="font-family:var(--mono);font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--accent)">
        Coverr
      </div>
      <h1 style="margin-top:8px">Revisá tu correo</h1>
      <div class="note ok">
        Te mandamos un enlace a <b>{email}</b>. Tocalo para entrar — vence en 15 minutos.
      </div>
      <p class="sub">
        Si no llega en un par de minutos, revisá la carpeta de spam.
      </p>
    </div>
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
      <ol style="margin:10px 0 0;padding-left:20px">
        {steps.map((x) => (
          <li key={x.label} style={x.done ? "color:var(--dim);text-decoration:line-through" : ""}>
            {x.label}
            {x.done ? null : <span style="color:var(--muted)"> — {x.why}</span>}
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
