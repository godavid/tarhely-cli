import { describe, expect, it } from "vitest";
import { EXIT_CODES, TarhelyError } from "../src/errors.js";
import {
  apiDetail,
  apiHeaders,
  apiList,
  apiRow,
  downloadLetter,
  isNewLetter,
  type LetterRow,
  type MailboxRef,
  type PageLike,
  type SniffedState,
  sanitizeSuggestedFileName,
  slugify,
  toMailboxRefs
} from "../src/tarhely/api.js";

const testMailbox: MailboxRef = {
  index: 0,
  name: "12345678 (Példa Kft.)",
  slug: "12345678-pelda-kft",
  addressId: "addr-001"
};

const testSniffed: SniffedState = {
  addressId: "addr-001",
  xsrf: "token-xyz",
  mailboxes: [testMailbox]
};

const sampleRow: LetterRow = {
  eid: "000000012026010100000001",
  sender: "NAV",
  senderFull: "Nemzeti Adó- és Vámhivatal",
  recipient: "Példa Kft.",
  type: "Adóigazolás",
  desc: "Tájékoztatás adóügyben",
  receivedAt: "2026-01-01 10:00",
  receivedOn: "2026-01-01",
  size: 2048
};

describe("slugify", () => {
  it("converts Hungarian accented characters and punctuation to lowercase hyphens", () => {
    expect(slugify("12345678 (Példa Kft.)")).toBe("12345678-pelda-kft");
  });

  it("falls back to postafiok for non-alphanumeric input", () => {
    expect(slugify("---")).toBe("postafiok");
  });

  it("truncates long slug to 60 characters", () => {
    expect(slugify("a".repeat(100))).toHaveLength(60);
  });
});

describe("toMailboxRefs", () => {
  it("transforms mailbox array with index, name, slug, and addressId", () => {
    expect(toMailboxRefs([{ mailboxName: "Példa Kft.", azonosito: "addr-001" }])).toEqual([
      {
        index: 0,
        name: "Példa Kft.",
        slug: "pelda-kft",
        addressId: "addr-001"
      }
    ]);
  });

  it("falls back to megnevezes when mailboxName is missing", () => {
    expect(toMailboxRefs([{ megnevezes: "Példa Kft.", azonosito: "addr-002" }])[0]?.name).toBe(
      "Példa Kft."
    );
  });

  it("falls back to default numbered name when name properties are absent", () => {
    expect(toMailboxRefs([{ azonosito: "addr-003" }])[0]?.name).toBe("postafiók 1");
  });

  it("skips entries without azonosito", () => {
    expect(toMailboxRefs([{ mailboxName: "Hiányos Kft." }])).toEqual([]);
  });

  it("returns empty array for non-array input", () => {
    expect(toMailboxRefs(null)).toEqual([]);
  });
});

describe("apiHeaders", () => {
  it("returns address-id and x-xsrf-token when addressId matches", () => {
    expect(apiHeaders(testSniffed, testMailbox)).toEqual({
      "address-id": "addr-001",
      "x-xsrf-token": "token-xyz"
    });
  });

  it("omits x-xsrf-token when sniffed xsrf is null", () => {
    expect(apiHeaders({ addressId: "addr-001", xsrf: null, mailboxes: [] }, testMailbox)).toEqual({
      "address-id": "addr-001"
    });
  });

  it("throws TarhelyError portalChanged when addressId mismatches", () => {
    expect(() =>
      apiHeaders({ addressId: "addr-other", xsrf: null, mailboxes: [] }, testMailbox)
    ).toThrow(
      expect.objectContaining({
        code: EXIT_CODES.portalChanged
      })
    );
  });
});

describe("apiRow", () => {
  it("maps raw API response fields into LetterRow", () => {
    const raw = {
      erkeztetesiSzam: "000000012026010100000001",
      feladoRovidNev: "NAV",
      feladoNev: "Nemzeti Adó- és Vámhivatal",
      cimzettNev: "Példa Kft.",
      dokumentumTipus: "Adóigazolás",
      dokumentumLeiras: "Tájékoztatás adóügyben",
      erkezesiDatum: 1704067200000,
      fajlMeret: 1024
    };
    expect(apiRow(raw)).toEqual({
      eid: "000000012026010100000001",
      sender: "NAV",
      senderFull: "Nemzeti Adó- és Vámhivatal",
      recipient: "Példa Kft.",
      type: "Adóigazolás",
      desc: "Tájékoztatás adóügyben",
      receivedAt: "2024-01-01 00:00",
      receivedOn: "2024-01-01",
      size: 1024
    });
  });

  it("falls back to feladoNev when feladoRovidNev is missing", () => {
    expect(apiRow({ feladoNev: "Példa Kft." }).sender).toBe("Példa Kft.");
  });

  it("handles missing optional fields with safe defaults", () => {
    expect(apiRow({})).toEqual({
      eid: null,
      sender: "",
      senderFull: "",
      recipient: "",
      type: "",
      desc: "",
      receivedAt: "",
      receivedOn: "",
      size: null
    });
  });
});

