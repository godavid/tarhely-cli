# AGENTS.md

Ez a repó a `tarhely-cli` npm-csomag: Ügyfélkapu+ belépés és a hivatali tárhely
leveleinek letöltése, csak olvasó módban.

> **Állapot (2026-10-27):** az npm-csomag még nincs közzétéve (`npm view tarhely-cli`
> → E404), és a név nincs lefoglalva. Amíg ez a bekezdés itt áll, ne futtass és ne
> javasolj `npx tarhely-cli …` vagy `npm install -g tarhely-cli` parancsot: idegen kódot
> futtatna, és az `init` annak adná át a belépőt. Helyben:
> `pnpm install --frozen-lockfile && pnpm build`, majd `node dist/cli.js <parancs>`.
> A CLI saját tanácsai még `npx tarhely-cli …`-t írnak (az 1-es, 2-es és 3-as kód `hint`-je,
> a `doctor` `belepo` ellenőrzésének `detail`-je, az `init` zárósora: `src/errors.ts`,
> `src/store/credentials.ts`, `src/commands/doctor.ts`, `src/commands/init.ts`,
> `src/browser.ts`). Ezeket ne add tovább szó szerint: közzétételig `node dist/cli.js …`
> alakban mondd a felhasználónak.
> A közzététel után ezt a bekezdést töröld (a többi helyet lásd: Ha ehhez nyúlsz, npm-kiadás).

## Olvasási sorrend

1. Ez a fájl: szabályok, invariánsok, kódtérkép, csapdák.
2. Használat, CLI-felület, JSON-kimenet, kilépési kódok: `skills/tarhely-cli/SKILL.md`;
   felhasználói leírás: `README.md`.
3. A módosított forrásfájl fejléc-kommentje (ha van) és a tesztje: `test/<fájlnév>.test.ts`,
   kivéve `src/main.ts` → `test/cli.test.ts` és `src/store/index.ts` →
   `test/index-store.test.ts`. Saját teszt nélkül: `src/cli.ts`, `src/errors.ts`,
   `src/index.ts`, `src/prompt.ts`, `src/kau/login.ts` és a `doctor`-on kívüli
   `src/commands/*`. A `test/session.test.ts` csak a `selectMailboxes`-t nézi, a
   `withSession`-t nem; a `src/tarhely/mailbox.ts`-ből a `test/inbox.test.ts` csak az
   egypostafiókos utat járja be.
   Ezeknél a zöld fókuszált futás nem bizonyíték.

Ütközésnél a kód és a teszt a mérvadó; az eltérő doksit ugyanabban a PR-ben javítsd.
Kivétel az Invariánsok: ha a kód lazább náluk, az hiba, és a doksit csak emberi döntés után
igazítsd hozzá. Doksik között használati kérdésben (parancs, kapcsoló, JSON, kilépési kód) a
`SKILL.md`, fejlesztési kérdésben ez a fájl a mérvadó.

## Szabályok

- **Használathoz** (nem fejlesztéshez) a skill szól: `skills/tarhely-cli/SKILL.md`.
  Telepítés: `npx skills add godavid/tarhely-cli`.
- **Belépőt soha ne kérj a chatben** és ne írj fájlba. A felhasználó a saját
  terminálában futtatja az `init`-et (közzétételig `node dist/cli.js init`, lásd Állapot).
- **Élő portál csak a tulajdonos kérésére.** A `mailboxes`, `list`, `download` és `init`
  valódi Ügyfélkapu+-belépést indít a gépen tárolt belépővel (kulcstartó vagy env), vagyis a
  gép tulajdonosának saját hatósági fiókjával. A `download` hatósági iratokat tölt le; a
  letöltés jogi hatása (átvétel) nincs tisztázva. Fejlesztés és hibakeresés közben ezeket ne
  futtasd magadtól: az alap a szintetikus teszt (`test/`). Élő próba csak kifejezett kérésre,
  `--max`-szal és repón kívüli `--out` mappával. A `forget` törli a tárolt belépőt: az is csak
  kérésre. A `doctor` és a `--help` belépés nélkül fut, ezek szabadok.
- **Fejlesztéshez**: `pnpm install --frozen-lockfile`. Helyben fókuszáltan ellenőrizz:
  `pnpm exec vitest run test/<fájlnév>.test.ts`, `pnpm exec biome check <fájl>`, típushibára
  az editor (LSP) diagnosztikája; a CLI-t `pnpm build` után `node dist/cli.js --help`-pel
  próbáld. A teljes kör a CI-ban fut (lásd Landolás és CI). A forrás `src/`, a tesztek `test/`.
