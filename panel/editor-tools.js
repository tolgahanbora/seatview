/** Editör ↔ API ile aynı plan sözleşmesi */

export const DEFAULT_CATEGORIES = [
  { id: 'cat-std', name: 'Standart', color: '#4f8e64', defaultPrice: 350 },
  { id: 'cat-vip', name: 'VIP', color: '#b89568', defaultPrice: 520 },
];

export function newUid() {
  return crypto.randomUUID();
}

export function emptyLayout() {
  return {
    screen: null,
    sections: [],
    categories: structuredClone(DEFAULT_CATEGORIES),
    rowBlocks: [],
    seats: [],
  };
}

function makeSeat(row, column, categoryId, sectionId, rowIndex, logicalCol) {
  const aisleGap = 0.9;
  const pitch = 0.64;
  const xOffset =
    logicalCol <= 6
      ? (logicalCol - 3.5) * pitch - aisleGap / 2
      : (logicalCol - 9.5) * pitch + aisleGap / 2;
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
  };
}

export function seatsFromRowBlocks(rowBlocks, sectionId = 'main') {
  const seats = [];
  const rowIndexByLetter = (row) => row.charCodeAt(0) - 'A'.charCodeAt(0);
  for (const block of rowBlocks) {
    const ri = rowIndexByLetter(block.row);
    let col = 1;
    for (let i = 0; i < block.seatsLeft; i += 1) {
      seats.push(makeSeat(block.row, col, block.categoryId, sectionId, ri, col));
      col += 1;
    }
    col += 1;
    for (let i = 0; i < block.seatsRight; i += 1) {
      seats.push(makeSeat(block.row, col, block.categoryId, sectionId, ri, col));
      col += 1;
    }
  }
  return seats;
}

export function buildHall48Layout() {
  const sectionId = 'main';
  const rowBlocks = ['A', 'B', 'C', 'D'].map((row) => ({
    row,
    seatsLeft: 6,
    seatsRight: 6,
    aisleAfterSeat: 6,
    categoryId: row === 'D' ? 'cat-vip' : 'cat-std',
  }));
  return {
    screen: { width: 6, bottom: 1.4, height: 3.2 },
    sections: [{ id: sectionId, name: 'Ana salon' }],
    categories: structuredClone(DEFAULT_CATEGORIES),
    rowBlocks,
    seats: seatsFromRowBlocks(rowBlocks, sectionId),
  };
}

export function addScreen(layout) {
  layout.screen = { width: 6, bottom: 1.4, height: 3.2 };
}

export function addMainSection(layout) {
  if (!layout.sections.some((s) => s.id === 'main')) {
    layout.sections.push({ id: 'main', name: 'Ana salon' });
  }
}

export function addRowBlock(layout, row, categoryId = 'cat-std') {
  const block = {
    row,
    seatsLeft: 6,
    seatsRight: 6,
    aisleAfterSeat: 6,
    categoryId,
  };
  layout.rowBlocks.push(block);
  const sectionId = layout.sections[0]?.id ?? 'main';
  layout.seats.push(...seatsFromRowBlocks([block], sectionId));
}

export function applyCategoryToRow(layout, row, categoryId) {
  for (const block of layout.rowBlocks) {
    if (block.row === row) block.categoryId = categoryId;
  }
  for (const seat of layout.seats) {
    if (seat.row === row) seat.categoryId = categoryId;
  }
}

/** Etiket ve sıra/sütun güncellenir; uid korunur. */
export function renumberRow(layout, row, startNumber = 1) {
  const rowSeats = layout.seats.filter((s) => s.row === row).sort((a, b) => a.column - b.column);
  let num = startNumber;
  for (const seat of rowSeats) {
    seat.column = num;
    seat.label = row + num;
    num += 1;
  }
}

export function moveSeat(seat, dx, dz) {
  seat.x += dx;
  seat.z += dz;
}

export function categoryColor(layout, categoryId) {
  return layout.categories.find((c) => c.id === categoryId)?.color ?? '#666';
}
