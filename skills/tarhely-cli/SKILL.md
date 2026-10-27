---
name: tarhely-cli
description: Ügyfélkapu+ (KAÜ) belépés és a hivatali tárhely (tarhely.gov.hu) beérkezett leveleinek listázása és letöltése parancssorból, kizárólag olvasó módban. Use when the user mentions tárhely, hivatali kapu, Ügyfélkapu, Ügyfélkapu+, KAÜ, e-ügyintézés, hatósági levél, értesítési tárhely, or wants to download, back up or list official Hungarian government letters. Never ask the user for credentials in chat; the user runs `init` in their own terminal. The npm package is not published yet, so never run or suggest `npx tarhely-cli` or a look-alike package; run the CLI from a source checkout as the skill body explains.
license: MIT
compatibility: Node.js 20.16+ (on 22.x, 22.4+), npx, internet access to kau.gov.hu, idp.gov.hu and tarhely.gov.hu; the first run also downloads Chromium from Playwright's CDN. The user's own Ügyfélkapu+ account with an authenticator app (TOTP).
metadata:
  author: godavid
  version: "0.1"
---

# tarhely-cli

Parancssori eszköz, amely belép a felhasználó Ügyfélkapu+ fiókjával a hivatali
tárhelyre, és letölti a beérkezett leveleket. **Csak olvas**: a portálon semmit nem
küld, nem töröl, nem helyez át. A böngészője csak a `kau.gov.hu`, `idp.gov.hu` és
`tarhely.gov.hu` (és a `kau.gov.hu`, `tarhely.gov.hu` aldomainjei) felé enged kérést
(`src/browser.ts`); a Chromiumot egyszer a Playwright szerveréről tölti le (`init`,
illetve a klón mappájában `pnpm exec playwright install chromium`).

