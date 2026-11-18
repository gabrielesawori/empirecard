export const RANK_TIERS = [
  { name: 'Bronze', step: 10, color: '#bd906f' },
  { name: 'Elite', step: 30, color: '#8ebcb0' },
  { name: 'Master', step: 90, color: '#89b6df' },
  { name: 'Grandmaster', step: 270, color: '#b49ae2' },
  { name: 'Legendary', step: 700, color: '#e0ba6c' },
];
export const SERIES_POINTS = { 1: { win: 10, loss: 5 }, 3: { win: 30, loss: 10 }, 5: { win: 50, loss: 15 } };
export const pointsForSeries = bestOf => SERIES_POINTS[bestOf] || SERIES_POINTS[1];
const LEVELS = ['I', 'II', 'III', 'IV', 'V'];
export function rankFor(points = 0) {
  let remaining = Math.max(0, Math.floor(points));
  for (const tier of RANK_TIERS) {
    if (remaining < tier.step * 5) {
      const division = Math.floor(remaining / tier.step);
      return { name: tier.name, division: LEVELS[division], label: `${tier.name} ${LEVELS[division]}`, progress: remaining % tier.step, required: tier.step, color: tier.color, points };
    }
    remaining -= tier.step * 5;
  }
  return { name: 'God', division: '', label: 'God', progress: 0, required: null, color: '#f4d38a', points };
}
