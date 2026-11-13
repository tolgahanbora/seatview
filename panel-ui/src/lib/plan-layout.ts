/** Editör ↔ API plan sözleşmesi. */

export type PlanCategory = {
  id: string
  name: string
  color: string
  defaultPrice: number
}

export type PlanSeat = {
  uid: string
  label: string
  row: string
  column: number
  sectionId: string
  categoryId: string
  x: number
  y: number
  z: number
}

export type PlanRowBlock = {
  row: string
  seatsLeft: number
  seatsRight: number
  aisleAfterSeat: number
  categoryId: string
}

export type PlanCalibration = {
  version: number
  unit: 'm'
  calibrated: boolean
  eyeHeightM: number
  screenTarget?: { x: number; y: number; z: number }
  axes?: {
    planX: 'audience-right'
    planZ: 'away-from-screen'
  }
}

export type PlanLayout = {
  screen: { width: number; bottom: number; height: number } | null
  sections: { id: string; name: string }[]
  categories: PlanCategory[]
  rowBlocks: PlanRowBlock[]
  seats: PlanSeat[]
  calibration?: PlanCalibration | null
}

export const DEFAULT_EYE_HEIGHT_M = 1.14

export function defaultPlanCalibration(calibrated = false): PlanCalibration {
  return {
    version: 1,
    unit: 'm',
    calibrated,
    eyeHeightM: DEFAULT_EYE_HEIGHT_M,
    screenTarget: { x: 0, y: 3.0, z: 0 },
    axes: { planX: 'audience-right', planZ: 'away-from-screen' },
  }
}

export function ensureCalibration(layout: PlanLayout): PlanCalibration {
  return {
    ...defaultPlanCalibration(false),
    ...layout.calibration,
    axes: layout.calibration?.axes ?? {
      planX: 'audience-right',
      planZ: 'away-from-screen',
    },
  }
}

export const DEFAULT_CATEGORIES: PlanCategory[] = [
  { id: 'cat-std', name: 'Standart', color: '#4f8e64', defaultPrice: 350 },
  { id: 'cat-vip', name: 'VIP', color: '#b89568', defaultPrice: 520 },
]

export function newUid() {
  return crypto.randomUUID()
}

export function emptyLayout(): PlanLayout {
  return {
    screen: null,
    sections: [],
    categories: structuredClone(DEFAULT_CATEGORIES),
    rowBlocks: [],
    seats: [],
  }
}

function makeSeat(
  row: string,
  column: number,
  categoryId: string,
  sectionId: string,
  rowIndex: number,
  logicalCol: number,
): PlanSeat {
  const aisleGap = 0.9
  const pitch = 0.64
  const xOffset =
    logicalCol <= 6
      ? (logicalCol - 3.5) * pitch - aisleGap / 2
      : (logicalCol - 9.5) * pitch + aisleGap / 2
  return {
    uid: newUid(),
    label: row + column,
    row,
    column,
    sectionId,
    categoryId,
    x: xOffset,
    y: rowIndex * 0.25,
    z: 5.2 + rowIndex * 1.12,
  }
}

export function seatsFromRowBlocks(rowBlocks: PlanRowBlock[], sectionId = 'main') {
  const seats: PlanSeat[] = []
  const rowIndexByLetter = (row: string) => row.charCodeAt(0) - 'A'.charCodeAt(0)
  for (const block of rowBlocks) {
    const ri = rowIndexByLetter(block.row)
    let col = 1
    for (let i = 0; i < block.seatsLeft; i += 1) {
      seats.push(makeSeat(block.row, col, block.categoryId, sectionId, ri, col))
      col += 1
    }
    col += 1
    for (let i = 0; i < block.seatsRight; i += 1) {
      seats.push(makeSeat(block.row, col, block.categoryId, sectionId, ri, col))
      col += 1
    }
  }
  return seats
}

export function buildHall48Layout(): PlanLayout {
  const sectionId = 'main'
  const rowBlocks: PlanRowBlock[] = ['A', 'B', 'C', 'D'].map((row) => ({
    row,
    seatsLeft: 6,
    seatsRight: 6,
    aisleAfterSeat: 6,
    categoryId: row === 'D' ? 'cat-vip' : 'cat-std',
  }))
  return {
    screen: { width: 6, bottom: 1.4, height: 3.2 },
    calibration: defaultPlanCalibration(true),
    sections: [{ id: sectionId, name: 'Ana salon' }],
    categories: structuredClone(DEFAULT_CATEGORIES),
    rowBlocks,
    seats: seatsFromRowBlocks(rowBlocks, sectionId),
  }
}

export function addScreen(layout: PlanLayout) {
  layout.screen = { width: 6, bottom: 1.4, height: 3.2 }
}

export function addMainSection(layout: PlanLayout) {
  if (!layout.sections.some((s) => s.id === 'main')) {
    layout.sections.push({ id: 'main', name: 'Ana salon' })
  }
}

export function addRowBlock(layout: PlanLayout, row: string, categoryId = 'cat-std') {
  const block: PlanRowBlock = {
    row,
    seatsLeft: 6,
    seatsRight: 6,
    aisleAfterSeat: 6,
    categoryId,
  }
  layout.rowBlocks.push(block)
  const sectionId = layout.sections[0]?.id ?? 'main'
  layout.seats.push(...seatsFromRowBlocks([block], sectionId))
}

export function applyCategoryToRow(layout: PlanLayout, row: string, categoryId: string) {
  for (const block of layout.rowBlocks) {
    if (block.row === row) block.categoryId = categoryId
  }
  for (const seat of layout.seats) {
    if (seat.row === row) seat.categoryId = categoryId
  }
}

export function renumberRow(layout: PlanLayout, row: string, startNumber = 1) {
  const rowSeats = layout.seats
    .filter((s) => s.row === row)
    .sort((a, b) => a.column - b.column)
  let num = startNumber
  for (const seat of rowSeats) {
    seat.column = num
    seat.label = row + num
    num += 1
  }
}

export function moveSeat(seat: PlanSeat, dx: number, dz: number) {
  seat.x += dx
  seat.z += dz
}

export function categoryColor(layout: PlanLayout, categoryId: string) {
  return layout.categories.find((c) => c.id === categoryId)?.color ?? '#666'
}
