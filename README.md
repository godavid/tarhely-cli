# tarhely-cli

Letölti a hivatali tárhelyed (tarhely.gov.hu) beérkezett leveleit a gépedre, az
Ügyfélkapu+ belépőddel, parancssorból. **Csak olvas**: a portálon semmit nem küld, nem
töröl, nem helyez át. Nem hivatalos eszköz, nincs köze az államhoz.

> **Állapot (2026-10-27): az npm-csomag még nincs kiadva.** Az `npx tarhely-cli …` és az
> `npm install -g tarhely-cli` most 404-es hibával bukik. Ha közben valaki más ad ki ilyen
> nevű csomagot, az `npx` az ő kódját futtatná, és az `init` neki adná a jelszavadat és a
> TOTP-seededet. Addig forrásból futtasd:
>
> ```bash
> git clone https://github.com/godavid/tarhely-cli
> cd tarhely-cli
> # Node.js 22.13 vagy újabb kell (node --version)
> corepack enable        # Node 25-től előbb: npm install -g corepack
> pnpm install --frozen-lockfile
> pnpm build
> node dist/cli.js init
> ```
>
> Ilyenkor a lenti parancsokban és az eszköz saját „Tanács” soraiban is az `npx tarhely-cli`
> helyére `node <a klón útja>/dist/cli.js` kerül.

Kinek jó: aki nem akarja, hogy a hatósági levelei 30 nap után eltűnjenek a tárhelyről;
aki egy mappában, kereshetően szeretné látni őket; aki az AI-agentjével
(Claude Code, Codex, Gemini CLI és társai) szeretné kezelni a hivatalos postáját.

```bash
npx tarhely-cli init            # egyszer: belépő rögzítése a rendszer kulcstartójába
npx tarhely-cli download        # utána: az új levelek a ./tarhely mappába
```

## Mit csinál, mit nem

- Belép az Ügyfélkapu+ fiókoddal (felhasználónév + jelszó + a hitelesítő alkalmazás
  kódja, amit a gépen tárolt kulcsból maga állít elő).
- Kilistázza az elérhető postafiókokat (személyes, illetve az általad képviselt cégek).
- Letölti a beérkezett leveleket egyenként, levelenként egy mappába, kibontja a zipet,
  és jegyzéket vezet (`index.jsonl`), ezért újrafuttatva csak az újakat hozza.
- **Nem** küld levelet, **nem** töröl, **nem** nyúl a tartós tárhoz, **nem** intéz ügyet.
  Ha később jön e-Papír támogatás, az is csak piszkozatot készít majd; a küldés gombot
  mindig te nyomod meg.
- **Nem** beszél mással, csak a `kau.gov.hu`, `idp.gov.hu` és `tarhely.gov.hu` címekkel
  (és a `kau.gov.hu`, `tarhely.gov.hu` aldomainjeivel). Egyetlen kivétel: az `init`
  egyszer letölti a Chromiumot a Playwright szerveréről. Nincs telemetria, nincs
  frissítés-ellenőrzés, nincs saját szerver.

## Előfeltételek

