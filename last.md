Seatview · S4 koltuktan 3D görüş sprinti
Hedef — S2’de işletmenin çizdiği salon planından bir 3D sahne üret. S3’te müşterinin sitesine gömülen widget’ta, alıcı seçtiği koltuğun göz hizasından perdeyi görebilsin.

Kabul demosu — S2’deki 48 koltuklu salonun kalibre edilmiş bir sürümünü yayınla. Örnek satış sitesinde A2, B6 ve D11’in görüşlerini aç. A2 önden ve soldan, B6 daha merkezden, D11 arkadan ve sağdan bakmalı. Haritaya dön, D11’i seçili gör ve aynı sitede demo checkout’u tamamla.

Başlangıç — Bu plan S3’ün farklı origin’deki widget ve demo checkout kabul testinin geçtiği varsayımıyla hazırlanmıştır. Güncel Cursor reposu incelenmedi. Tahmin 8–10 iş günü, mevcut widget ve plan veri modeli yeniden kullanılabiliyorsa.
1. Alıcının göreceği akış
Adım	Arayüz	Davranış
Koltuk seç	2D harita, kategori, fiyat ve seçili koltuklar	Seçim mevcut widget akışında kalır. Tekli seçimde önizleme düğmesi görünür. Çoklu seçimde alıcı önizlemek istediği koltuğu seçer.
Koltuktan bak	“Bu koltuktan bak” düğmesi ve kısa yüklenme durumu	3D modül ilk istek üzerine yüklenir. Önizleme, seçili koltuğun kalıcı kimliğiyle açılır.
Göz hizasına geç	Kısa kamera geçişi ve alt bilgi kartı	Kamera salonu gösterip koltuk göz hizasına iner. Kart koltuk etiketi, kategori, fiyat ve kalibrasyon varsa görüş ölçülerini gösterir.
Haritaya dön	Geri düğmesi veya Escape	Harita seçimi, zoom ve kaydırma konumu korunur. Odak önizleme düğmesine döner.
Checkout’a geç	Mevcut fiyat özeti ve sepet akışı	Checkout seçilmiş koltuklarla devam eder. Önizleme açmak, kapatmak veya koltuklar arasında bakmak hold oluşturmaz ve mevcut süreyi uzatmaz.


Görsel dil — Mobilde büyük sahne alanı ve altta koltuk bilgi kartı. Videodaki hissi kamera hareketi, karanlık salon ve aydınlık perde oluşturur. İlk sürüm tek bir sinema şablonu ve hafif koltuk geometrisiyle çalışır. Detaylı salon dekoru, özel 3D model yükleme ve fiziksel görüş engeli ölçümü sonraki sürümlerin kapsamıdır.
2. Geometri, kamera ve kalibrasyon
Veri	Kaynak	Kullanım
Koltuk kimliği, plan konumu ve yönü	S2 yayınlanmış plan sürümü	Aynı koltuğun 2D ve 3D’de eşleşmesi
Perde merkezi, yönü, genişliği ve yüksekliği	Editördeki 3D kalibrasyon alanı	Perdeyi sahneye yerleştirme ve kameranın hedefi
Plan ölçeği ve sıra kotları	Metre ölçeği, sıra yüksekliği veya pilot salon ölçüsü	Kamera konumu ve görüş ölçüleri
Oturan kişinin göz yüksekliği	Şablon ayarı	Her koltuğun kamera yüksekliği. Simülasyon varsayımı olarak belgelenir.
Kategori, fiyat ve müsaitlik	Mevcut seans verisi	Bilgi kartı ve seçim. Sahne geometrisi olarak saklanmaz.


- Ortak koordinat adaptörü — S2 planının iki eksenini 3D zemine çevir ve düşey ekseni sıra kotundan üret. Orijini, eksen yönünü ve metre dönüşümünü tek modülde tanımla. Koltuk yönünü ve perdeyi aynı dönüşümden geçir. A2 ve D11 ile sol/sağ aynalama hatasını test et.
- Kamera pozu — Kamera seçilen koltuğun merkezinde, sıra kotu artı oturan göz yüksekliğinde olsun. Perdeye doğru baksın. Açılış animasyonu genel salon görünümünden bu poza gelsin. Hareket azaltma tercihi olan kullanıcı doğrudan son pozu görsün.
- Bilgi kartı — Perde merkezine yatay mesafeyi, perde orta ekseninden yanal uzaklığı ve perde kenarlarının göz noktasından oluşturduğu açıyı hesapla. Karttaki açı, renderer’ın kamera FOV ayarından ayrı bir ölçüdür. Kullanılabilir salon ölçüleri yoksa sayısal değerleri gösterme. Şablon görünümünü “3D simülasyon” olarak etiketle.
- Sürümleme — 3D kalibrasyonu yayınlanan plan sürümüyle birlikte sakla. V2’de perdeyi veya sırayı taşımak V1 seansının görüşünü değiştirmesin. Kalibrasyonsuz eski planlar 2D’de çalışabilsin.
3. Uygulama kararı
Önce repodaki renderer’ı incele. Kullanılabilir bir 3D katman varsa onu genişlet. Yeni renderer gerekiyorsa önerim Three.js ve perspektif kamera. Aynı koltuk geometrisini paylaşan koltuk gruplarını instancing ile çiz. Modülü isteğe bağlı yükle. Kapatırken animasyonu durdur ve sahne değiştiğinde kullanılmayan GPU kaynaklarını serbest bırak. Three.js InstancedMesh · Three.js kaynak temizliği

