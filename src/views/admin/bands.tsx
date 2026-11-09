import type { FC } from "hono/jsx";
import type { BandOfEmail } from "../../lib/band-identity";
import { TEXT_LIMITS } from "../../lib/text-limits";
import { CONTACT_EMAIL } from "../legal/constants";
import { AdminLayout } from "./layout";

/**
 * Every band the signed-in person runs, the way between them, and where to
 * start another. Reached from the band's name in the top bar, and where a
 * sign-in lands when the address runs more than one band.
 *
 * `email` is the address the session proved by its sign-in link, which is
 * still this band's own: a session from another address never gets here.
 */
export const BandsPage: FC<{
  bandName: string;
  currentBandId: string;
  email: string;
  bands: BandOfEmail[];
  error?: string;
}> = ({ bandName, currentBandId, email, bands, error }) => {
  const suspended = bands.some((band) => band.bannedAt);
  return (
    <AdminLayout title={`Tus bandas — ${bandName}`} bandName={bandName}>
      <h1>Tus bandas</h1>
      <p class="sub">
        Las bandas que entran con <b>{email}</b>. Cada una tiene sus propios eventos, cuentas,
        integrantes y plata.
      </p>
      {error ? <div class="note crit">{error}</div> : null}

      <div class="scroll">
        <table class="bands-table">
          <tbody>
            {bands.map((band) => (
              <tr key={band.id}>
                <td>{band.name}</td>
                <td class="right">
                  {band.id === currentBandId ? (
                    <span class="chip ok">Estás acá</span>
                  ) : band.bannedAt ? (
                    <span class="chip crit">Suspendida</span>
                  ) : (
                    <form method="post" action="/admin/bandas/cambiar">
                      <input type="hidden" name="band_id" value={band.id} />
                      <button class="btn sm" type="submit">
                        Entrar
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!suspended ? (
        <>
          <h2>Crear otra banda</h2>
          <form method="post" action="/admin/bandas/nueva" class="inline">
            <div style="flex:1;min-width:200px">
              <label class="fl" for="new_band_name">
                Nombre de la banda
              </label>
              <input
                type="text"
                name="name"
                id="new_band_name"
                required
                maxlength={TEXT_LIMITS.name}
              />
            </div>
            <button class="btn" type="submit">
              Crear banda
            </button>
          </form>
        </>
      ) : null}
      {suspended ? (
        <div class="note warn">
          Una de tus bandas está suspendida, así que por ahora no podés crear bandas nuevas.
          Escribinos a <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </div>
      ) : null}
    </AdminLayout>
  );
};
