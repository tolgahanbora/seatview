import { API_BASE, DRAFT_ID, SESSION_ID, apiHeaders, sessionLayoutPath } from './demo-api.js';
import { hall as legacyHall } from './hall.js';
import { layoutToHall } from './plan-contract.js';
import { setHall } from './hall-state.js';

/** API planında koltuk koordinatları yoksa (ör. seed pos_x=0) önizleme çalışmaz. */
function layoutHasUsableGeometry(layout) {
  const seats = layout?.seats ?? [];
  if (!seats.length) return false;
  const maxZ = Math.max(...seats.map((s) => Number(s.z) || 0));
  const spreadX = Math.max(...seats.map((s) => Math.abs(Number(s.x) || 0)));
  return maxZ > 0.5 && spreadX > 0.1;
}

/**
 * @returns {Promise<{ mode: 'session' | 'draft' | 'legacy', hall: object, planVersionId?: string }>}
 */
export async function loadHallGeometry() {
  if (DRAFT_ID) {
    const response = await fetch(API_BASE + '/plan-drafts/' + DRAFT_ID + '/layout', {
      headers: apiHeaders(),
    });
    if (!response.ok) {
      throw new Error('Taslak plan yüklenemedi (' + response.status + ')');
    }
    const payload = await response.json();
    const hall = layoutToHall(payload.layout);
    setHall(hall);
    return { mode: 'draft', hall, draftId: DRAFT_ID };
  }

  if (SESSION_ID) {
    const layoutResponse = await fetch(API_BASE + sessionLayoutPath(SESSION_ID), {
      headers: apiHeaders(),
    });
    if (layoutResponse.ok) {
      const payload = await layoutResponse.json();
      const seats = payload.layout?.seats ?? [];
      if (seats.length >= 100 && !payload.layout?.screen) {
        setHall(legacyHall);
        return { mode: 'legacy', hall: legacyHall, planVersionId: payload.planVersionId };
      }
      if (seats.length && layoutHasUsableGeometry(payload.layout)) {
        const hall = layoutToHall(payload.layout);
        setHall(hall);
        return { mode: 'session', hall, planVersionId: payload.planVersionId };
      }
      if (seats.length >= legacyHall.seats.length * 0.9) {
        setHall(legacyHall);
        return { mode: 'legacy', hall: legacyHall, planVersionId: payload.planVersionId };
      }
      if (seats.length) {
        const hall = layoutToHall(payload.layout);
        setHall(hall);
        return { mode: 'session', hall, planVersionId: payload.planVersionId };
      }
    }
  }

  setHall(legacyHall);
  return { mode: 'legacy', hall: legacyHall };
}