İlk performans hedefi, 3D açılana kadar 2D widget’ın 3D paketini indirmemesi. Örnek salon için gerçek bir iPhone/Safari ve orta seviye Android/Chrome üzerinde ilk görüntü süresini, 3D aktarım boyutunu ve 10 aç/kapat sonrasındaki davranışı kaydet. Pilot için başlangıç hedefi, 4G benzetiminde 3D düğmesine dokunduktan sonra ilk görüntünün yaklaşık iki saniye içinde gelmesi. Ölçüm cihazı ve ağ profili rapora yazılsın.

WebGL açılamazsa, yükleme başarısız olursa veya tarayıcı grafik bağlamını kaybederse kullanıcıya kısa bir durum mesajı göster ve onu seçimi korunmuş 2D haritaya döndür. Checkout, 2D akışta tamamlanabilsin.
4. Gün gün iş planı
Gün	Görev	Çıkış kriteri
1	S4-01 · Repo ve geometri incelemesi	Mevcut renderer, widget ve plan koordinatları haritalanır. A2, B6 ve D11’in beklenen kamera konumları bir fixture’a yazılır.
2–3	S4-02 · Kalibrasyon ve adaptör	Ölçek, perde ölçüleri ve sıra kotları plan sürümünden okunur. Aynı koltuk kimliği 2D ve 3D verisinde eşleşir.
4–5	S4-03 · 3D sahne ve kamera	Salon, koltuklar ve perde yayınlanmış plandan çizilir. Üç referans koltuğun farklı göz hizası doğrulanır.
6–7	S4-04 · Widget deneyimi	2D/3D geçişi, bilgi kartı, klavye odağı, hareket azaltma ve 2D’ye dönüş çalışır.
8–10	S4-05 · Mobil ve satış regresyonu	Ayrı origin’deki S3 demo sitesi, gerçek cihaz testi, 3D kapalıyken checkout ve eski plan sürümü senaryoları doğrulanır.


5. Kabul testleri
Senaryo	Beklenen sonuç
Üç görüş açısı	A2, B6 ve D11 doğru sıra ve tarafa bakar. Hiçbir kamera öndeki koltuğun geometrisinin içine yerleşmez.
Plan sürümü	V2’de perdeyi taşı. V1 seansının 2D yerleşimi ve 3D görüşü eski sürümde kalır.
Geçişte seçim	İki koltuk seç, birini önizle ve geri dön. Seçim, harita konumu ve varsa mevcut hold süresi korunur.
Kalibrasyonsuz plan	2D seçim ve checkout çalışır. Doğrulanmamış mesafe ve açı gösterilmez.
Grafik ve ağ hatası	3D’yi zorla başarısız yap. Ekran donmadan 2D’ye dönülür ve demo checkout tamamlanır.
Embed regresyonu	Ayrı satış sitesinde 3D aç/kapat sonrası D11 tutulur. Müşteri backend’i siparişi onaylar ve panelde rezervasyon görünür.

---

## S4-01 · Geometri incelemesi ve sözleşme (teslim)

### Repo haritası

| Katman | Dosya / uç | Bugünkü rol |
| --- | --- | --- |
| **Plan sözleşmesi (API)** | `api/src/plan/plan-layout.types.ts` → `PlanLayout` | `screen`, `rowBlocks`, `seats[]` (`uid`, `label`, `x/y/z`, kategori) |
| **48 koltuk üretici** | `PlanDraftsService.buildHall48Layout()` | Editör + S2 testlerinin referans geometrisi; yayında `layout_snapshot` |
| **Yayınlanmış sürüm** | `plan_versions.layout_snapshot`, `seats.pos_x/y/z` | Seans `GET /sessions/:id/layout` → snapshot veya koltuk tablosu |
| **Widget 2D → hall** | `src/plan-contract.js` (`layoutToHall`) | API planını `hall.seats` + `hall.screen` + sabit `eyeHeight: 1.14` |
| **Hall state** | `src/hall-state.js` | Aktif plan; `seatMetrics()` mesafe / açı / yanal offset |
| **3D önizleme** | `src/preview.js` (`createPreview`) | **Canvas 2D** yazılım projeksiyonu (WebGL/Three.js **yok**); perde çokgenleri + koltuk kutu mesh |
| **Legacy 108** | `src/hall.js` | Snapshot yoksa veya &lt;100 koltukta `hall-loader` fallback |
| **Seçim state (widget)** | `src/app.js` | `selected`, `availability` Map, `activeHoldId` (`sessionStorage`), `aria-pressed`, embed `selectionChanged` |
| **Yükleme** | `src/hall-loader.js` | `GET …/layout` → `layoutToHall` / legacy |

