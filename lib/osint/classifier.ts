import type { EntityType } from "./types";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const DOMAIN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
const PHONE_ID = /^(?:\+62|62|0)8[1-9][0-9]{7,11}$/;
const URL_RX = /^https?:\/\//i;

export function normalizePhone(value: string) {
  const raw = value.replace(/[\s().-]/g, "");
  if (raw.startsWith("+62")) return `0${raw.slice(3)}`;
  if (raw.startsWith("62")) return `0${raw.slice(2)}`;
  return raw;
}

export function classify(input: string): { type: EntityType; normalized: string; value: string } {
  const value = input.trim().replace(/^['"]|['"]$/g, "");
  const compact = value.replace(/[\s().-]/g, "");
  if (EMAIL.test(value)) return { type: "email", normalized: value.toLowerCase(), value };
  if (PHONE_ID.test(compact)) return { type: "phone", normalized: normalizePhone(compact), value };
  if (URL_RX.test(value)) return { type: "url", normalized: value.toLowerCase(), value };
  if (DOMAIN.test(value)) return { type: "domain", normalized: value.toLowerCase(), value };
  if (/\s/.test(value)) return { type: "name", normalized: value.toLowerCase().replace(/\s+/g, " "), value };
  return { type: "username", normalized: value.replace(/^@/, "").toLowerCase(), value: value.replace(/^@/, "") };
}

export function entityKey(type: EntityType, normalized: string) {
  return `${type}:${normalized}`;
}
