import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";
import { api } from "./api";

const AuthContext = createContext(null);
const PROFILE_STORAGE_KEY = "polygon-madikeri-profile";

function readStoredProfile(userId) {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (saved?.userId && String(saved.userId) === String(userId)) return saved.profile || null;
  } catch {}
  return null;
}

function storeProfile(userId, nextProfile) {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ userId, profile: nextProfile, at: Date.now() }));
  } catch {}
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const loadedUserId = useRef("");
  const profileCache = useRef(new Map());

  const load = async (s, force = false) => {
    setSession(s || null);

    if (!s) {
      loadedUserId.current = "";
      setProfile(null);
      setLoading(false);
      return;
    }

    const userId = s.user?.id || "";
    if (!force && userId && loadedUserId.current === userId && profile) {
      setLoading(false);
      return;
    }

    const cached = profileCache.current.get(userId);
    if (!force && cached && Date.now() - cached.at < 5 * 60 * 1000) {
      loadedUserId.current = userId;
      setProfile(cached.profile);
      setLoading(false);
      return;
    }

    try {
      const r = await api.authMe(s.access_token);
      const nextProfile = r.profile || null;
      profileCache.current.set(userId, { profile: nextProfile, at: Date.now() });
      storeProfile(userId, nextProfile);
      loadedUserId.current = userId;
      setProfile(nextProfile);
    } catch (e) {
      // Recover transparently if the stored access token expired.
      try {
        const { data: refreshed } = await supabase.auth.refreshSession();
        const fresh = refreshed.session;
        if (fresh?.access_token) {
          setSession(fresh);
          const r = await api.authMe(fresh.access_token);
          const nextProfile = r.profile || null;
          profileCache.current.set(fresh.user.id, { profile: nextProfile, at: Date.now() });
          storeProfile(fresh.user.id, nextProfile);
          loadedUserId.current = fresh.user.id;
          setProfile(nextProfile);
          return;
        }
      } catch (refreshError) {
        console.error(refreshError);
      }

      if (!navigator.onLine) {
        const stored = readStoredProfile(userId);
        if (stored) {
          loadedUserId.current = userId;
          setProfile(stored);
          return;
        }
      }

      console.error(e);
      loadedUserId.current = "";
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (alive) load(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      if (!alive) return;

      // Token refreshes do not require another profile/API round trip.
      if (event === "TOKEN_REFRESHED" && s) {
        setSession(s);
        return;
      }

      if (event === "SIGNED_OUT") {
        load(null);
        return;
      }

      if (event === "SIGNED_IN" && s) {
        load(s, true);
      }
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      profile,
      loading,
      isAdmin: profile?.role === "admin",

      signIn: async (email, password) => {
        if (!supabase) {
          throw new Error(
            "Supabase Auth is not configured in the frontend. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to frontend/.env."
          );
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // SIGNED_IN loads the profile. Record login without blocking the UI.
        setSession(data.session);
        api.authLogin().catch(() => {});
        return data;
      },

      signOut: async () => {
        try {
          await api.authLogout();
        } catch {}
        if (supabase) await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        loadedUserId.current = "";
        try { localStorage.removeItem(PROFILE_STORAGE_KEY); } catch {}
      },
    }),
    [session, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function RequireAuth({ children }) {
  const a = useAuth();

  if (a.loading) {
    return <div className="auth-loading">Loading secure session…</div>;
  }

  if (!a.session) return <Login />;

  if (!a.profile) {
    return <div className="auth-loading">Preparing account…</div>;
  }

  if (a.profile.is_active === false) {
    return (
      <div className="auth-loading">
        <div className="login-card">
          <h1>Account disabled</h1>
          <p>Your account has been disabled by an administrator.</p>
          <button className="primary-btn" onClick={a.signOut}>Sign out</button>
        </div>
      </div>
    );
  }

  return children;
}

export function RequireAdmin({ children }) {
  const a = useAuth();

  if (a.loading) {
    return <div className="auth-loading">Loading secure session…</div>;
  }

  if (!a.session) return <Login />;

  if (!a.isAdmin) {
    return (
      <div className="auth-loading">
        <div className="login-card">
          <h1>Admin access required</h1>
          <p>This area is restricted to project administrators.</p>
          <button className="secondary-btn" onClick={() => window.history.back()}>
            Go back
          </button>
        </div>
      </div>
    );
  }

  return children;
}

export function Login() {
  const a = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      await a.signIn(email.trim(), password);
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="brand-mark">P</div>
        <div className="eyebrow">POLYGON PROJECT · MADIKERI</div>
        <h1>Secure Login</h1>
        <p>Sign in to access the field operations application.</p>

        <form onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              autoComplete="current-password"
            />
          </label>

          <button className="primary-btn" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {error && <div className="login-error">{error}</div>}
        <small>Access is controlled by the project administrator.</small>
      </div>
    </div>
  );
}