### S4’te kullanılacak mevcut araçlar (öneri)

1. **Koordinat kaynağı:** yayınlanmış `PlanLayout` (`layout_snapshot` öncelikli) — yeni paket yüklenmeden.
2. **2D harita:** mevcut `buildSeatMap` + envanter (`seatId` = `uid` / etiket).
3. **Görüş renderer:** önce **`preview.js` genişletme** (lazy `import()`, reduced-motion); yetersiz kalırsa S4-03’te Three.js modülü (README hedefi).
4. **Metrik kartı:** `hall-state.seatMetrics` — FOV’dan bağımsız; kalibrasyon yoksa sayıları gizle (S4 kabul).
5. **Sürüm izolasyonu:** mevcut `layout_snapshot` + S2 testleri; 3D kalibrasyon aynı snapshot içinde versiyonlanır.
6. **Regresyon:** S3 `embed/customer-demo/` checkout; 3D kapalıyken 2D hold/confirm.

### Plan koordinat sözleşmesi (v0 → S4-02’de formalize)

| Alan | Tip / birim | Nerede | Not |
| --- | --- | --- | --- |
| `seats[].uid` | string | Plan + DB | 2D `data-seat` ve 3D kamera eşlemesi |
| `seats[].x, y, z` | metre | Plan draft, `pos_*` | `makeSeat`: koridor boşluğu 0.9 m, pitch 0.64 m |
| `seats[].row`, `column`, `label` | — | Plan | A2 = A sırası 2. koltuk |
| `screen.width/bottom/height` | metre | `PlanScreen` | Perde dikdörtgeni; hedef `(0, bottom+height/2, 0)` |
| `rowBlocks[]` | — | Plan | Sıra başına sol/sağ blok + `aisleAfterSeat` (2D koridor) |
| `eyeHeight` | metre | Yalnız widget | `plan-contract.js` sabit **1.14** — henüz planda yok |
| **Eksik (S4-02)** | `calibration` bloğu | — | Eksen orijini, göz yüksekliği override, perde normali, sıra kotları tablosu |

Eksenler (`buildHall48Layout`): **+X** sağ, **+Y** yukarı (sıra rıhtımı), **+Z** perdeden seyirciye (ön sıra ~5.2 m).

### Referans koltuklar (48’lik fixture)

Makine okunur paket: [`api/test/fixtures/hall48-view-poses.v1.json`](api/test/fixtures/hall48-view-poses.v1.json) (`contractVersion: view-geometry.v1`).

| Koltuk | Plan (x, z) m | Sıra kotu (y) m | Kamera gözü (x, y, z) m | Perde hedefi | Bilgi kartı (sim.) |
| --- | --- | --- | --- | --- | --- |
| **A2** | (-1.41, 5.20) | 0 | (-1.41, **1.14**, 5.20) | (0, **3.0**, 0) | 5.39 m · sol · 57° |
| **B6** | (1.15, 6.32) | 0.25 | (1.15, **1.39**, 6.32) | (0, **3.0**, 0) | 6.42 m · koridor kenarı · 50° |
| **D11** | (1.41, 8.56) | 0.75 | (1.41, **1.89**, 8.56) | (0, **3.0**, 0) | 8.68 m · sağ · 38° |

Göz **y** = sıra kotu + 1.14 m. `preview.js` animasyonu bitince kamera `(x, y+eyeHeight, z)`; `viewTransform` ile perdeye bakar.

### Widget seçim state’i (3D geçişinde korunacaklar)

| State | Saklama | 3D etkisi |
| --- | --- | --- |
| `selected` | bellek | Önizleme koltuğu; dialog kapanınca `aria-pressed` |
| `activeHoldId` | `sessionStorage` | Önizleme hold süresini uzatmaz (S4 kabul) |
| `availability` | bellek | `blocked` / `held` / `reserved` 2D’de kalır |
| Harita scroll/zoom | (henüz yok) | S4-04’te koridor; şimdilik DOM yeniden çizilmez |

### S4-02’de değişmesi beklenen dosyalar

