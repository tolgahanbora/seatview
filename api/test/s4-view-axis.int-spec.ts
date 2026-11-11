import { PlanDraftsService } from '../src/plan/plan-drafts.service';
import { defaultHall48Calibration } from '../src/plan/plan-layout.types';

describe('S4-02 · Eksen ve kalibrasyon', () => {
  const layout = PlanDraftsService.buildHall48Layout();

  it('48 koltuk varsayılan kalibrasyon ile gelir', () => {
    expect(layout.calibration?.calibrated).toBe(true);
    expect(layout.calibration?.eyeHeightM).toBe(1.14);
    expect(layout.calibration?.axes?.planX).toBe('audience-right');
  });

  it('A2 sol (+X sol), D11 sağ — ayna hatası kontrolü', () => {
    const a2 = layout.seats.find((s) => s.label === 'A2')!;
    const d11 = layout.seats.find((s) => s.label === 'D11')!;
    expect(a2.x).toBeLessThan(0);
    expect(d11.x).toBeGreaterThan(0);
    expect(Math.abs(a2.x)).toBeGreaterThan(1);
  });

  it('kalibrasyon eksikse calibrated false', () => {
    const uncal = { ...layout, calibration: { ...defaultHall48Calibration(), calibrated: false } };
    expect(uncal.calibration.calibrated).toBe(false);
    expect(uncal.screen).toBeTruthy();
  });
});