1. **Node.js 20.16 vagy újabb (a 22-es ágon 22.4 vagy újabb)** — [nodejs.org](https://nodejs.org). Ellenőrzés: `node --version`.
   Forrásból futtatáshoz (lásd „Állapot”) Node.js 22.13 vagy újabb kell: a repó
   `pnpm@11.6.0`-ja 21.x és 22.0–22.12 alatt el sem indul.
2. **Ügyfélkapu+ hitelesítő alkalmazással.** Ha még e-mailes kóddal lépsz be, előbb
   [állíts át hitelesítő alkalmazásra](https://kau.gov.hu/dap/sugo/ugyfelkapu-plusz).
3. **A hitelesítő alkalmazás kulcsa** (TOTP-seed). Ezt az Ügyfélkapu+ a hitelesítő
   alkalmazás beállításakor mutatja meg egyszer, lásd lent.

### A TOTP-seed megszerzése

Az Ügyfélkapu+ a hitelesítő alkalmazás regisztrációjakor egy QR-kódot mutat. A QR-kód
alatt a **„Nem tudom beolvasni a kódot”** feliratra kattintva megjelenik a kód szöveges
alakja: egy betű-szám sorozat (base32). **Ez a TOTP-seed.**

- Olvasd be a QR-kódot a telefonos alkalmazásba is (Google Authenticator, Microsoft
  Authenticator, NISZ Hitelesítő, Aegis…), ÉS másold ki a szöveges kulcsot. Ugyanaz a
  kulcs kerül mindkét helyre, tehát a telefon és a gép ugyanazt a kódot fogja mutatni.
- Ha már régebb óta használsz hitelesítő alkalmazást, és nem mentetted el a kulcsot,
  akkor a beállítást **újra el kell végezni** (új QR-kód = új kulcs): az Ügyfélkapu+
  beállításainál törölni kell a hitelesítő alkalmazást, majd újra regisztrálni. Ekkor a
  telefonos alkalmazásban is a friss QR-kódot olvasd be.
- A regisztráció végén kapott **törlőkódot** tedd el: ezzel tudod kikapcsolni az
  Ügyfélkapu+-t, ha a telefon és a gép is elveszne.

A kulcsot az `init` rejtve kéri be, és csak a rendszer kulcstartójába írja (macOS
Keychain, Windows Credential Manager, Linux Secret Service). Fájlba nem kerül.

## Telepítés és első futtatás

```bash
npx tarhely-cli init
```

Ez sorban: bekéri a felhasználónevet, a jelszót és a TOTP-seedet (a jelszó és a seed
gépelés közben nem látszik), elmenti őket a kulcstartóba, telepíti a Playwright
Chromiumját (egyszeri, kb. 150 MB), és próbaképp belép. Siker esetén kilistázza a
postafiókjaidat.

Tartósan telepíteni nem kötelező; ha mégis: `npm install -g tarhely-cli`, és akkor
`tarhely-cli download` az `npx` nélkül is megy.

## Használat

```bash
npx tarhely-cli doctor                      # minden rendben van-e (belépés nélkül)
npx tarhely-cli mailboxes                   # postafiókok: 1. Értesítési tárhely, 2. …
npx tarhely-cli list                        # a beérkezett levelek listája, letöltés nélkül
npx tarhely-cli download --out ./tarhely    # új levelek letöltése ide
npx tarhely-cli download --mailbox 2        # csak a második postafiók
npx tarhely-cli download --since 2026-08-01 # csak az ettől érkezettek
npx tarhely-cli forget                      # belépő törlése a kulcstartóból
```

A letöltés eredménye:

```
tarhely/
  index.jsonl                               # jegyzék, soronként egy levél
  ertesitesi-tarhely/
    2026-09-08_000000012026090800000001_feladasi-igazolas/
      feladasi_igazolas.pdf                 # az eredeti fájl, ahogy a portál adta
      kibontva/                             # ha zip volt, a tartalma
      meta.json                             # feladó, tárgy, dátum, érkeztetési szám
  12345678-pelda-kft/
    …
```

Az `index.jsonl` miatt a `download` idempotens: ugyanabba a mappába akárhányszor
futtathatod, csak az új leveleket hozza le. Ha egy levél letöltése elbukik, a többi
megy tovább, és a bukott levél a következő futáson újra sorra kerül.

Ha a letöltési mappa egy git-repón belül van, és nincs a `.gitignore`-ban, a `download`
el sem indul (1-es kód), hogy a hatósági levelek ne kerülhessenek véletlenül commitba.
Ilyenkor adj meg repón kívüli mappát, vagy vedd fel a mappát a `.gitignore`-ba.

## Használat AI-agenttel

Az eszköz úgy készült, hogy egy agent (Claude Code, Codex, Gemini CLI, Cursor…) vezesse
helyetted. Ehhez telepítsd a hozzá tartozó skillt:

```bash
npx skills add godavid/tarhely-cli
```

(Vagy másold a `skills/tarhely-cli` mappát oda, ahol az agented a skilleket keresi, pl.
`~/.claude/skills/`.)

Utána elég ennyit mondanod az agentnek: *„Töltsd le a tárhelyem új leveleit, és mondd
el, mi jött.”* Az agent lefuttatja a `doctor`-t, ha kell, megkér, hogy a saját
terminálodban futtasd az `init`-et (a belépőt soha nem kéri el a chatben), majd letölti
és elolvassa a leveleket a mappából.

Agenteknek a gépi felület a `--json` kapcsoló: a stdout-ra egyetlen JSON-objektum
kerül, a kilépési kód pedig a hiba osztályát adja (lásd lent). Hibás kapcsolónál, rossz
`--since`/`--max` értéknél vagy ismeretlen parancsnál nincs JSON: a hiba a stderr-en
jelenik meg, 1-es kóddal.

## Biztonság

- **Hol van a belépőm?** A rendszer kulcstartójában, `tarhely-cli` néven. Törlés:
  `npx tarhely-cli forget`, vagy a kulcstartó saját felületén.
- **Mit lát az eszköz?** A felhasználónevet, a jelszót és a TOTP-seedet, kizárólag a
  belépés pillanatában, a saját gépeden futó böngészőben. Képernyőképet csak hibánál és
  csak `--debug-dir` mellett készít: a belépésből legfeljebb a KAÜ-választó lapról, még a
  titkok begépelése előtt, utána csak a sikeres belépés után. A kitöltött belépési
  űrlapról sosem.
- **Hová beszél?** A böngésző csak a `kau.gov.hu`, `idp.gov.hu` és `tarhely.gov.hu`
  címek, valamint a `kau.gov.hu` és `tarhely.gov.hu` aldomainjei felé enged kérést;
  minden mást elutasít. A forrás nyílt, ellenőrizhető: `src/browser.ts` (`ALLOWED_HOSTS`).
- **Ha a gépem illetéktelen kézbe kerül?** Aki a kulcstartódhoz hozzáfér, az a
  belépődhöz is. Ilyenkor az Ügyfélkapu+ beállításainál regisztráld újra a hitelesítő
  alkalmazást (új kulcs), és változtass jelszót.
- **Szervereken, CI-ban** a belépő env-változóban is megadható (`TARHELY_USERNAME`,
  `TARHELY_PASSWORD`, `TARHELY_TOTP_SEED`); ilyenkor a titok kezelése a futtató
  környezet felelőssége.

## Hibák és kilépési kódok

| Kód | Jelentés | Teendő |
| --- | --- | --- |
| 0 | siker | – |
| 1 | egyéb hiba | a kiírt üzenet és tanács szerint |
| 2 | nincs (vagy hiányos) belépő | `npx tarhely-cli init`; ha a hiba a kulcstartót vagy a `TARHELY_*` változókat említi, előbb azt javítsd: Linuxon Secret Service háttér kell (gnome-keyring, KWallet), env-ben pedig mindhárom változó együtt kell |
| 3 | belépés sikertelen | rossz felhasználónév, jelszó vagy seed: `init` újra; pontatlan gép-óra is okozhatja |
| 4 | a portál megváltozott | a portál felülete átalakult; [nyiss issue-t](https://github.com/godavid/tarhely-cli/issues) a hibaüzenettel és a lépések nevével; a postafiók- és cégnevet, törzsszámot, érkeztetési számot és levélleírást előtte takard ki. Ha `--debug-dir ~/tarhely-debug`-gal képet is készítesz, az csak neked szól: a képernyőkép és az `.aria.yaml` a belépés utáni lapot mutatja (feladók, tárgyak, cégnevek), ezért nyilvános issue-ba kitakarás nélkül ne tedd fel |
| 5 | részleges letöltés | néhány levél nem jött le; futtasd újra. Ha a hiba zip-korlátot (2000 bejegyzés, 200 MB kibontva) vagy gyanús zip-útvonalat említ, az újrafuttatás nem segít: töltsd le `--no-extract`-tal, kibontás nélkül |

`--headed` kapcsolóval látható böngészőben fut, így magad is végignézheted, mit csinál.

## Jogi megjegyzés

Ez egy független, közösségi eszköz; nem az állam, nem a NISZ és nem az IdomSoft
terméke. Saját Ügyfélkapu+ fiókoddal, saját felelősségedre használod. A KAÜ és az
Ügyfélkapu általános szerződési feltételeiben a szerző nem talált a saját fiók gépi
használatát tiltó pontot, de a mindenkori feltételek ellenőrzése a felhasználó dolga.
A letöltött iratok hatósági dokumentumok: kezeld őket ennek megfelelően.

## Karbantartás

A portál felülete időnként változik, és akkor az eszköz eltörik (4-es kód). Nincs
támogatási vállalás; issue-t és pull requestet szívesen fogadok. A kód MIT-licencű.

Fejlesztéshez: `pnpm install --frozen-lockfile`. A CI ezután sorban a `pnpm lint`,
`pnpm typecheck`, `pnpm test` és `pnpm build` parancsot futtatja.
Agenteknek szóló megjegyzések: `AGENTS.md`.

---

## English summary

`tarhely-cli` logs in to the Hungarian government mailbox (tarhely.gov.hu) with the
user's own Ügyfélkapu+ account (username, password and TOTP secret stored in the OS
keychain), lists the available mailboxes and downloads incoming letters into
per-letter folders with extracted contents and a JSONL index. It is strictly
read-only, its browser talks only to `kau.gov.hu`, `idp.gov.hu` and `tarhely.gov.hu`
(plus the kau/tarhely subdomains; `init` downloads Chromium once from Playwright's CDN),
and it ships an [Agent Skills](https://agentskills.io) definition
(`skills/tarhely-cli/SKILL.md`) so coding agents can drive it without ever handling
credentials. Install the skill with `npx skills add godavid/tarhely-cli`. As of
2026-10-27 the npm package is not published yet: run the CLI from a source checkout
(see „Állapot” above), never from a look-alike npm package. Unofficial, MIT-licensed,
no warranty.
