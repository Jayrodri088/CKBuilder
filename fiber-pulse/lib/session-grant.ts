const KEY = "fiber-pulse.session-grant.v1";

export type SessionGrant = {
  maxTotalCkb: number;
  spentCkb: number;
  createdAt: number;
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function loadSessionGrant(): SessionGrant | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SessionGrant) : null;
  } catch {
    return null;
  }
}

export function saveSessionGrant(grant: SessionGrant): void {
  if (!canUseStorage()) return;
  localStorage.setItem(KEY, JSON.stringify(grant));
}

export function setSessionCap(maxTotalCkb: number): SessionGrant {
  const grant: SessionGrant = {
    maxTotalCkb,
    spentCkb: loadSessionGrant()?.spentCkb ?? 0,
    createdAt: Date.now(),
  };
  // If raising/lowering cap, keep spent but clamp
  if (grant.spentCkb > grant.maxTotalCkb) {
    grant.spentCkb = grant.maxTotalCkb;
  }
  saveSessionGrant(grant);
  return grant;
}

export function resetSessionGrant(maxTotalCkb: number): SessionGrant {
  const grant: SessionGrant = {
    maxTotalCkb,
    spentCkb: 0,
    createdAt: Date.now(),
  };
  saveSessionGrant(grant);
  return grant;
}

export function remainingSessionCkb(grant: SessionGrant | null): number | null {
  if (!grant) return null;
  return Math.max(0, +(grant.maxTotalCkb - grant.spentCkb).toFixed(6));
}

/** Returns error message if spend would exceed session cap. */
export function assertSessionAllows(amountCkb: number): string | null {
  const grant = loadSessionGrant();
  if (!grant) return null;
  const left = remainingSessionCkb(grant);
  if (left != null && amountCkb > left) {
    return `Session spend cap: need ${amountCkb} CKB but only ${left} CKB left of ${grant.maxTotalCkb} CKB.`;
  }
  return null;
}

export function recordSessionSpend(amountCkb: number): SessionGrant | null {
  const grant = loadSessionGrant();
  if (!grant) return null;
  grant.spentCkb = +(grant.spentCkb + amountCkb).toFixed(6);
  saveSessionGrant(grant);
  return grant;
}