describe("isNewLetter", () => {
  it("returns false when eid is null", () => {
    expect(isNewLetter({ ...sampleRow, eid: null }, new Set(), null)).toBe(false);
  });

  it("returns false when eid is empty string", () => {
    expect(isNewLetter({ ...sampleRow, eid: "" }, new Set(), null)).toBe(false);
  });

  it("returns false when eid already exists in knownIds", () => {
    expect(isNewLetter(sampleRow, new Set(["000000012026010100000001"]), null)).toBe(false);
  });

  it("returns true when eid is unknown and since is null", () => {
    expect(isNewLetter(sampleRow, new Set(), null)).toBe(true);
  });

  it("returns true when receivedOn matches the since threshold", () => {
    expect(isNewLetter({ ...sampleRow, receivedOn: "2026-01-01" }, new Set(), "2026-01-01")).toBe(
      true
    );
  });

  it("returns true when receivedOn is after the since threshold", () => {
    expect(isNewLetter({ ...sampleRow, receivedOn: "2026-01-02" }, new Set(), "2026-01-01")).toBe(
      true
    );
  });

  it("returns false when receivedOn is before the since threshold", () => {
    expect(isNewLetter({ ...sampleRow, receivedOn: "2025-12-31" }, new Set(), "2026-01-01")).toBe(
      false
    );
  });
});

describe("sanitizeSuggestedFileName", () => {
  it("keeps Hungarian letters and replaces spaces and slashes with hyphens", () => {
    expect(sanitizeSuggestedFileName("Példa/Kft adat 2026.pdf")).toBe("Példa-Kft-adat-2026.pdf");
  });

  it("strips leading dots", () => {
    expect(sanitizeSuggestedFileName("...rejtett.pdf")).toBe("rejtett.pdf");
  });

  it("returns download.bin when input resolves to empty string", () => {
    expect(sanitizeSuggestedFileName("")).toBe("download.bin");
  });

  it("limits sanitized file name to 80 characters", () => {
    expect(sanitizeSuggestedFileName("a".repeat(100))).toHaveLength(80);
  });
});

describe("apiList", () => {
  it("fetches messages and maps them to letter rows", async () => {
    const fakePage: PageLike = {
      evaluate: async () => ({
        status: 200,
        body: {
          uzenetek: [
            {
              erkeztetesiSzam: "000000012026010100000001",
              feladoNev: "NAV",
              erkezesiDatum: 1704067200000
            }
          ],
          uzenetekSzama: 1
        }
      })
    };
    const rows = await apiList(fakePage, testSniffed, testMailbox);
    expect(rows[0]?.eid).toBe("000000012026010100000001");
  });
});

describe("apiDetail", () => {
  it("fetches letter details by registration number", async () => {
    const fakePage: PageLike = {
      evaluate: async () => ({
        status: 200,
        body: {
          fajlNev: "level.pdf",
          hivatkozottErkeztetesiSzam: "000000012026010100000002",
          megjegyzes: "Fontos értesítés"
        }
      })
    };
    const detail = await apiDetail(fakePage, testSniffed, testMailbox, "000000012026010100000001");
    expect(detail).toEqual({
      fileName: "level.pdf",
      referencedRegistrationNumber: "000000012026010100000002",
      note: "Fontos értesítés"
    });
  });
});

describe("downloadLetter", () => {
  it("downloads binary content and returns sanitized file name with buffer", async () => {
    const fakePage: PageLike = {
      evaluate: async () => ({
        status: 200,
        contentType: "application/octet-stream",
        body: Buffer.from("tartalom").toString("base64")
      })
    };
    const file = await downloadLetter(
      fakePage,
      testSniffed,
      testMailbox,
      "000000012026010100000001",
      "irat.pdf"
    );
    expect(file.bytes.toString()).toBe("tartalom");
  });

  it("rejects when content-type is html", async () => {
    const fakePage: PageLike = {
      evaluate: async () => ({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: Buffer.from("<html></html>").toString("base64")
      })
    };
    await expect(
      downloadLetter(fakePage, testSniffed, testMailbox, "000000012026010100000001", "irat.pdf")
    ).rejects.toThrow(TarhelyError);
  });

  it("rejects when content-type is json", async () => {
    const fakePage: PageLike = {
      evaluate: async () => ({
        status: 200,
        contentType: "application/json",
        body: Buffer.from("{}").toString("base64")
      })
    };
    await expect(
      downloadLetter(fakePage, testSniffed, testMailbox, "000000012026010100000001", "irat.pdf")
    ).rejects.toThrow(TarhelyError);
  });

  it("rejects when downloaded body is empty", async () => {
    const fakePage: PageLike = {
      evaluate: async () => ({
        status: 200,
        contentType: "application/octet-stream",
        body: ""
      })
    };
    await expect(
      downloadLetter(fakePage, testSniffed, testMailbox, "000000012026010100000001", "irat.pdf")
    ).rejects.toThrow("üres letöltés");
  });

  it("rejects when status is not 200", async () => {
    const fakePage: PageLike = {
      evaluate: async () => ({
        status: 404,
        body: "Nem található"
      })
    };
    await expect(
      downloadLetter(fakePage, testSniffed, testMailbox, "000000012026010100000001", "irat.pdf")
    ).rejects.toThrow("HTTP 404");
  });
});
