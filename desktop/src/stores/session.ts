/**
 * Who is using the app, as the account server reports it. The role is never
 * decided on the client: it starts as `user` and only the server's answer raises it.
 */
import { create } from 'zustand';

export type Role = 'user' | 'admin';
export type PlanId = 'free' | 'pro' | 'team';

interface SessionState {
  signedIn: boolean;
  userId: string | null;
  email: string | null;
  displayName: string | null;
  role: Role;
  plan: PlanId;
  setSession: (patch: Partial<Omit<SessionState, 'setSession'>>) => void;
}

/** Current account session (anonymous until Google sign-in). */
export const useSession = create<SessionState>((set) => ({
  signedIn: false,
  userId: null,
  email: null,
  displayName: null,
  role: 'user',
  plan: 'free',
  setSession: (patch) => set(patch),
}));
