# r3f-yolbulan

React Three Fiber ile 3B yol bulma (A*) oyun alanı: turuncu küp, yeşil START küpünden kırmızı FINISH küpüne en kısa yolu bulup yuvarlanarak gider.

Canlı demo: https://billylz.## Kullanım

- **MOD** (sol üst): dokundukça `ENGEL → START → FINISH` arasında değişir. Sonra arenada bir kareye dokun:
  - ENGEL: engel koy/kaldır (fareyle sürükleyerek çizebilirsin)
  - START: yeşil başlangıç küpünü o kareye taşı
  - FINISH: kırmızı bitiş küpünü o kareye taşı
- **YOLU BUL**: A* ile START → FINISH yolunu arar, taranan kareleri gösterir, sonra turuncu küp yolu izler. (Boşluk/Enter da çalışır.)
- **RASTGELE**: her zaman çözülebilir rastgele engeller.
- **TEMİZLE** (sağ üst): tüm engelleri siler.
- Kamera: sağ tık sürükle (masaüstü) veya iki parmak (telefon) ile döndür/yakınlaştır.

ağ tık sürükle (masaüstü) veya iki parmak (telefon) ile döndür/yakınlaştır.

## Test

```bash
npm test
```
