# r3f-yolbulan

React Three Fiber ile 3B yol bulma (A*) oyun alanı: bir robot START noktasından FINISH bayrağına en kısa yolu bulup yürür.

## Çalıştırma

```bash
npm install
npm run dev
```

## Kullanım

- **MOD** (sol üst): dokundukça `ENGEL → START → FINISH` arasında değişir. Sonra arenada bir kareye dokun:
  - ENGEL: engel koy/kaldır (fareyle sürükleyerek çizebilirsin)
  - START: robotu o kareye taşı
  - FINISH: bitiş bayrağını o kareye taşı
- **A · YOLU BUL**: A* ile START → FINISH yolunu arar, taranan kareleri gösterir, sonra robot yolu yürür.
- **B · RASTGELE**: her zaman çözülebilir rastgele engeller.
- **TEMİZLE** (sağ üst): tüm engelleri siler.
- **Joystick** / ok tuşları / WASD: robotu elle sür. Boşluk/Enter = A.
- Kamera: sağ tık sürükle (masaüstü) veya iki parmak (telefon) ile döndür/yakınlaştır.

## Test

```bash
npm test
```
