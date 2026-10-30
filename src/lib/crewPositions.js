export const crewPositions = (c) => (c?.positions?.length ? c.positions : c?.position ? [c.position] : []);
export const hasPosition = (c, p) => crewPositions(c).includes(p);