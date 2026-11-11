import { apiGet, apiPatch, apiPost } from './api.js';
import {
  addMainSection,
  addRowBlock,
  addScreen,
  applyCategoryToRow,
  buildHall48Layout,
  categoryColor,
  moveSeat,
  renumberRow,
} from './editor-tools.js';

/**
 * @param {HTMLElement} container
 * @param {{ venueId?: string, draftId?: string, onBack: () => void, showFlash: (msg: string, kind?: string) => void }} opts
 */
export async function mountEditor(container, opts) {
  container.innerHTML = '<p class="muted">Editör yükleniyor…</p>';
  let draft;
  try {
    if (opts.draftId) {
      draft = await apiGet('/plan-drafts/' + opts.draftId);
    } else if (opts.venueId) {
      draft = await apiPost('/venues/' + opts.venueId + '/plan-drafts', {
        title: 'Salon planı',
      });
    } else {
      throw new Error('venueId veya draftId gerekli');
    }
  } catch (error) {
    container.innerHTML = '<section class="card"><h1>Editör</h1></section>';
    opts.showFlash(error instanceof Error ? error.message : 'Taslak açılamadı', 'error');
    return;
  }

  let layout = structuredClone(draft.layout);
  let revision = draft.revision;
  let title = draft.title;
  let selectedUid = null;
  const history = [];
  let historyIndex = -1;

  function snapshot() {
    history.splice(historyIndex + 1);
    history.push(structuredClone(layout));
    historyIndex = history.length - 1;
  }

  snapshot();

  function undo() {
    if (historyIndex <= 0) return;
    historyIndex -= 1;
    layout = structuredClone(history[historyIndex]);
    render();
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    historyIndex += 1;
    layout = structuredClone(history[historyIndex]);
    render();
  }

  function seatByUid(uid) {
    return layout.seats.find((s) => s.uid === uid);
  }

  async function saveDraft() {
    try {
      const saved = await apiPatch('/plan-drafts/' + draft.id, {
        title,
        layout,
        expectedRevision: revision,
      });
      revision = saved.revision;
      draft = saved;
      layout = structuredClone(saved.layout);
      snapshot();
      opts.showFlash('Taslak kaydedildi · revizyon ' + revision, 'ok');
      render();
    } catch (error) {
      if (error.code === 'REVISION_CONFLICT') {
        opts.showFlash('Başka sekmede kayıt var — sayfayı yenileyin.', 'error');
      } else {
        opts.showFlash(error instanceof Error ? error.message : 'Kayıt hatası', 'error');
      }
    }
  }

  async function publishDraft() {
    try {
      const result = await apiPost('/plan-drafts/' + draft.id + '/publish', {
        expectedRevision: revision,
      });
      revision = result.draft.revision;
      draft = result.draft;
      opts.showFlash(
        (result.idempotent ? 'Zaten yayınlı · ' : 'Yayınlandı · ') +
          'plan v' +
          result.version +
          ' · ' +
          result.seatCount +
          ' koltuk',
        'ok',
      );
      render();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Yayın hatası';
      opts.showFlash(msg, 'error');
    }
  }

  function buildDemo48() {
    layout = buildHall48Layout();
    snapshot();
    render();
  }

  function render() {
    const validation = draft.canPublish === false && layout.seats.length === 0
      ? [{ message: 'Koltuk ekleyin' }]
      : [];

    const issues = validation.length
      ? validation
      : layout.seats.length && (!layout.screen || !layout.sections.length)
        ? [{ message: 'Perde ve bölüm ekleyin' }]
        : [];

    const canPublish = layout.seats.length > 0 && layout.screen && layout.sections.length > 0;

    container.innerHTML =
      '<div class="editor-shell">' +
      '<div class="editor-bar">' +
      '<div><h1>' +
      escapeHtml(title) +
      '</h1><p class="editor-meta">Taslak revizyon ' +
      revision +
      ' · ' +
      layout.seats.length +
      ' koltuk</p></div>' +
      '<div class="editor-tools">' +
      '<button type="button" class="secondary" data-action="back">← Panel</button>' +
      '<button type="button" class="secondary" data-action="undo">Geri al</button>' +
      '<button type="button" class="secondary" data-action="redo">İleri al</button>' +
      '<button type="button" data-action="save">Kaydet</button>' +
      '<button type="button" class="secondary" data-action="preview">Önizleme ↗</button>' +
      '<button type="button" data-action="publish"' +
      (canPublish ? '' : ' disabled') +
      '>Yayınla</button>' +
      '</div></div>' +
      '<div class="card editor-tools">' +
      '<button type="button" class="secondary" data-tool="screen">+ Perde</button>' +
      '<button type="button" class="secondary" data-tool="section">+ Bölüm</button>' +
      '<button type="button" class="secondary" data-tool="row">+ Sıra (6+6)</button>' +
      '<button type="button" data-tool="demo48">Demo 48 (A–D)</button>' +
      '<button type="button" class="secondary" data-tool="vip-d">D → VIP</button>' +
      '</div>' +
      '<div class="editor-layout">' +
      '<div class="editor-canvas-wrap">' +
      renderCanvas() +
      '</div>' +
      '<aside class="editor-side card">' +
      '<h2 style="margin:0 0 8px;font-size:1rem">Özellikler</h2>' +
      renderProps() +
      (issues.length
        ? '<h3 style="font-size:0.85rem">Uyarılar</h3><ul class="issue-list">' +
          issues.map((i) => '<li>' + escapeHtml(i.message) + '</li>').join('') +
          '</ul>'
        : '') +
      '</aside></div></div>';

    container.querySelector('[data-action="back"]')?.addEventListener('click', opts.onBack);
    container.querySelector('[data-action="save"]')?.addEventListener('click', saveDraft);
    container.querySelector('[data-action="publish"]')?.addEventListener('click', publishDraft);
    container.querySelector('[data-action="preview"]')?.addEventListener('click', () => {
      const url = 'http://127.0.0.1:4173/?draftId=' + encodeURIComponent(draft.id);
      window.open(url, '_blank', 'noopener');
    });
    container.querySelector('[data-action="undo"]')?.addEventListener('click', undo);
    container.querySelector('[data-action="redo"]')?.addEventListener('click', redo);

    container.querySelector('[data-tool="screen"]')?.addEventListener('click', () => {
      addScreen(layout);
      snapshot();
      render();
    });
    container.querySelector('[data-tool="section"]')?.addEventListener('click', () => {
      addMainSection(layout);
      snapshot();
      render();
    });
    container.querySelector('[data-tool="row"]')?.addEventListener('click', () => {
      const next = String.fromCharCode('A'.charCodeAt(0) + layout.rowBlocks.length);
      if (layout.rowBlocks.length >= 4) {
        opts.showFlash('Demo akışı için A–D yeterli; Demo 48 kullanın.', 'error');
        return;
      }
      addRowBlock(layout, next);
      snapshot();
      render();
    });
    container.querySelector('[data-tool="demo48"]')?.addEventListener('click', buildDemo48);
    container.querySelector('[data-tool="vip-d"]')?.addEventListener('click', () => {
      applyCategoryToRow(layout, 'D', 'cat-vip');
      snapshot();
      render();
    });

    for (const btn of container.querySelectorAll('.editor-seat')) {
      btn.addEventListener('click', () => {
        selectedUid = btn.dataset.uid;
        render();
      });
    }

    const moveX = container.querySelector('#prop-move-x');
    const moveZ = container.querySelector('#prop-move-z');
    const reRow = container.querySelector('#prop-renumber-row');
    moveX?.addEventListener('click', () => {
      const seat = seatByUid(selectedUid);
      if (!seat) return;
      moveSeat(seat, 0.1, 0);
      snapshot();
      render();
    });
    moveZ?.addEventListener('click', () => {
      const seat = seatByUid(selectedUid);
      if (!seat) return;
      moveSeat(seat, 0, 0.1);
      snapshot();
      render();
    });
    reRow?.addEventListener('click', () => {
      const seat = seatByUid(selectedUid);
      if (!seat) return;
      renumberRow(layout, seat.row);
      snapshot();
      render();
    });

    container.querySelector('#title-input')?.addEventListener('change', (event) => {
      title = event.target.value.trim() || title;
    });
  }

  function renderCanvas() {
    const screenHtml = layout.screen
      ? '<div class="editor-screen">PERDE / SAHNE</div>'
      : '<div class="editor-screen missing">Perde eklenmedi</div>';

    if (!layout.seats.length) {
      return screenHtml + '<p class="muted" style="text-align:center">Demo 48 ile başlayın veya sıra ekleyin.</p>';
    }

    const rows = [...new Set(layout.seats.map((s) => s.row))].sort();
    let html = screenHtml;
    for (const row of rows) {
      const seats = layout.seats.filter((s) => s.row === row);
      const left = seats.filter((s) => s.column <= 6).sort((a, b) => a.column - b.column);
      const right = seats.filter((s) => s.column >= 7).sort((a, b) => a.column - b.column);
      html += '<div class="editor-grid" aria-label="Sıra ' + escapeHtml(row) + '">';
      for (const seat of left) html += seatButton(seat);
      html += '<span class="aisle" aria-label="Koridor"></span>';
      for (const seat of right) html += seatButton(seat);
      html += '</div>';
    }
    return html;
  }

  function seatButton(seat) {
    const color = categoryColor(layout, seat.categoryId);
    return (
      '<button type="button" class="editor-seat" data-uid="' +
      escapeHtml(seat.uid) +
      '" data-selected="' +
      (seat.uid === selectedUid) +
      '" style="background:' +
      color +
      '" title="uid ' +
      escapeHtml(seat.uid) +
      '">' +
      escapeHtml(seat.label) +
      '</button>'
    );
  }

  function renderProps() {
    const seat = selectedUid ? seatByUid(selectedUid) : null;
    if (!seat) {
      return (
        '<p class="muted">Koltuk seçin. Taşıma ve yeniden numaralandırma <strong>uid</strong> korur.</p>' +
        '<label>Plan adı<input id="title-input" value="' +
        escapeHtml(title) +
        '" /></label>'
      );
    }
    const cat = layout.categories.find((c) => c.id === seat.categoryId);
    return (
      '<p><strong>' +
      escapeHtml(seat.label) +
      '</strong></p>' +
      '<p class="editor-meta">uid: ' +
      escapeHtml(seat.uid) +
      '</p>' +
      '<p class="editor-meta">Kategori: ' +
      escapeHtml(cat?.name ?? '?') +
      '</p>' +
      '<p class="editor-meta">x=' +
      seat.x.toFixed(2) +
      ' z=' +
      seat.z.toFixed(2) +
      '</p>' +
      '<div class="editor-tools">' +
      '<button type="button" class="secondary" id="prop-move-x">Taşı →</button>' +
      '<button type="button" class="secondary" id="prop-move-z">Taşı ↓</button>' +
      '<button type="button" class="secondary" id="prop-renumber-row">Sırayı yeniden numarala</button>' +
      '</div>' +
      '<label>Plan adı<input id="title-input" value="' +
      escapeHtml(title) +
      '" /></label>'
    );
  }

  render();
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
