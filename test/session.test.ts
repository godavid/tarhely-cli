import { describe, expect, it } from "vitest";
import { selectMailboxes } from "../src/session.js";
import type { MailboxRef } from "../src/tarhely/api.js";

const sampleMailboxes: readonly MailboxRef[] = [
  {
    index: 0,
    name: "Személyes tárhely",
    slug: "szemelyes-tarhely",
    addressId: "addr-0"
  },
  {
    index: 1,
    name: "12345678 (Példa Kft.)",
    slug: "12345678-pelda-kft",
    addressId: "addr-1"
  },
  {
    index: 2,
    name: "87654321 (Másik Kft.)",
    slug: "87654321-masik-kft",
    addressId: "addr-2"
  }
];

describe("selectMailboxes", () => {
  it("returns all mailboxes when selector is all", () => {
    expect(selectMailboxes(sampleMailboxes, "all")).toEqual([...sampleMailboxes]);
  });

  it("selects the first mailbox with 1-based index 1", () => {
    expect(selectMailboxes(sampleMailboxes, "1")).toEqual([sampleMailboxes[0]]);
  });

  it("selects the second mailbox with 1-based index 2", () => {
    expect(selectMailboxes(sampleMailboxes, "2")).toEqual([sampleMailboxes[1]]);
  });

  it("returns empty array for 0 index", () => {
    expect(selectMailboxes(sampleMailboxes, "0")).toEqual([]);
  });

  it("returns empty array for out of bounds numeric index", () => {
    expect(selectMailboxes(sampleMailboxes, "99")).toEqual([]);
  });

  it("matches mailbox name case-insensitively", () => {
    expect(selectMailboxes(sampleMailboxes, "példa")).toEqual([sampleMailboxes[1]]);
  });

  it("matches mailbox by slug fragment", () => {
    expect(selectMailboxes(sampleMailboxes, "pelda-kft")).toEqual([sampleMailboxes[1]]);
  });

  it("matches mailbox by fragment containing letters and digits", () => {
    expect(selectMailboxes(sampleMailboxes, "12345678 (példa")).toEqual([sampleMailboxes[1]]);
  });

  it("returns empty array when selector matches nothing", () => {
    expect(selectMailboxes(sampleMailboxes, "nem-letezo")).toEqual([]);
  });
});
