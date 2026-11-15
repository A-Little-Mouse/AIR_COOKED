import type { BodyDef } from '../../solar/bodies.ts';
import type { Snapshot } from '../engine.ts';
import { fmtDistance, fmtHours, fmtInt, fmtLightTime } from '../format.ts';

const fmtMetres = (m: number) => (m < 10 ? `${m.toFixed(1)} m` : `${Math.round(m)} m`);

const TYPE_LABEL = { star: 'Star', planet: 'Planet', moon: 'Moon', lander: 'Lander / rover', satellite: 'Satellite' } as const;

export default function InfoCard({ def, snap }: { def: BodyDef; snap: Snapshot | null }) {
  const live = snap && snap.selectedId === def.id ? snap : null;
  return (
    <section className="panel info">
      <div className="type">{TYPE_LABEL[def.type]}</div>
      <h2>{def.name}</h2>
      <p className="desc">{def.info}</p>
      <dl>
        {def.craft ? (
          <>
            {def.facts?.map(([k, v]) => (<span key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v}</dd></span>))}
            <dt>Approx. size</dt><dd>{fmtMetres(def.radiusKm * 2000)}</dd>
          </>
        ) : (
          <><dt>Diameter</dt><dd>{fmtInt(def.radiusKm * 2)} km</dd>
          <dt>Rotation</dt><dd>{fmtHours(def.rotationHours)}</dd></>
        )}
        {def.type !== 'star' && live && def.type === 'planet' && (<><dt>From the Sun</dt><dd>{fmtDistance(live.distFromSunKm)} · {fmtLightTime(live.distFromSunKm)} of light</dd></>)}
        {live && (<><dt>Your altitude</dt><dd>{fmtDistance(live.altitudeKm)}</dd></>)}
      </dl>
    </section>
  );
}
