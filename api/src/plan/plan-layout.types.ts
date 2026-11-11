export type PlanScreen = {
  width: number;
  bottom: number;
  height: number;
};

/** 3D görüş kalibrasyonu — plan sürümü snapshot içinde sürümlenir. */
export type PlanCalibration = {
  version: number;
  unit: 'm';
  /** Doğrulanmış salon; false iken widget sayısal ölçü göstermez. */
  calibrated: boolean;
  eyeHeightM: number;
  screenTarget?: { x: number; y: number; z: number };
  axes?: {
    planX: 'audience-right';
    planZ: 'away-from-screen';
  };
};

export const DEFAULT_EYE_HEIGHT_M = 1.14;

export function defaultHall48Calibration(): PlanCalibration {
  return {
    version: 1,
    unit: 'm',
    calibrated: true,
    eyeHeightM: DEFAULT_EYE_HEIGHT_M,
    screenTarget: { x: 0, y: 3.0, z: 0 },
    axes: { planX: 'audience-right', planZ: 'away-from-screen' },
  };
}

export type PlanSection = {
  id: string;
  name: string;
};

export type PlanCategory = {
  id: string;
  name: string;
  color: string;
  defaultPrice: number;
};

export type PlanRowBlock = {
  row: string;
  seatsLeft: number;
  seatsRight: number;
  aisleAfterSeat: number;
  categoryId: string;
};

export type PlanSeatDraft = {
  uid: string;
  label: string;
  row: string;
  column: number;
  sectionId: string;
  categoryId: string;
  x: number;
  y: number;
  z: number;
};

export type PlanLayout = {
  screen: PlanScreen | null;
  calibration?: PlanCalibration | null;
  sections: PlanSection[];
  categories: PlanCategory[];
  rowBlocks: PlanRowBlock[];
  seats: PlanSeatDraft[];
};

export type PlanValidationIssue = {
  code: string;
  message: string;
  seatUid?: string;
  label?: string;
};

export const DEFAULT_CATEGORIES: PlanCategory[] = [
  { id: 'cat-std', name: 'Standart', color: '#4f8e64', defaultPrice: 350 },
  { id: 'cat-vip', name: 'VIP', color: '#b89568', defaultPrice: 520 },
];

export function emptyPlanLayout(): PlanLayout {
  return {
    screen: null,
    sections: [],
    categories: [...DEFAULT_CATEGORIES],
    rowBlocks: [],
    seats: [],
  };
}