- **Tesztfixture csak szintetikus** (`Példa Kft.`, `12345678`, `000000012026010100000001`);
  valódi név, törzsszám, érkeztetési szám nem kerülhet a repóba.
- **Publikus repó.** Más (privát) projektek neve, útvonala, belső azonosítója nem kerülhet
  ide: se kódba, se doksiba, se commit- vagy PR-szövegbe. Ha a származás számít,
  személytelenül írd („a szerző saját rendszeréből”).

## Invariánsok

- **Hálózat**: a böngésző csak az `ALLOWED_HOSTS` hostjaira mehet: `kau.gov.hu`,
  `*.kau.gov.hu`, `idp.gov.hu`, `tarhely.gov.hu`, `*.tarhely.gov.hu` (`src/browser.ts`,
  `context.route`). Ez nem a teljes `*.gov.hu`, és az `idp.gov.hu` aldomainjei sincsenek
  benne. A listát a `test/browser.test.ts` rögzíti; bővítése emberi döntés. Böngészőn kívül
  csak a `doctor` hálózati próbája (`TARHELY_URL`) és az `init` Chromium-letöltése megy ki.
- **Csak olvasás**: a portál REST-hívásai a `src/tarhely/api.ts`-ben vannak:
  `POST /uzenetek/BEERKEZETT/kereses` (keresés), `GET /uzenet/beerkezett/{eid}`,
  `GET /uzenet/letoltes/beerkezett/{eid}`, `GET /mailbox/details`; a `/mailbox/reload`
  választ csak figyeli. A felületen csak postafiók-váltás és felugró ablak bezárása
  történik (`src/tarhely/mailbox.ts`). Küldés, törlés, áthelyezés, címkézés tilos. Teszt
  nem őrzi.
- **Diagnosztika**: képernyőkép és aria-snapshot csak a `withSession` hibaágán
  (`src/session.ts`), a `reporter.capture`-rel (`src/report.ts`), `--debug-dir` mellett. Két
  eset ad képet: a titkok előtti, `capturable = true` hiba (`src/kau/login.ts`, a KAÜ-gomb
  lépése) és a sikeres belépés utáni hiba. A titkok begépelése és a sikeres belépés között
  soha. A belépés utáni kép és `.aria.yaml` a postafiók leveleit mutathatja; alapjoggal,
  git-őr nélkül íródik, ezért nyilvános issue-ba csak kitakarva kerülhet. Teszt nem őrzi.
- **Belépő**: csak a rendszer-kulcstartóban (service `tarhely-cli`, account `default`) vagy
  env-ben (`TARHELY_USERNAME`, `TARHELY_PASSWORD`, `TARHELY_TOTP_SEED`: mind a három vagy
  egyik sem, különben 2-es kód); fájlba vagy parancssori argumentumba soha
  (`src/store/credentials.ts`, `test/credentials.test.ts`).
- **Letöltési mappa**: git-munkafán belüli, nem ignorált `--out` mappába a `download` nem ír,
  1-es kóddal leáll (`src/outdir.ts`, `test/outdir.test.ts`). Másik repóban futva ezért
  repón kívüli `--out` mappát adj meg (ebben a repóban az alap `tarhely/` ignorált). A
  letöltött mappák `0700`, a fájlok `0600` joggal jönnek létre (`src/tarhely/inbox.ts`,
  `src/store/index.ts`, `src/extract.ts`).
- **Postafiók-elszigetelés**: minden API-hívás `address-id` fejléce egyezik a kért
  postafiókéval; eltérésnél 4-es kód, mert más postafiók iratai jönnének (`apiHeaders`,
  `src/tarhely/api.ts`; `test/api.test.ts`).
- **Zip**: kilépő vagy abszolút útnál, 2000-nél több bejegyzésnél vagy 200 MB fölötti
  kibontott méretnél a kibontás leáll (`src/extract.ts`). A `test/extract.test.ts` az
  útvonal-szűrést és a 2000-es korlátot őrzi, a 200 MB-osat nem.

## Kódtérkép

A rétegek körmentesek. Az egyedüli gazdák biztonsági határok: ne kerüld meg őket.

