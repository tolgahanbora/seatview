const rows = 'ABCDEFGHI';

// Metres. x is left/right, y is height, z increases away from the screen.
export const hall = {
  width: 10.6,
  eyeHeight: 1.14,
  viewCalibrated: false,
  calibration: null,
  screenTarget: { x: 0, y: 3.65, z: 0 },
  screen: { width: 9.2, bottom: 1.55, height: 4.2 },
  seats: [...rows].flatMap((row, rowIndex) =>
    Array.from({ length: 12 }, (_, columnIndex) => {
      const id = row + (columnIndex + 1);
      const recliner = rowIndex >= 7;
      return {
        id,
        row,
        column: columnIndex + 1,
        x: (columnIndex - 5.5) * 0.64 + (columnIndex < 3 ? -0.52 : columnIndex >= 9 ? 0.52 : 0),
        y: rowIndex * 0.25,
        z: 5.18 + rowIndex * 1.12,
        category: recliner ? 'Recliner' : 'Standart',
        price: recliner ? 420 : 350,
        recliner,
        booked: false,
      };
    }),
  ),
};

export function seatMetrics(seat) {
  const halfWidth = hall.screen.width / 2;
  const radians = Math.atan2(halfWidth - seat.x, seat.z) + Math.atan2(halfWidth + seat.x, seat.z);
  return {
    distance: Math.hypot(seat.x, seat.z),
    screenAngle: Math.round(radians * 180 / Math.PI),
    offset: Math.abs(seat.x),
    side: seat.x < 0 ? 'sol' : 'sağ',
  };
}
