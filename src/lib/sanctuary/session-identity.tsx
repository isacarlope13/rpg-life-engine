"use client";

import { createContext, useContext, type ReactNode } from "react";
import { isOfflineOwner } from "../offline-owner.ts";

const SessionIdentity = createContext<string | undefined>(undefined);

/** Supply only the ID returned by authenticated application state. No identity fallback. */
export function SessionIdentityProvider({ userId, children }: { userId?: string; children: ReactNode }) {
  const owner = isOfflineOwner(userId) ? userId : undefined;
  return <SessionIdentity.Provider key={owner ? `user:${owner}` : "no-identity"} value={owner}>{children}</SessionIdentity.Provider>;
}

export function useSessionIdentity(): string | undefined {
  return useContext(SessionIdentity);
}
