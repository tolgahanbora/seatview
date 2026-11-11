import { buildDemoSeats, SeedSeat } from './hall-seed';

export { INITIAL_RESERVED } from './hall-seed';

export type DemoHallSeat = SeedSeat;

/** `src/hall.js` ile aynı kuralı `hall-seed.ts` üzerinden uygular (Jest + Nest uyumlu). */
export async function loadHallSeatsFromDemo(): Promise<DemoHallSeat[]> {
  return buildDemoSeats();
}
