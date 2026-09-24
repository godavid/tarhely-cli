// Hibaosztályok, amelyekből a CLI kilépési kódja és a felhasználónak szóló
// tanács származik. Az agentek a kódból döntenek, az ember a tanácsból.

export const EXIT_CODES = {
  ok: 0,
  unknown: 1,
  noCredentials: 2,
  loginFailed: 3,
  portalChanged: 4,
  partial: 5
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

export class TarhelyError extends Error {
  readonly code: ExitCode;
  readonly hint: string | null;

  constructor(code: ExitCode, message: string, hint?: string) {
    super(message);
    this.name = "TarhelyError";
    this.code = code;
    this.hint = hint ?? null;
  }
}

export function noCredentialsError(): TarhelyError {
  return new TarhelyError(
    EXIT_CODES.noCredentials,
    "Nincs rögzített Ügyfélkapu+ belépő.",
    "Futtasd a saját termináledben: npx tarhely-cli init"
  );
}

export function loginFailedError(detail: string): TarhelyError {
  return new TarhelyError(
    EXIT_CODES.loginFailed,
    `A belépés nem sikerült: ${detail}`,
    "Ellenőrizd a felhasználónevet, a jelszót és a TOTP-seedet (npx tarhely-cli init újra rögzíti)."
  );
}

export function portalChangedError(detail: string): TarhelyError {
  return new TarhelyError(
    EXIT_CODES.portalChanged,
    `A portál másképp viselkedik, mint amire az eszköz készült: ${detail}`,
    "Futtasd újra --debug-dir <mappa> kapcsolóval, és nyiss issue-t a képernyőképpel."
  );
}

export function exitCodeOf(error: unknown): ExitCode {
  return error instanceof TarhelyError ? error.code : EXIT_CODES.unknown;
}
