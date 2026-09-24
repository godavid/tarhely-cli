import { describe, expect, it } from "vitest";
import { ALLOWED_HOSTS, isAllowedHost } from "../src/browser.js";

describe("ALLOWED_HOSTS", () => {
  it("contains official default domains and wildcards", () => {
    expect(ALLOWED_HOSTS).toEqual([
      "kau.gov.hu",
      "*.kau.gov.hu",
      "idp.gov.hu",
      "tarhely.gov.hu",
      "*.tarhely.gov.hu"
    ]);
  });
});

describe("isAllowedHost", () => {
  it("allows kau.gov.hu by default", () => {
    expect(isAllowedHost("kau.gov.hu")).toBe(true);
  });

  it("allows subdomain of kau.gov.hu by wildcard", () => {
    expect(isAllowedHost("belepes.kau.gov.hu")).toBe(true);
  });

  it("allows idp.gov.hu by default", () => {
    expect(isAllowedHost("idp.gov.hu")).toBe(true);
  });

  it("allows tarhely.gov.hu by default", () => {
    expect(isAllowedHost("tarhely.gov.hu")).toBe(true);
  });

  it("allows subdomain of tarhely.gov.hu by wildcard", () => {
    expect(isAllowedHost("x.tarhely.gov.hu")).toBe(true);
  });

  it("allows nested subdomain of tarhely.gov.hu", () => {
    expect(isAllowedHost("sub.api.tarhely.gov.hu")).toBe(true);
  });

  it("rejects untrusted third-party domain", () => {
    expect(isAllowedHost("evil.com")).toBe(false);
  });

  it("rejects domain suffix spoofing", () => {
    expect(isAllowedHost("tarhely.gov.hu.evil.com")).toBe(false);
  });

  it("rejects prefix spoofing on domain name", () => {
    expect(isAllowedHost("not-tarhely.gov.hu")).toBe(false);
  });

  it("supports custom allowlist patterns", () => {
    expect(isAllowedHost("api.pelda.hu", ["*.pelda.hu"])).toBe(true);
  });
});
