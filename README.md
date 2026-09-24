# tarhely-cli

Letölti a hivatali tárhelyed (tarhely.gov.hu) beérkezett leveleit a gépedre, az
Ügyfélkapu+ belépőddel, parancssorból. **Csak olvas**: a portálon semmit nem küld, nem
töröl, nem helyez át. Nem hivatalos eszköz, nincs köze az államhoz.

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
- **Nem** beszél mással, csak a `*.gov.hu` címekkel. Nincs telemetria, nincs
  frissítés-ellenőrzés, nincs saját szerver.

## Előfeltételek

1. **Node.js 20 vagy újabb** — [nodejs.org](https://nodejs.org). Ellenőrzés: `node --version`.
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
    2026-09-08_1263939602026…_feladasi-igazolas/
      feladasi_igazolas.pdf                 # az eredeti fájl, ahogy a portál adta
      kibontva/                             # ha zip volt, a tartalma
      meta.json                             # feladó, tárgy, dátum, érkeztetési szám
  12345678-pelda-kft/
    …
```

Az `index.jsonl` miatt a `download` idempotens: ugyanabba a mappába akárhányszor
futtathatod, csak az új leveleket hozza le. Ha egy levél letöltése elbukik, a többi
megy tovább, és a bukott levél a következő futáson újra sorra kerül.

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
kerül, a kilépési kód pedig a hiba osztályát adja (lásd lent).

## Biztonság

- **Hol van a belépőm?** A rendszer kulcstartójában, `tarhely-cli` néven. Törlés:
  `npx tarhely-cli forget`, vagy a kulcstartó saját felületén.
- **Mit lát az eszköz?** A felhasználónevet, a jelszót és a TOTP-seedet, kizárólag a
  belépés pillanatában, a saját gépeden futó böngészőben. Képernyőképet a belépési
  lépésekről sosem készít.
- **Hová beszél?** Csak `kau.gov.hu`, `idp.gov.hu` és `tarhely.gov.hu` (és aldomainjeik)
  felé; minden más kérést a böngésző elutasít. A forrás nyílt, ellenőrizhető:
  `src/browser.ts`.
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
| 2 | nincs belépő | `npx tarhely-cli init` |
| 3 | belépés sikertelen | rossz felhasználónév, jelszó vagy seed: `init` újra; pontatlan gép-óra is okozhatja |
| 4 | a portál megváltozott | a portál felülete átalakult; futtasd `--debug-dir ./debug`-gal, és [nyiss issue-t](https://github.com/godavid/tarhely-cli/issues) a képernyőképpel |
| 5 | részleges letöltés | néhány levél nem jött le; futtasd újra |

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

Fejlesztéshez: `pnpm install`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
Agenteknek szóló megjegyzések: `AGENTS.md`.

---

## English summary

`tarhely-cli` logs in to the Hungarian government mailbox (tarhely.gov.hu) with the
user's own Ügyfélkapu+ account (username, password and TOTP secret stored in the OS
keychain), lists the available mailboxes and downloads incoming letters into
per-letter folders with extracted contents and a JSONL index. It is strictly
read-only, talks only to `*.gov.hu` hosts and ships an
[Agent Skills](https://agentskills.io) definition (`skills/tarhely-cli/SKILL.md`) so
coding agents can drive it without ever handling credentials. Install the skill with
`npx skills add godavid/tarhely-cli`. Unofficial, MIT-licensed, no warranty.