| Öncelik | Dosya | Değişiklik |
| --- | --- | --- |
| 1 | `api/src/plan/plan-layout.types.ts` | `PlanCalibration` / genişletilmiş `screen` |
| 2 | `api/src/plan/plan-drafts.service.ts` | Kalibrasyonu snapshot’a yazma; editörden okuma |
| 3 | `src/plan-contract.js` veya **`src/geometry-adapter.js`** | Plan → sahne tek dönüşüm (2D+3D) |
| 4 | `src/hall-state.js` | Kalibrasyonlu `eyeHeight`, perde hedefi |
| 5 | `src/preview.js` (veya `src/view3d.js`) | Kamera `lookAt`, lazy yükleme, dispose |
| 6 | `src/app.js` | «Bu koltuktan bak», kalibrasyonsuz mod, embed uyumu |
| 7 | `panel/editor.js` (+ tools) | 3D kalibrasyon alanları UI |
| 8 | `api/test/fixtures/hall48-view-poses.v1.json` + yeni int test | A2/B6/D11 regresyon |
| 9 | Opsiyonel migration | Snapshot şeması geriye uyumlu JSON |

**S4-01 çıkış kriteri:** harita tamam, fixture işlendi, S4-02 dosya listesi sabitlendi.

---

## S4-02 · S4-03 (teslim)

- **`PlanCalibration`** `plan-layout.types.ts` içinde; `buildHall48Layout()` yayın snapshot’ına yazılır (`layout_snapshot`).
- **`src/geometry-adapter.js`** — tek `planToScene()` dönüşümü (2D harita + 3D); `plan-contract.js` bunu kullanır.
- **`src/preview.js`** — 48 koltuk + perde; salon özeti → göz hizası animasyonu; perde `lookAt` kalibrasyonundan.
- **`viewCalibrated: false`** (legacy / kalibrasyonsuz) → önizleme bilgi kartında **ölçü yok**.
- **Testler:** `s4-view-axis`, `s4-calibration-version`, `s4-geometry-fixture` — `npm run api:test` → **12 suite, 53/53**.

**Manuel:** 48’lik plan yayınla → widget’ta A2/B6/D11 **Bu koltuktan bak**; kalibre planda mesafe/açı görünür. 108 legacy’de ölçü gizli kalır.

---

## S4-04 · S4-05 (teslim)

### Widget

- **`src/preview-loader.js`** — `preview.js` yalnızca ilk önizlemede `import()` edilir (`__seatviewPreviewLoadMs`).
- Haritaya dönüş: **scroll konumu**, **seçili koltuk**, **odak** önizleme düğmesinde; Escape/‹ ile kapanır.
- **`prefers-reduced-motion`**: animasyon atlanır (mevcut `preview.js` + yükleme ipucu).
- **`?previewFail=1`**: 3D yüklenmez → kısa hata, 2D + hold/checkout sürer.

### Testler

`npm run api:test` → **13 suite, 54/54** (`s4-embed-checkout-regression` dahil).  
`npm run bench:preview` — modül boyutu / lazy import doğrulama.

Performans günlüğü: [`docs/s4-05-performance-observations.md`](docs/s4-05-performance-observations.md) (2 mobil cihaz tablosu + 10 aç/kapat şablonu).

### Tekrarlanabilir kabul demosu (S3 embed + 3 koltuk)

**Önkoşul:** `npm run db:up` · `npm run api:dev` · `npm run dev` · `npm run customer:dev`

**İsteğe bağlı:** Panelde 48 koltuklu planı yayınlayıp yeni seans açın; `DEMO_SESSION_ID` ortam değişkenini o seansa verin (kalibre ölçüler için). Aksi halde varsayılan 19:45 seansında A2/B6/D11 yine çalışır (ölçü kartı kalibrasyona bağlı).

| Adım | Eylem | Beklenen |
| --- | --- | --- |
| 1 | [http://127.0.0.1:4280](http://127.0.0.1:4280) aç | Iframe embed; anahtar sayfada yok |
| 2 | Iframe’de **A2** → **Bu koltuktan bak** | İlk seferde kısa yükleme; sol/ön görüş |
| 3 | **‹** veya Escape | Harita aynı scroll; A2 seçili; hold süresi aynı |
| 4 | **B6** önizle | Daha derin/merkeze yakın kare |
| 5 | **D11** önizle → **Ödemeye geç** → host **Demo siparişi onayla** | Rezervasyon; hold sayacı durur |
| 6 | (QA) `widgetUrl` + `&previewFail=1` | 2D checkout hâlâ tamamlanır |
| 7 | (QA) 10× A2 önizleme aç/kapat | 2. açılışta import ~0 ms; seçim korunur |
| 8 | Safari iOS + Chrome Android’de adım 2–5 | Süreleri günlüğe yaz |

**Mobil ölçüm:** DevTools konsolda `window.__seatviewPreviewLoadMs` ve `__seatviewPreviewOpenCount` (iframe içinde). Sonuçları performans dokümanındaki tabloya işleyin.