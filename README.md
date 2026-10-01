# r3f-yolbulan

React Three Fiber + shadcn/ui ile 3B yol bulma (A*) demosu: yarı saydam mavi küp, yeşil **START** silindirinden kırmızı **FINISH** silindirine en kısa yolu bulup yuvarlanarak gider.

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
  - Start: yeşil başlangıç silindirini o kareye taşı
  - Finish: kırmızı bitiş silindirini o kareye taşı
- **Yolu Bul**: A* ile Start → Finish yolunu arar, taranan kareleri gösterir, sonra mavi küp yolu izler. (Boşluk/Enter da çalışır.)
- **Rastgele**: seçili yoğunlukta, her zaman çözülebilir rastgele engeller.
- **Temizle**: tüm engelleri siler.
- **Engel yoğunluğu / Hız**: rastgele haritanın doluluğu ve küpün hızı.
- Kamera: sağ tık sürükle (masaüstü) veya iki parmak (telefon) ile döndür/yakınlaştır.

## Geliştirme

```bash
npm install
npm run dev           # geliştirme sunucusu
npm run build         # dist/ (GitHub Pages)
npm run build:single  # dist-single/index.html — tek dosya, her yerde açılır
npm test              # A* testleri
```

Arayüz bileşenleri `src/components/ui/` altında (shadcn/ui, Tailwind v4).