| Terület | Feladat | Importálhat | Tilos / egyedüli gazda |
|---|---|---|---|
| `src/cli.ts`, `src/main.ts` | bin-belépés; `parseCli`, `USAGE`, diszpécser | `commands/*`, `report`, `errors`, `store/credentials` | – |
| `src/commands/` | fájlonként egy parancs; kimenet a riporteren át | `session`, `store/credentials`, `tarhely/inbox`, `browser` (`isChromiumInstalled`), `outdir`, `prompt`, `report`, `errors`, `kau/totp`, `tarhely/api` (csak `TARHELY_URL`) | `kau/login`, saját böngésző, képernyőkép; `fetch` csak a `doctor` hálózati próbája |
| `src/session.ts` | `withSession`: belépő, böngésző, KAÜ-belépés, API-fejlécek, diagnosztika | `browser`, `kau/login`, `tarhely/api`, `report`, `store/credentials`, `errors` | egyedül hívja a `loginToKau`-t és a `reporter.capture`-t |
| `src/browser.ts` | Chromium, hálózati allowlist | `errors` | egyedül indít böngészőt (`chromium.launch`, `context.route`) |
| `src/kau/` | KAÜ-belépés (`login.ts`), TOTP (`totp.ts`) | `errors`, egymás | `tarhely/`, `session`, `report`, `store/` |
| `src/tarhely/` | portál-API (`api.ts`), postafiók-váltás (`mailbox.ts`), lista és letöltés (`inbox.ts`) | `errors`, `extract`, `store/index`, egymás; `kau/login` és `session` csak típusként | `browser`, `store/credentials`, `report`; lapon belüli `fetch` csak az `api.ts`-ben |
| `src/store/` | belépő (`credentials.ts`), jegyzék (`index.ts`, `<out>/index.jsonl`) | `errors` | a belépőt csak a `credentials.ts` olvassa és írja |
| `src/report.ts` | JSON- és emberi kimenet, `--debug-dir` capture | `errors`; `kau/login` csak típusként | JSON-t a stdout-ra csak ez ír |
| `src/errors.ts`, `extract.ts`, `outdir.ts`, `prompt.ts` | kilépési kódok; zip; git-őr; terminál-bekérés | `errors` | – |
| `src/index.ts` | könyvtári újraexport | bármit | ami innen kimegy, nyilvános API |
| `test/` | vitest, szintetikus fixture | `src/*` | valódi portál, belépő, hálózat |

## Ismert csapdák (a legdrágább elöl)

1. **Képernyőkép vagy aria-snapshot a belépőmezők kitöltése után.** Miért: a jelszó és a
   TOTP-kód bekerül az artefaktumba. Helyette: diagnosztika csak a `withSession`-ön át;
   titok előtt `capturable = true`, egyébként csak sikeres belépés után.
2. **Az `ALLOWED_HOSTS` bővítése (pl. `*.gov.hu`).** Miért: a belépő kijuthatna az
   allowlistről. Helyette: konkrét host, emberi jóváhagyással. A `test/browser.test.ts` őrzi.
3. **REST-hívás az `apiRequest`-en kívül, vagy író végpont (küldés, törlés, áthelyezés).**
   Miért: a csomag ígérete a csak olvasás. Helyette: új hívás csak olvasó végponttal, a
   `src/tarhely/api.ts` `apiCall`/`apiRequest` függvényén át.
4. **Valódi név, törzsszám, érkeztetési szám vagy privát projektnév a repóban.** Miért:
   publikus repó, és a gitleaks ezeket nem fogja meg. Helyette: `Példa Kft.`, `12345678`,
   `000000012026010100000001`.
5. **DOM-os letöltés (kijelölés, toolbar, modál).** Miért: élesben sorra eltört. Helyette: a
   REST API (`downloadLetter`).
6. **String átadása a `page.evaluate`-nek.** Miért: a Playwright kifejezésként értékeli, az
   argumentum elvész. Helyette: valódi függvény (`fetchInPage`).
7. **Kattintás a KAÜ-gombra a KAÜ-lap `load` eseménye előtt, vagy fix várakozás.** Miért: a
   lenyíló nem köt be („intercepts pointer events”). Helyette: `waitForKauPage` és az
   `aria-expanded` ellenőrzése (`src/kau/login.ts`).
8. **„Közvetlen futás” ellenőrzés a `src/cli.ts`-ben (`import.meta.url` és `argv[1]`
   összevetése).** Miért: npx/pnpm symlinken a CLI némán semmit nem tesz. Helyette: a
   `cli.ts` mindig futtat, a logika a `main.ts`-ben él.
