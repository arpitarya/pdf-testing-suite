// Feature flags, sourced from flag.env at the repo root (see vite.config.ts).
//
// Read them through `flags` rather than importing the raw map, so a missing or
// misspelled key falls back to a stated default instead of silently being off.

import raw from 'virtual:feature-flags';

export interface FeatureFlags {
  /** Click a page in Content / Layout side-by-side to pin a comment. */
  annotations: boolean;
  /** "ZIP bundle" entry in the Export menu: every report plus annotated PDFs. */
  exportZip: boolean;
}

const DEFAULTS: FeatureFlags = {
  annotations: true,
  exportZip: true,
};

const KEYS: Record<keyof FeatureFlags, string> = {
  annotations: 'FEATURE_ANNOTATIONS',
  exportZip: 'FEATURE_EXPORT_ZIP',
};

const TRUTHY = new Set(['true', '1', 'on', 'yes', 'enabled']);
const FALSY = new Set(['false', '0', 'off', 'no', 'disabled']);

function read(key: keyof FeatureFlags): boolean {
  const value = raw[KEYS[key]];
  if (value == null || value === '') return DEFAULTS[key];
  const v = value.trim().toLowerCase();
  if (TRUTHY.has(v)) return true;
  if (FALSY.has(v)) return false;
  // An unrecognised value is a typo, not an intent to disable — warn and keep
  // the default rather than quietly dropping a feature.
  console.warn(`[flags] ${KEYS[key]}="${value}" is not a boolean; using default ${DEFAULTS[key]}`);
  return DEFAULTS[key];
}

export const flags: FeatureFlags = {
  annotations: read('annotations'),
  exportZip: read('exportZip'),
};

export const rawFlags = raw;
