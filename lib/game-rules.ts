// GamePlan.md §2: submission — and therefore the whole daily loop — is locked
// until a game has this many active members.
export const MIN_MEMBERS = 3;

// Stable identities for the seat meter, so the fixed-length row doesn't need
// array indices as React keys.
export const SEATS = ["first", "second", "third"] as const;
