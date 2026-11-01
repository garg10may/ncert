/** A rolling half-cylinder with a gentle diagonal fold; dimensions are page-width units. */
export function curlPoint(u: number, v: number, progress: number, aspect: number) {
  const p = Math.max(0, Math.min(1, progress));
  const lift = Math.sin(Math.PI * p);
  const radius = .08 + .08 * lift;
  const fold = 1 - p - Math.PI * radius * p + .18 * (v - .5) * lift;
  const bend = (s: number) => {
    const distance = s - fold;
    const angle = Math.max(0, Math.min(Math.PI, distance / radius));
    return {
      x: distance <= 0 ? s : fold + radius * Math.sin(angle) - Math.max(0, distance - Math.PI * radius),
      z: radius * (1 - Math.cos(angle)),
      angle,
    };
  };
  const point = bend(u);
  const hinge = bend(0);
  const z = point.z - hinge.z;
  return { x: point.x - hinge.x, y: aspect * (.5 + (v - .5) * (1 - .12 * z)), z, angle: point.angle };
}
