# Card Target

A browser card game: arrange cards and choose operations to hit a target number.

## How to play

1. **Pick a target**
   - **Year**: scroll the wheel (or use the arrow keys) to pick a year from 1900 to 2100.
   - **Random 4-digit**: get a random number from 1000 to 9999, and reroll it as often as you like.
2. **Pick how many cards** to deal (4–8), then press **Deal cards**.
3. **Drag cards** to reorder them (works with a mouse or touch).
4. **Tap the gap** between two cards to choose its operation: `+ − × ÷`.
5. Your result updates as you play. Hit the target exactly to win.

Normal order of operations applies: `× ÷` first, then `+ −`.
Card values are 1–13 (A = 1, J = 11, Q = 12, K = 13). The game tries to deal a hand that can be solved, **Show a solution** reveals one, and **Hint: show factors of the target** lists its prime factorization and every factor pair.

## Running it

No build step. Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
```
