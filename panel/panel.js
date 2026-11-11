import {
  DEMO_SESSION_SPECS,
  PANEL_META,
  apiGet,
  apiPost,
  formatSessionTime,
  widgetPreviewUrl,
} from './api.js';
import { mountEditor } from './editor.js';

const view = document.querySelector('#view');
const flashEl = document.querySelector('#flash');
const navLinks = [...document.querySelectorAll('[data-nav]')];

document.querySelector('[data-brand]').textContent =
  PANEL_META.businessName + ' · Seatview panel';
document.querySelector('[data-env-badge]').textContent =
  'Ortam: ' + PANEL_META.environment;

function showFlash(message, kind = 'ok') {
  flashEl.hidden = false;
  flashEl.className = 'flash ' + kind;
  flashEl.textContent = message;
}

function clearFlash() {
  flashEl.hidden = true;
  flashEl.textContent = '';
}

function setActiveNav(route) {
  const key = route.includes('/editor')
    ? 'editor'
    : route.startsWith('#/sessions/new')
      ? 'new'
      : route.startsWith('#/sessions')
        ? 'sessions'
        : 'venues';
  for (const link of navLinks) {
    link.setAttribute('aria-current', link.dataset.nav === key ? 'page' : 'false');
  }
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function loadVenues() {
  clearFlash();
  view.innerHTML = '<p class="muted">Salonlar yükleniyor…</p>';
  try {
    const data = await apiGet('/venues');
    if (!data.venues.length) {
      view.innerHTML =
        '<section class="card"><h1>Salonlar</h1><div class="empty">Yayınlanmış salon yok. API seed çalıştırın.</div></section>';
      return;
    }
    const rows = data.venues
      .map((venue) => {
        const planCells = venue.planVersions.length
          ? venue.planVersions
              .map((plan) => 'v' + plan.version + ' · ' + (plan.seatCount ?? '?') + ' koltuk')
              .join(', ')
          : 'Yayın yok';
        return (
          '<tr><td>' +
          escapeHtml(venue.name) +
          '</td><td>' +
          escapeHtml(planCells) +
          '</td><td><a href="#/venues/' +
          escapeHtml(venue.id) +
          '/editor">Plan editörü ↗</a></td></tr>'
        );
      })
      .join('');
    view.innerHTML =
      '<section class="card"><h1>Salonlar</h1>' +
      '<p class="muted">Yayınlanmış plan sürümleri ve koltuk sayıları. Seans açmak için plan sürümünü seçin.</p>' +
      '<table><thead><tr><th>Salon</th><th>Yayınlanmış planlar</th><th>Editör</th></tr></thead><tbody>' +
      rows +
      '</tbody></table>' +
      '<div class="actions" style="margin-top:16px">' +
      '<a class="btn" href="#/sessions/new">Bu salonda seans oluştur</a></div></section>';
  } catch (error) {
    view.innerHTML = '<section class="card"><h1>Salonlar</h1></section>';
    showFlash(apiOfflineMessage(error), 'error');
  }
}

function apiOfflineMessage(error) {
  const detail = error instanceof Error ? error.message : 'Bilinmeyen hata';
  return (
    'API bağlantısı kurulamadı (' +
    detail +
    '). `npm run db:up`, `npm run api:migrate` ve `npm run api:dev` komutlarını çalıştırın.'
  );
}

async function loadSessions() {
  clearFlash();
  view.innerHTML = '<p class="muted">Seanslar yükleniyor…</p>';
  let venues;
  try {
    venues = await apiGet('/venues');
  } catch (error) {
    view.innerHTML = '<section class="card"><h1>Seanslar</h1></section>';
    showFlash(apiOfflineMessage(error), 'error');
    return;
  }
  const venueById = new Map(venues.venues.map((v) => [v.id, v.name]));
  const planById = new Map();
  for (const venue of venues.venues) {
    for (const plan of venue.planVersions) {
      planById.set(plan.id, plan.version);
    }
  }

  try {
    const data = await apiGet('/sessions');
    const sessions = data.sessions;
    const demoButton =
      '<button type="button" id="create-demo-sessions" class="secondary">Meridian demo seansları (19:45 & 22:15)</button>';

    if (!sessions.length) {
      view.innerHTML =
        '<section class="card"><h1>Seanslar</h1>' +
        '<div class="empty">Henüz seans yok. Demo seanslarını oluşturun veya yeni seans ekleyin.</div>' +
        '<div class="actions">' +
        demoButton +
        ' <a class="btn secondary" href="#/sessions/new">Yeni seans</a></div></section>';
      document.querySelector('#create-demo-sessions')?.addEventListener('click', () =>
        createDemoSessions(venues),
      );
      return;
    }

    const rows = sessions
      .map((session) => {
        const preview = widgetPreviewUrl(session);
        return (
          '<tr><td>' +
          escapeHtml(session.title) +
          '</td><td>' +
          escapeHtml(formatSessionTime(session.startsAt, session.timezone)) +
          '</td><td>' +
          escapeHtml(venueById.get(session.venueId) || '—') +
          '</td><td>v' +
          (planById.get(session.planVersionId) ?? '?') +
          '</td><td><a class="preview-link" href="' +
          escapeHtml(preview) +
          '" target="_blank" rel="noopener">Önizleme ↗</a></td></tr>'
        );
      })
      .join('');

    view.innerHTML =
      '<section class="card"><h1>Seanslar</h1>' +
      '<p class="muted">' +
      sessions.length +
      ' seans · önizleme widget\'ı doğru <code>sessionId</code> ile açılır.</p>' +
      '<table><thead><tr><th>Ad</th><th>Başlangıç</th><th>Salon</th><th>Plan</th><th>Widget</th></tr></thead><tbody>' +
      rows +
      '</tbody></table>' +
      '<div class="actions" style="margin-top:16px">' +
      demoButton +
      ' <a class="btn" href="#/sessions/new">Yeni seans</a></div></section>';

    document.querySelector('#create-demo-sessions')?.addEventListener('click', () =>
      createDemoSessions(venues),
    );
  } catch (error) {
    view.innerHTML = '<section class="card"><h1>Seanslar</h1></section>';
    showFlash(error instanceof Error ? error.message : 'Seanslar alınamadı', 'error');
  }
}

async function createDemoSessions(venuesPayload) {
  const venue = venuesPayload.venues[0];
  if (!venue) {
    showFlash('Önce salon seed edilmeli.', 'error');
    return;
  }
  const planV1 = venue.planVersions.find((p) => p.version === 1);
  if (!planV1) {
    showFlash('v1 plan sürümü bulunamadı.', 'error');
    return;
  }
  const existing = await apiGet('/sessions');
  const titles = new Set(existing.sessions.map((s) => s.title));
  let created = 0;
  for (const spec of DEMO_SESSION_SPECS) {
    if (titles.has(spec.title)) continue;
    await apiPost('/sessions', {
      title: spec.title,
      startsAt: spec.startsAt,
      planVersionId: planV1.id,
      timezone: 'Europe/Istanbul',
    });
    created += 1;
  }
  if (created === 0) {
    showFlash('19:45 ve 22:15 seansları zaten listede.', 'ok');
  } else {
    showFlash(created + ' demo seans oluşturuldu.', 'ok');
  }
  await loadSessions();
}

function renderNewSessionForm(venuesPayload, formError) {
  const venue = venuesPayload?.venues?.[0];
  const plans =
    venue?.planVersions
      ?.map(
        (p) =>
          '<option value="' +
          escapeHtml(p.id) +
          '">Salon 03 · plan v' +
          p.version +
          ' · ' +
          (p.seatCount ?? '?') +
          ' koltuk</option>',
      )
      .join('') || '';

  view.innerHTML =
    '<section class="card"><h1>Yeni seans</h1>' +
    '<p class="muted">Test ortamında seans ve 108 koltukluk envanter tek işlemde açılır.</p>' +
    (formError ? '<p class="field-error">' + escapeHtml(formError) + '</p>' : '') +
    '<form id="session-form" class="form-grid">' +
    '<label>Seans adı<input name="title" required maxlength="120" placeholder="19:45 · IMAX" /></label>' +
    '<label>Başlangıç (ISO)<input name="startsAt" type="datetime-local" required /></label>' +
    '<label>Plan sürümü<select name="planVersionId" required>' +
    (plans || '<option value="">Plan yok</option>') +
    '</select></label>' +
    '<label>Saat dilimi<input name="timezone" value="Europe/Istanbul" /></label>' +
    '<div class="actions"><button type="submit">Seans oluştur</button>' +
    '<a class="btn secondary" href="#/sessions">İptal</a></div>' +
    '</form></section>';

  const form = document.querySelector('#session-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFlash();
    const data = new FormData(form);
    const title = String(data.get('title') || '').trim();
    const local = String(data.get('startsAt') || '');
    const planVersionId = String(data.get('planVersionId') || '');
    const timezone = String(data.get('timezone') || 'Europe/Istanbul').trim();

    if (!title) {
      renderNewSessionForm(venuesPayload, 'Seans adı gerekli.');
      return;
    }
    if (!planVersionId) {
      renderNewSessionForm(venuesPayload, 'Plan sürümü seçin.');
      return;
    }
    if (!local) {
      renderNewSessionForm(venuesPayload, 'Başlangıç zamanı gerekli.');
      return;
    }

    const startsAt = localToIsoWithIstanbulOffset(local);
    try {
      const created = await apiPost('/sessions', { title, startsAt, planVersionId, timezone });
      showFlash(
        'Seans oluşturuldu · ' + created.inventoryCount + ' koltuk · önizleme açılıyor…',
        'ok',
      );
      const url = widgetPreviewUrl(created);
      window.open(url, '_blank', 'noopener');
      location.hash = '#/sessions';
      route();
    } catch (error) {
      renderNewSessionForm(
        venuesPayload,
        error instanceof Error ? error.message : 'Seans oluşturulamadı',
      );
    }
  });
}

