# r3f-yolbulan

React Three Fiber + shadcn/ui ile 3B yol bulma demosu: yarı saydam mavi küp, yeşil **START** direğinden kırmızı **FINISH** direğine en kısa yolu bulup yuvarlanarak gider.

## ▶ Demo

- **Hemen dene (Claude Artifact):** https://claude.ai/artifact/PfrVNqNe26cQqgq2Xg3VfY
- **GitHub Pages:** https://billylz.github.io/r3f-yolbulan/ (Settings → Pages → Source: *GitHub Actions* açıldıktan sonra çalışır)

<p>
  <img src="docs/desktop.png" alt="Masaüstü görünümü" width="68%" />
  <img src="docs/mobile.png" alt="Telefon görünümü" width="28%" />
</p>

## Kullanım

- **Engel / Start / Finish**: arenaya dokununca ne yapılacağını seç.
  - Engel: engel koy/kaldır (fareyle sürükleyerek çizebilirsin)
  - Start: yeşil başlangıç direğini o kareye taşı
  - Finish: kırmızı bitiş direğini o kareye taşı
- **Yol bulma yöntemi**: açılır listeden seç.
  - **A\***: Manhattan sezgiseliyle en kısa yolu garanti eder.
  - **yolbulan1995**: kendi yöntemimiz (yakında, `src/algorithms/yolbulan1995.js`).
- **Yolu Bul**: seçili yöntemle Start → Finish yolunu arar, taranan kareleri gösterir, sonra mavi küp yolu izler. (Boşluk/Enter da çalışır.)
- **Rastgele**: seçili yoğunlukta, her zaman çözülebilir rastgele engeller.
- **Temizle**: tüm engelleri siler.
- **Engel yoğunluğu / Hız**: rastgele haritanın doluluğu ve küpün hızı.
- **Kamera görünümleri**: Perspektif · Üstten · İzometrik · Takip (kamera küpü izler). Seçili görünüme tekrar dokunmak o açıya sıfırlar.
- **✋ (sağ üst)**: parmakla kamera kontrolü.
  - Açık: 1 parmak / sol tık döndürür, 2 parmak yakınlaştırır ve kaydırır (pan), sağ tık kaydırır.
  - Kapalı: dokunmak arenayı düzenler; 2 parmak yine yakınlaştırır ve kaydırır, sağ tık döndürür.

## Geliştirme

```bash
npm install
npm run dev           # geliştirme sunucusu
npm run build         # dist/ (GitHub Pages)
npm run build:single  # dist-single/index.html — tek dosya, her yerde açılır
npm test              # algoritma ve geometri testleri
```

Arayüz bileşenleri `src/components/ui/` altında (shadcn/ui, Tailwind v4).

Yeni bir yol bulma yöntemi eklemek için `src/algorithms/` altına `(size, walls, start, goal) => { visited, path }` imzalı bir fonksiyon yaz ve `src/algorithms/index.js` içindeki `METHODS` listesine ekle. `methods.test.js` her hazır yöntemin geçerli bir yol döndürdüğünü otomatik test eder.
