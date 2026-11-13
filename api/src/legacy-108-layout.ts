import { buildDemoSeats, type SeedSeat } from './hall-seed';
import { DEFAULT_CATEGORIES, emptyPlanLayout, type PlanLayout } from './plan/plan-layout.types';

/** `src/hall.js` ile aynı koltuk koordinatları (metre). */
export function legacy108SeatPosition(row: string, column: number) {
  const rowIndex = row.charCodeAt(0) - 'A'.charCodeAt(0);
  const columnIndex = column - 1;
  return {
    x:
      (columnIndex - 5.5) * 0.64 +
      (columnIndex < 3 ? -0.52 : columnIndex >= 9 ? 0.52 : 0),
    y: rowIndex * 0.25,
    z: 5.18 + rowIndex * 1.12,
  };
}

export function buildLegacy108PlanLayout(seats: SeedSeat[] = buildDemoSeats()): PlanLayout {
  return {
    screen: { width: 9.2, bottom: 1.55, height: 4.2 },
    calibration: {
      version: 1,
      unit: 'm',
      calibrated: false,
      eyeHeightM: 1.14,
      screenTarget: { x: 0, y: 3.65, z: 0 },
    },
    sections: [{ id: 'main', name: 'Ana salon' }],
    categories: [...DEFAULT_CATEGORIES, { id: 'cat-recl', name: 'Recliner', color: '#76363b', defaultPrice: 420 }],
    rowBlocks: [],
    seats: seats.map((seat) => {
      const pos = legacy108SeatPosition(seat.row, seat.column);
      return {
        uid: seat.id,
        label: seat.id,
        row: seat.row,
        column: seat.column,
        sectionId: 'main',
        categoryId:
          seat.category === 'Recliner'
            ? 'cat-recl'
            : seat.category === 'VIP'
              ? 'cat-vip'
              : 'cat-std',
        x: pos.x,
        y: pos.y,
        z: pos.z,
      };
    }),
  };
}

export function demoSeatPositions(seat: Pick<SeedSeat, 'row' | 'column'>) {
  return legacy108SeatPosition(seat.row, seat.column);
}
