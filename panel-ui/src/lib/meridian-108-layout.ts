/**
 * Meridian demo seed ile aynı 108 koltuk (Salon 03 · A–I × 12).
 * Koordinatlar api/src/legacy-108-layout.ts ile uyumlu.
 */
import {
  DEFAULT_CATEGORIES,
  newUid,
  type PlanCategory,
  type PlanLayout,
  type PlanSeat,
} from '@/lib/plan-layout'

const ROWS = 'ABCDEFGHI'

function legacy108SeatPosition(row: string, column: number) {
  const rowIndex = row.charCodeAt(0) - 'A'.charCodeAt(0)
  const columnIndex = column - 1
  return {
    x:
      (columnIndex - 5.5) * 0.64 +
      (columnIndex < 3 ? -0.52 : columnIndex >= 9 ? 0.52 : 0),
    y: rowIndex * 0.25,
    z: 5.18 + rowIndex * 1.12,
  }
}

function categoryForRow(rowIndex: number): string {
  return rowIndex >= 7 ? 'cat-recl' : 'cat-std'
}

const MERIDIAN_CATEGORIES: PlanCategory[] = [
  ...DEFAULT_CATEGORIES,
  { id: 'cat-recl', name: 'Recliner', color: '#76363b', defaultPrice: 420 },
]

export function buildMeridian108Layout(): PlanLayout {
  const seats: PlanSeat[] = []
  for (const row of ROWS) {
    const rowIndex = row.charCodeAt(0) - 'A'.charCodeAt(0)
    const categoryId = categoryForRow(rowIndex)
    for (let column = 1; column <= 12; column += 1) {
      const pos = legacy108SeatPosition(row, column)
      const label = `${row}${column}`
      seats.push({
        uid: newUid(),
        label,
        row,
        column,
        sectionId: 'main',
        categoryId,
        x: pos.x,
        y: pos.y,
        z: pos.z,
      })
    }
  }

  return {
    screen: { width: 9.2, bottom: 1.55, height: 4.2 },
    calibration: {
      version: 1,
      unit: 'm',
      calibrated: false,
      eyeHeightM: 1.14,
      screenTarget: { x: 0, y: 3.65, z: 0 },
      axes: { planX: 'audience-right', planZ: 'away-from-screen' },
    },
    sections: [{ id: 'main', name: 'Ana salon' }],
    categories: structuredClone(MERIDIAN_CATEGORIES),
    rowBlocks: [],
    seats,
  }
}