function localToIsoWithIstanbulOffset(datetimeLocal) {
  const [datePart, timePart] = datetimeLocal.split('T');
  return datePart + 'T' + timePart + ':00+03:00';
}

async function loadNewSession() {
  clearFlash();
  view.innerHTML = '<p class="muted">Form yükleniyor…</p>';
  try {
    const venues = await apiGet('/venues');
    renderNewSessionForm(venues);
  } catch (error) {
    view.innerHTML = '<section class="card"><h1>Yeni seans</h1></section>';
    showFlash(apiOfflineMessage(error), 'error');
  }
}

function loadEditorFromHash(hash) {
  clearFlash();
  const byVenue = hash.match(/^#\/venues\/([^/]+)\/editor$/);
  const byDraft = hash.match(/^#\/editor\/([^/]+)$/);
  const onBack = () => {
    location.hash = '#/venues';
  };
  if (byVenue) {
    mountEditor(view, { venueId: byVenue[1], onBack, showFlash });
  } else if (byDraft) {
    mountEditor(view, { draftId: byDraft[1], onBack, showFlash });
  }
}

function route() {
  const hash = location.hash || '#/venues';
  setActiveNav(hash);
  if (hash.match(/^#\/venues\/[^/]+\/editor$/) || hash.match(/^#\/editor\/[^/]+$/)) {
    loadEditorFromHash(hash);
  } else if (hash.startsWith('#/sessions/new')) {
    loadNewSession();
  } else if (hash.startsWith('#/sessions')) {
    loadSessions();
  } else {
    loadVenues();
  }
}

window.addEventListener('hashchange', route);
route();
