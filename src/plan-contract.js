/** PlanLayout (API) → widget hall / sahne modeli */

import { planToScene } from './geometry-adapter.js';

/**
 * @param {import('./hall-loader.js').PlanLayout} layout
 */
export function layoutToHall(layout) {
  return planToScene(layout);
}

export function isAisleGap(hall, column) {
  const after = hall.aisleAfterColumn ?? 6;
  return column === after || column === after + 1;
}
