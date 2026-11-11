const rows = 'ABCDEFGHI';

export const INITIAL_RESERVED = new Set([
  'A2', 'A5', 'A6', 'A8', 'A9', 'A10', 'A12', 'B2', 'B9', 'C2', 'C3', 'C4', 'C11', 'D1',
  'D4', 'D5', 'D6', 'D9', 'D10', 'D12', 'E1', 'E2', 'E5', 'E7', 'E9', 'F3', 'F7', 'F9',
  'F12', 'G4', 'G8', 'G10', 'G12', 'H3', 'H6', 'H7', 'H10', 'I2', 'I4', 'I5', 'I8', 'I10',
]);

export type SeedSeat = {
  id: string;
  row: string;
  column: number;
  category: string;
  price: number;
  initiallyReserved: boolean;
};

export function buildDemoSeats(): SeedSeat[] {
  return [...rows].flatMap((row, rowIndex) =>
    Array.from({ length: 12 }, (_, columnIndex) => {
      const id = row + (columnIndex + 1);
      const recliner = rowIndex >= 7;
      return {
        id,
        row,
        column: columnIndex + 1,
        category: recliner ? 'Recliner' : 'Standart',
        price: recliner ? 420 : 350,
        initiallyReserved: INITIAL_RESERVED.has(id),
      };
    }),
  );
}