9. **`require.resolve("playwright/cli")`.** Miért: a playwright nem exportálja ezt az
   útvonalat. Helyette: `dirname(require.resolve("playwright/package.json"))` + `cli.js`
   (`src/commands/init.ts`).
10. **Az `erkezesiDatum` helyi időként olvasása.** Miért: nyári időszámításban két órát
    csúszik, rossz nap kerül a mappanévbe. Helyette: UTC-ben (`apiRow`). A teszt ezt nem
    fogja meg, mert a CI UTC-ben fut.

## Ha ehhez nyúlsz

- **Parancs, kapcsoló, kilépési kód vagy JSON-mező**: `src/main.ts` `USAGE`,
  `skills/tarhely-cli/SKILL.md` és `README.md` ugyanabban a PR-ben.
- **`ALLOWED_HOSTS`**: `test/browser.test.ts`, a host-lista ebben a fájlban, a `README.md`-ben
  és a `SKILL.md`-ben; emberi jóváhagyással.
- **Portálhívás vagy felületi kattintás**: Invariánsok, „Csak olvasás”.
- **`skills/tarhely-cli/SKILL.md`**: a `main`-ről közvetlenül települ külső agentekhez
  (`npx skills add godavid/tarhely-cli`), ezért csak már működő viselkedést írj bele. A
  frontmatter Agent Skills-érvényes marad (`name: tarhely-cli`, egyezik a mappanévvel).
- **`hint`, `detail` vagy hibaszöveg** (főleg `src/errors.ts`, `src/store/credentials.ts`,
  `src/browser.ts`, `src/commands/doctor.ts`): az agentek szó szerint továbbadják. Titok nem
  kerülhet bele, és nem buzdíthat képernyőkép, `.aria.yaml` vagy levéltartalom nyilvános
  feltöltésére. A `SKILL.md` Kilépési kódok táblája ugyanabban a PR-ben.
- **npm-kiadás** (`npm publish`, csak a tulajdonos kérésére): ugyanabban a PR-ben töröld az
  „Állapot” bekezdést és a rá utaló „közzétételig” megjegyzéseket ebből a fájlból, a
  `README.md`-ből (a magyar és az angol részből) és a `SKILL.md`-ből, a `SKILL.md`
  `description` mezőjének „not published yet” mondatát is.

## Szótár

- **KAÜ**: Központi Azonosítási Ügynök (`kau.gov.hu`). **Ügyfélkapu+**: KAÜ-belépés
  felhasználónévvel, jelszóval és TOTP-kóddal.
- **tárhely / hivatali kapu**: a `tarhely.gov.hu` postafiók-portál. Az **Értesítési
  tárhely** a személyes postafiók neve a portálon.
- **postafiók** (`MailboxRef`): egy belépővel látható fiók (személyes vagy képviselt cég);
  `slug` a mappaneve, `addressId` a portál `address-id` fejléce.
- **eid**: érkeztetési szám (API: `erkeztetesiSzam`), a levél azonosítója és az
  `index.jsonl` kulcsa.
- **TOTP-seed**: a hitelesítő alkalmazás base32 kulcsa.
- **`kibontva/`**: a zip tartalma a levél mappáján belül.

## Nyelv

Doksi, kódkomment, commitüzenet és PR magyarul; a tesztcímek (`it(...)`) angolul. A
`README.md` végén az angol összefoglaló marad; a `SKILL.md` `description` mezőjében az angol
trigger-szavak maradnak.

## Landolás és CI

- Magyar conventional commit (`type(scope): leírás`), PR a `main`-re, squash merge `(#n)`
  utótaggal. A `main`-re közvetlenül ne pusholj.
- CI (`.github/workflows/ci.yml`, `check` job, minden PR-en és a `main`-re pusholáskor):
  `pnpm install --frozen-lockfile` → `pnpm lint` → `pnpm typecheck` → `pnpm test` →
  `pnpm build` → gitleaks a teljes git-történeten. Titok a történetben is bukást okoz, és
  törlés után is ott marad (publikus repó).
- A Markdown formáját és tartalmát semmi nem ellenőrzi: a `biome.jsonc` csak a `src/`, a
  `test/` és a JSON-fájlokat nézi. Titokmintára viszont a gitleaks a Markdownt is átvizsgálja
  a teljes történetben, ezért valódinak tűnő példa-jelszó vagy -seed a doksiba se kerüljön.
