---
name: tarhely-cli
description: Ügyfélkapu+ (KAÜ) belépés és a hivatali tárhely (tarhely.gov.hu) beérkezett leveleinek listázása és letöltése parancssorból, kizárólag olvasó módban. Use when the user mentions tárhely, hivatali kapu, Ügyfélkapu, Ügyfélkapu+, KAÜ, e-ügyintézés, hatósági levél, értesítési tárhely, or wants to download, back up or list official Hungarian government letters. Never ask the user for credentials in chat; the user runs `npx tarhely-cli init` themselves.
license: MIT
compatibility: Node.js 20+, npx, internet access to *.gov.hu. The user's own Ügyfélkapu+ account with an authenticator app (TOTP).
metadata:
  author: godavid
  version: "0.1"
---

# tarhely-cli

Parancssori eszköz, amely belép a felhasználó Ügyfélkapu+ fiókjával a hivatali
tárhelyre, és letölti a beérkezett leveleket. **Csak olvas**: a portálon semmit nem
küld, nem töröl, nem helyez át. Kizárólag `*.gov.hu` felé beszél.

## Aranyszabályok

1. **Belépőt (felhasználónév, jelszó, TOTP-seed) soha ne kérj a chatben, és soha ne
   adj át argumentumban vagy env-ben** a felhasználó kifejezett kérése nélkül. A belépő
   rögzítése a felhasználó dolga, a saját terminálában: `npx tarhely-cli init`.
2. **Első lépésként mindig** `npx tarhely-cli doctor --json`. A kimenet megmondja, mi
   hiányzik (Node, Chromium, belépő, hálózat).
3. `--json`-nal futtass minden parancsot: a stdout egyetlen JSON-objektum, a kilépési
   kód a hiba osztályát adja. Ember-olvasható szöveg csak `--json` nélkül, a stderr-en.
4. A letöltött iratok hatósági dokumentumok. **Ne küldd el, ne töltsd fel sehová**, ne
   idézd a tartalmukat külső szolgáltatásnak a felhasználó kérése nélkül.
5. `forget` (belépő törlése) csak a felhasználó kifejezett kérésére.

## Parancsok

```bash
npx tarhely-cli doctor --json                       # környezet-ellenőrzés, belépés nélkül
npx tarhely-cli mailboxes --json                    # elérhető postafiókok (személyes, céges)
npx tarhely-cli list --json [--mailbox X] [--since YYYY-MM-DD] [--out ./tarhely]
npx tarhely-cli download --json --out ./tarhely [--mailbox X] [--since YYYY-MM-DD] [--max N] [--no-extract]
npx tarhely-cli forget --yes                        # CSAK a felhasználó kérésére
```

- `--mailbox`: `all` (alap), sorszám (`1`, `2`), vagy a név egy részlete (`céges`, `12345678`).
- `--since`: csak az ettől a naptól érkezett levelek.
- `--out`: a letöltési mappa; itt él az `index.jsonl`, ezért a `download` idempotens
  (ugyanabba a mappába futtatva csak az újakat tölti le).
- `list --out <mappa>` megjelöli, melyik levél van már meg (`isNew: false`).

## Kilépési kódok

| Kód | Jelentés | Mit tegyél |
| --- | --- | --- |
| 0 | siker | dolgozd fel a JSON-t |
| 1 | egyéb hiba | olvasd el `error` és `hint` mezőt, mondd el a felhasználónak |
| 2 | nincs belépő | kérd meg a felhasználót: futtassa `npx tarhely-cli init` a saját terminálában, majd folytasd |
| 3 | belépés sikertelen | rossz felhasználónév/jelszó/seed: a felhasználó `init`-tel rögzítse újra; NE találgass |
| 4 | a portál megváltozott | futtasd újra `--debug-dir ./tarhely-debug`-gal, és javasold issue nyitását a képernyőképpel |
| 5 | részleges letöltés | a `failures` tömb mondja, mely levelek buktak; újrafuttatás újra megpróbálja őket |

## A `download --json` kimenete

```json
{
  "ok": true, "code": 0, "outDir": "/abs/tarhely",
  "downloaded": 2, "failed": 0, "skippedByLimit": 0,
  "mailboxes": [{ "mailbox": "Értesítési tárhely", "total": 14, "fresh": 2, "downloaded": 2, "failed": 0, "quotaPercent": 3.1 }],
  "letters": [{ "eid": "…", "mailbox": "…", "receivedOn": "2026-09-08", "sender": "…", "type": "…", "desc": "…", "dir": "ertesitesi-tarhely/2026-09-08_…_feladasi-igazolas", "file": "…pdf", "extracted": ["kibontva/…"] }],
  "failures": [],
  "steps": [{ "step": "logged-in", "ok": true, "detail": "…", "at": "…" }]
}
```

Minden levél saját mappát kap: `<out>/<postafiók>/<dátum>_<érkeztetési szám>_<leírás>/`
benne az eredeti fájl, a kibontott tartalom (`kibontva/`) és egy `meta.json`.

## Tipikus kérések

| A felhasználó mondja | Te futtatod |
| --- | --- |
| „Töltsd le a tárhelyem leveleit” | `doctor --json` → `download --json --out ./tarhely` |
| „Jött-e új hatósági levelem?” | `list --json --out ./tarhely` és szűrd `isNew: true`-ra |
| „Csak a céges postafiókot” | `mailboxes --json` → `download --json --mailbox <sorszám>` |
| „Az augusztusiakat” | `download --json --since 2026-08-01` |
| „Mi van a letöltött levélben?” | olvasd a `meta.json`-t és a `kibontva/` PDF-et helyben |

## Hibaelhárítás

- A `doctor` `chromium: hiányzik` → `npx playwright install chromium` (az `init` is megteszi).
- Linuxon `kulcstartó nem érhető el` → Secret Service háttér kell (gnome-keyring, KWallet),
  vagy a felhasználó dönthet az env-változók mellett (`TARHELY_USERNAME`,
  `TARHELY_PASSWORD`, `TARHELY_TOTP_SEED`) — ezt csak ő állítsa be.
- A belépés TOTP-lépése pontatlan rendszeróránál bukik: kérd meg, ellenőrizze a gép óráját.
