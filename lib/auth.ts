import { supabase } from "./supabase";

// Ensures every browser/device has a stable anonymous Supabase auth session,
// silently and with no login screen or user-facing UI. This session's user
// id is the stable per-device user_id the votes table's unique constraint
// (menu_item_id, user_id) relies on (see upvotes-1). Supabase persists the
// session in localStorage by default, so a returning visit reuses the same
// id rather than minting a new one each load.
export async function ensureAnonymousSession(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return;

  const { error } = await supabase.auth.signInAnonymously();
  if (error) console.error(error);
}
