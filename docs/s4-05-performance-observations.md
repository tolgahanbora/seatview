# S4-05 · Mobil önizleme gözlemleri

Ölçüm yöntemi: Seatview widget iframe içinde (`http://127.0.0.1:4280` → `4173`), DevTools → Performance veya `window.__seatviewPreviewLoadMs` (modülün ilk `import()` süresi). Ağ: yerel LAN (geliştirme); üretimde 4G Fast 3G profili tekrarlanmalı.

## Modül boyutu (yerel, 2026-03-26)

| Dosya | Bayt |
| --- | ---: |
| `src/preview.js` | 6 854 |
| `src/preview-loader.js` | 1 236 |

`npm run bench:preview` → Node soğuk `import()` süresi (proxy, GPU yok).

## İlk kareye kadar süre (hedef: ~2 sn @ 4G — pilot)

| Cihaz / profil | İlk «Bu koltuktan bak» (modül import ms) | İlk animasyon bitişi (göz) | Not |
| --- | ---: | ---: | --- |
| iPhone 13 · Safari · yerel Wi‑Fi | *sahada doldur* | *sahada doldur* | Responsive 390×844 |
| Orta Android · Chrome · yerel Wi‑Fi | *sahada doldur* | *sahada doldur* | Örn. Pixel 6 emülasyon |
| macOS · Chrome · Fast 3G throttle | *sahada doldur* | *sahada doldur* | DevTools Network |

**Geliştirme makinesi (kayıt 2026-11-10):** `npm run bench:preview` → Node soğuk import **2 ms**; `app.js` artık `preview.js`’i eager yüklemez. Chrome localhost’ta ilk `__seatviewPreviewLoadMs` tipik **15–80 ms**. Asıl maliyet canvas çizimi + animasyon (~900 ms; `prefers-reduced-motion` → anında göz hizası).

## 10× önizleme aç / haritaya dön

| # | `__seatviewPreviewLoadMs` (2. ve sonraki açılış) | Hold / seçim korundu? | Not |
| --- | ---: | --- | --- |
| 1 | (ilk yükleme) | — | `__seatviewPreviewOpenCount` = 1 |
| 2–10 | 0 (önbellek) | Evet | `restoreMapAfterPreview` scroll + odak |

**Beklenen:** 2. açılıştan itibaren import süresi **0**; `activeHoldId` ve seçili koltuk değişmez.

## Hata modu doğrulama

Widget URL’ye `&previewFail=1` ekleyin → modül bilerek reddedilir → 2D harita, hold ve embed checkout çalışır.

```text
…widgetUrl…&previewFail=1
```
