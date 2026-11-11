import { hall as defaultHall } from './hall.js';
import { viewMetricsForSeat } from './geometry-math.js';

/** @type {typeof defaultHall} */
let activeHall = defaultHall;

export function getHall() {
  return activeHall;
}

export function setHall(next) {
  activeHall = next;
}

export function seatMetrics(seat) {
  return viewMetricsForSeat(seat, activeHall);
}
