/**
 * Görüş metrikleri — FOV’dan bağımsız; yalnızca kalibre planlarda kullanılır.
 * @param {{ x: number, y: number, z: number }} seat
 * @param {{ width: number, screenTarget?: { x: number, y: number, z: number } }} hall
 */
export function viewMetricsForSeat(seat, hall) {
  if (!hall.viewCalibrated) return null;
  const target = hall.screenTarget ?? { x: 0, y: 3, z: 0 };
  const halfWidth = hall.screen.width / 2;
  const radians =
    Math.atan2(halfWidth - seat.x, seat.z) + Math.atan2(halfWidth + seat.x, seat.z);
  return {
    distance: Math.hypot(seat.x - target.x, seat.z - target.z),
    screenAngle: Math.round((radians * 180) / Math.PI),
    offset: Math.abs(seat.x - target.x),
    side: seat.x < target.x ? 'sol' : 'sağ',
  };
}