> **Állapot (2026-10-27):** a `tarhely-cli` még nincs kiadva az npm-en, ezért az
> `npx tarhely-cli …` 404-es hibával bukik. Ne keress és ne futtass helyette más,
> hasonló nevű csomagot: az `init` a felhasználó jelszavát és TOTP-seedjét kéri. Ha a
> felhasználó forrásból telepítette ([README](https://github.com/godavid/tarhely-cli#readme),
> „Állapot”), a lenti parancsokban és a CLI saját `hint`/`detail` szövegeiben is (azok még
> `npx tarhely-cli …`-t írnak) az `npx tarhely-cli` helyére `node <a klón útja>/dist/cli.js`
> kerül; a felhasználónak is így add tovább. Ha nem, ajánld fel a forrásból telepítést a
> README szerint; az `init`-et akkor is a felhasználó futtassa.

## Aranyszabályok

1. **Belépőt (felhasználónév, jelszó, TOTP-seed) soha ne kérj a chatben, és soha ne
   adj át argumentumban vagy env-ben** a felhasználó kifejezett kérése nélkül. A belépő
   rögzítése a felhasználó dolga, a saját terminálában: `npx tarhely-cli init`.
2. **Első lépésként mindig** `npx tarhely-cli doctor --json`. A kimenet megmondja, mi
   hiányzik (Node, Chromium, belépő, hálózat).
3. `--json`-nal futtass minden parancsot (az `init` kivétel: azt csak a felhasználó
   futtatja, `--json` nélkül). A stdout egyetlen JSON-objektum, a kilépési kód a hiba
   osztályát adja. Kivétel: hibás kapcsolónál, rossz `--since`/`--max` értéknél és
   ismeretlen parancsnál nincs JSON, a hiba a stderr-en van (1-es kód); ilyenkor a
   stderr-t olvasd. Ember-olvasható szöveg csak `--json` nélkül, a stderr-en.
4. A letöltött iratok hatósági dokumentumok. **Ne küldd el, ne töltsd fel sehová**, ne
   idézd a tartalmukat külső szolgáltatásnak a felhasználó kérése nélkül.
5. `forget` (belépő törlése) csak a felhasználó kifejezett kérésére.

## Parancsok

```bash
npx tarhely-cli doctor --json                       # környezet-ellenőrzés, belépés nélkül
npx tarhely-cli mailboxes --json                    # elérhető postafiókok (személyes, céges)
npx tarhely-cli list --json [--mailbox X] [--since YYYY-MM-DD] [--out ./tarhely]
npx tarhely-cli download --json --out ./tarhely [--mailbox X] [--since YYYY-MM-DD] [--max N] [--no-extract]
npx tarhely-cli forget --json --yes                 # CSAK a felhasználó kérésére
```

- `--mailbox`: `all` (alap), sorszám a `mailboxes` listájából (`1`, `2`), vagy a név egy
  részlete (pl. `példa`). A csak számjegyből álló érték mindig sorszám: a törzsszámot
  (`12345678`) is sorszámnak venné, és 1-es kóddal bukna; ilyenkor a sorszámot add meg.
- `--since`: a `download` csak az ettől a naptól érkezett leveleket tölti le; a `list`
  minden levelet visszaad, a korábbiakat `isNew: false`-szal. Felső határ nincs.
- `--out`: a letöltési mappa (alap: `./tarhely`); itt él az `index.jsonl`, ezért a
  `download` idempotens (ugyanabba a mappába futtatva csak az újakat tölti le).
- A `download` 1-es kóddal megáll, mielőtt belépne, ha az `--out` mappa egy git-munkafán
  belül van, és nincs a `.gitignore`-ban („git-repóban van” üzenet), hogy a hatósági
  levelek ne kerülhessenek commitba. Agentként a munkakönyvtárad gyakran egy repó:
  ilyenkor kérdezd meg a felhasználót, hová töltsön (repón kívüli mappa, pl.
  `~/tarhely`), és a `.gitignore`-t kérés nélkül ne írd át.
- A `list` az `--out` mappa (alap: `./tarhely`) `index.jsonl`-jéhez méri az `isNew`
  mezőt, ezért ugyanazt a mappát add meg, mint a `download`-nál. `isNew: false`, ha a
  levél már megvan, ha a `--since` előtt érkezett, vagy ha nincs érkeztetési száma.

## Kilépési kódok

| Kód | Jelentés | Mit tegyél |
| --- | --- | --- |
| 0 | siker | dolgozd fel a JSON-t; ha `skippedByLimit` > 0, a `--max` korlát (alap: 200) miatt maradt letöltetlen levél: futtasd újra |
| 1 | egyéb hiba | olvasd el `error` és `hint` mezőt, mondd el a felhasználónak |
| 2 | nincs (vagy hiányos) belépő | olvasd el a hibát (`hint`; a `doctor`-nál a `belepo` ellenőrzés `detail`-jét). Kulcstartó-hibánál vagy hiányos `TARHELY_*` env-nél lásd Hibaelhárítás; egyébként kérd meg a felhasználót: futtassa `npx tarhely-cli init` a saját terminálában, majd folytasd |
| 3 | belépés sikertelen | rossz felhasználónév/jelszó/seed: a felhasználó `init`-tel rögzítse újra; NE találgass |
| 4 | a portál megváltozott | mondd el a felhasználónak a hibát, és javasolj issue-t a `steps[].step` és `ok` mezőkkel. Az `error` szövege és a `steps[].detail` postafiók- és cégnevet, törzsszámot, érkeztetési számot és levélleírást tartalmazhat: ezek csak a felhasználó átnézése és kitakarása után kerülhetnek az issue-ba. Issue-t csak a felhasználó nyisson. `--debug-dir`-t csak a kérésére használj, repón kívüli mappába (pl. `~/tarhely-debug`). A képernyőkép és az `.aria.yaml` a belépés utáni lapot mutatja (feladók, tárgyak, cégnevek): ne töltsd fel, ne csatold sehová, és ne tedd git-repóba, akkor sem, ha a `hint` mást javasol |
| 5 | részleges letöltés | a `failures` tömb (`{ "eid", "mailbox", "error" }`) mondja, mely levelek buktak; az újrafuttatás újra megpróbálja őket. Felső szintű `error` mező itt nincs. Ha egy `failures[].error` zip-korlátot (2000 bejegyzés, 200 MB kibontva) vagy gyanús zip-útvonalat említ, az újrafuttatás nem segít: kérdezd meg a felhasználót, letöltsd-e `--no-extract`-tal, kibontás nélkül |

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
benne az eredeti fájl (a neve a `file` mezőben), zipnél a kibontott tartalom
(`kibontva/`) és egy `meta.json`.

## Tipikus kérések

A `<mappa>` a letöltési mappa: mindig ugyanazt add meg (lásd `--out` fent).

| A felhasználó mondja | Te futtatod |
| --- | --- |
| „Töltsd le a tárhelyem leveleit” | `doctor --json` → `download --json --out <mappa>` |
| „Jött-e új hatósági levelem?” | `list --json --out <mappa>` és szűrd `isNew: true`-ra |
| „Csak a céges postafiókot” | `mailboxes --json` → `download --json --out <mappa> --mailbox <sorszám>` |
| „Az augusztusiakat” | `download --json --out <mappa> --since 2026-08-01`. Felső határ nincs: az augusztus 1. óta érkezett összes új levelet letölti. Ha a későbbiek nem kellenek, előbb `list --json --out <mappa>`, és a `receivedOn` alapján kérdezz |
| „Mi van a letöltött levélben?” | olvasd a levél mappájában a `meta.json`-t, majd a `file` mezőben megadott eredeti fájlt (zipnél az `extracted` listában szereplő `kibontva/` alatti fájlokat), helyben |

## Hibaelhárítás

- A `doctor` `chromium: hiányzik` → a klón mappájában `pnpm exec playwright install chromium`
  (az `init` is megteszi). A `doctor` és a hiba `npx playwright install chromium`-ot ír, de más
  mappából az `npx playwright` a legújabb Playwrightot hozza, annak a Chromiumát a CLI nem találja.
- Linuxon a `belepo` sor vagy a hiba: `Nem érhető el az operációs rendszer kulcstartója`
  → Secret Service háttér kell (gnome-keyring, KWallet), vagy a felhasználó dönthet az
  env-változók mellett (`TARHELY_USERNAME`, `TARHELY_PASSWORD`, `TARHELY_TOTP_SEED`) —
  ezt csak ő állítsa be. Ilyenkor az `init` sem segít.
- `Hiányos env-belépő` → a három `TARHELY_*` változó csak együtt érvényes, és az env
  megelőzi a kulcstartót, ezért az `init` ezen nem segít: a felhasználó adja meg
  mindhármat, vagy törölje őket.
- A belépés TOTP-lépése pontatlan rendszeróránál bukik: kérd meg, ellenőrizze a gép óráját.
