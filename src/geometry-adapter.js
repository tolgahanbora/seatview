/** PlanLayout (API) → 2D harita + 3D sahne (tek dönüşüm). */

/**
 * @param {{ width: number, bottom: number, height: number } | null | undefined} screen
 */
export function screenCenterTarget(screen) {
  if (!screen) return { x: 0, y: 3, z: 0 };
  return {
    x: 0,
    y: screen.bottom + screen.height / 2,
    z: 0,
  };
}

/**
 * @param {import('./plan-contract.js').PlanLayout} layout
 */
export function planToScene(layout) {
  const screen = layout.screen ?? null;
  const aisleAfter = layout.rowBlocks?.[0]?.aisleAfterSeat ?? 6;
  const categoryById = new Map((layout.categories ?? []).map((c) => [c.id, c]));
  const calibration = layout.calibration ?? null;

  const viewCalibrated = Boolean(calibration?.calibrated && screen);
  const eyeHeight = calibration?.eyeHeightM ?? 1.14;
  const screenTarget =
    calibration?.screenTarget != null
      ? { ...calibration.screenTarget }
      : screenCenterTarget(screen);

  const seats = (layout.seats ?? []).map((seat) => {
    const category = categoryById.get(seat.categoryId);
    const categoryName = category?.name ?? 'Standart';
    const price = category?.defaultPrice ?? 350;
    const recliner = categoryName === 'Recliner' || categoryName === 'VIP';
    return {
      id: seat.uid,
      label: seat.label,
      row: seat.row,
      column: seat.column,
      x: seat.x,
      y: seat.y,
      z: seat.z,
      category: categoryName,
      price,
      recliner,
      booked: false,
    };
  });

  const fallbackScreen = { width: 9.2, bottom: 1.55, height: 4.2 };
  const resolvedScreen = screen ?? fallbackScreen;
  const maxX = Math.max(...seats.map((s) => Math.abs(s.x)), 4);

  return {
    width: Math.max(resolvedScreen.width + 2, maxX * 2 + 2),
    eyeHeight,
    viewCalibrated,
    calibration,
    screen: {
      width: resolvedScreen.width,
      bottom: resolvedScreen.bottom,
      height: resolvedScreen.height,
    },
    screenTarget,
    aisleAfterColumn: aisleAfter,
    seats,
  };
}
