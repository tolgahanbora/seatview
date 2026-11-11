import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PlanDraftsService } from '../src/plan/plan-drafts.service';

const fixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/hall48-view-poses.v1.json'), 'utf8'),
);

describe('S4-01 · 48 koltuk görüş fixture', () => {
  const layout = PlanDraftsService.buildHall48Layout();

  it('fixture üç referans koltuğu plan ile eşleşir', () => {
    for (const ref of fixture.referenceSeats) {
      const seat = layout.seats.find((s) => s.label === ref.label);
      expect(seat).toBeTruthy();
      expect(seat!.x).toBeCloseTo(ref.plan.xM, 2);
      expect(seat!.y).toBeCloseTo(ref.plan.seatFloorYM, 2);
      expect(seat!.z).toBeCloseTo(ref.plan.zM, 2);
    }
  });

  it('perde hedefi fixture ile plan screen uyumlu', () => {
    const s = layout.screen!;
    const cy = s.bottom + s.height / 2;
    expect(fixture.screen.centerTarget.yM).toBeCloseTo(cy, 2);
    expect(fixture.screen.widthM).toBe(s.width);
  });

  it('yayın snapshot kalibrasyonu 48 koltukla gelir', () => {
    expect(layout.calibration?.calibrated).toBe(true);
    expect(layout.calibration?.screenTarget?.y).toBeCloseTo(fixture.screen.centerTarget.yM, 2);
  });
});
