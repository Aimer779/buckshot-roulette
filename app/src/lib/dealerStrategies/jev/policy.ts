export const JEV_POLICY_VERSION = 'jev-policy-v3';

/** Pin so last week's thresholds stay valid. Override with JEV_MODEL. */
export const JEV_PINNED_TYPESAFE_MODEL = 'jev-1.13.0';
export const JEV_PINNED_OPENROUTER_MODEL = 'typesafe/jev-1.13';

/**
 * Compose thresholds. These are the tunable parameters — not Jev's weights.
 * `shootT` comes from the settings slider (jevConfidenceMin).
 */
export const JEV_THRESHOLDS = {
  heal: 0.55,
  info: 0.5,
  saw: 0.55,
  cuff: 0.6,
  invert: 0.7,
  chamberLiveForSaw: 0.55,
  opponentCanKill: 0.65,
} as const;
