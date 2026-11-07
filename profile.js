// Distance is measured inward from the lower longitudinal edge (x = d/2).
// Cell-centred values are interpolated across the thickness. Near the edges,
// use the nearest cell centre without inventing an uncomputed boundary value.
export function saturationProfile(result, snapshot, distance) {
  const thickness = result.p.thickness;
  const offset = Math.max(0, Math.min(thickness, distance));
  const column = Math.max(0, Math.min(result.nx - 1,
    (thickness - offset) / result.dx - 0.5));
  const left = Math.floor(column);
  const right = Math.min(result.nx - 1, left + 1);
  const weight = column - left;
  return Array.from({length: result.ny}, (_, row) => {
    const start = row * result.nx;
    return {
      position: (row + 0.5) * result.dy,
      saturation: snapshot.s[start + left] * (1 - weight)
        + snapshot.s[start + right] * weight,
      strength: result.p.strength * (snapshot.soft[start + left] * (1 - weight)
        + snapshot.soft[start + right] * weight),
      meanStrength: snapshot.strengthRows[row],
      stress: snapshot.stressRows[row],
      fractureEligible: row > 1
    };
  });
}
