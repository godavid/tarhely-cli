# AGENTS.md

Ez a repó a `tarhely-cli` npm-csomag: Ügyfélkapu+ belépés és a hivatali tárhely
leveleinek letöltése, csak olvasó módban.

- **Használathoz** (nem fejlesztéshez) a skill a mérvadó: `skills/tarhely-cli/SKILL.md`.
  Telepítés: `npx skills add godavid/tarhely-cli`.
- **Belépőt soha ne kérj a chatben** és ne írj fájlba. A felhasználó a saját
  terminálában futtatja: `npx tarhely-cli init`.
- **Fejlesztéshez**: `pnpm install`, `pnpm test`, `pnpm typecheck`, `pnpm lint`,
  `pnpm build`. A forrás `src/`, a tesztek `test/`. Tesztfixture csak szintetikus
  (`Példa Kft.`, `12345678`); valódi név, törzsszám, érkeztetési szám nem kerülhet a repóba.
- **Invariánsok**: csak `*.gov.hu` hálózat (`src/browser.ts` allowlist); a portálon csak
  olvasó végpontok (`src/tarhely/api.ts`); a belépési lépésekről nincs képernyőkép.
