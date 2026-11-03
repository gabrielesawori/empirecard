export const RANK_TIERS = [
  { name: 'Bronze', step: 10, color: '#bd906f' },
  { name: 'Elite', step: 20, color: '#8ebcb0' },
  { name: 'Master', step: 40, color: '#89b6df' },
  { name: 'Grandmaster', step: 80, color: '#b49ae2' },
  { name: 'Legendary', step: 160, color: '#e0ba6c' },
];
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
