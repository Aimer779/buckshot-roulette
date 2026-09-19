export const JEV_POLICY_VERSION = 'jev-policy-v3';

/** Pin so last week's thresholds stay valid. Override with JEV_MODEL. */
export const JEV_PINNED_TYPESAFE_MODEL = 'jev-1.13.0';
export const JEV_PINNED_OPENROUTER_MODEL = 'typesafe/jev-1.13';

/**
 * Compose thresholds. These are the tunable parameters — not Jev's weights.
 * `shoot` is the default shootT; the settings slider (jevConfidenceMin) overrides it.
 */
export const JEV_THRESHOLDS = {
  heal: 0.55,
  info: 0.5,
  saw: 0.55,
  cuff: 0.6,
  invert: 0.7,
  chamberLiveForSaw: 0.55,
  opponentCanKill: 0.65,
  /** Default shootT: chamber_likely_live must be ≥ this to shoot the player. */
  shoot: 0.55,
} as const;

export const JEV_CONFIDENCE_THRESHOLD = JEV_THRESHOLDS.shoot;

export function clampJevConfidenceMin(value: number): number {
  if (!Number.isFinite(value)) return JEV_CONFIDENCE_THRESHOLD;
  return Math.min(1, Math.max(0, value));
}

export function modelLooksPinned(returnedModel: string, pin: string): boolean {
  const got = returnedModel.toLowerCase();
  const expected = pin.toLowerCase();
  if (!got) return true;
  if (got === expected) return true;
  return got.includes('jev-1.13') && expected.includes('jev-1.13');
}
