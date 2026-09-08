import React,{createContext,useContext,useEffect,useMemo,useState} from "react";
import {supabase} from "./supabase";
import {api} from "./api";

const AuthContext=createContext(null);

export function AuthProvider({children}){
 const [session,setSession]=useState(null);
 const [profile,setProfile]=useState(null);
 const [loading,setLoading]=useState(true);
 const load=async(s)=>{
  setSession(s||null);
  if(!s){setProfile(null);setLoading(false);return;}
  try{
   const r=await api.authMe(s.access_token);
   setProfile(r.profile||null);
  }catch(e){
   // If the stored access token expired while the app was closed, refresh
   // the Supabase session and retry without changing the login workflow.
   try {
    const {data: refreshed}=await supabase.auth.refreshSession();
    const fresh=refreshed.session;
    if(fresh?.access_token){
      setSession(fresh);
      const r=await api.authMe(fresh.access_token);
      setProfile(r.profile||null);
      return;
    }
   } catch(refreshError){
    console.error(refreshError);
   }
   console.error(e);
   setProfile(null);
  }finally{setLoading(false);}
 };
 useEffect(()=>{
  if(!supabase){setLoading(false);return;}
  supabase.auth.getSession().then(({data})=>load(data.session));
  const {data:{subscription}}=supabase.auth.onAuthStateChange(async(event,s)=>{
   await load(s);
  });
  const heartbeat=setInterval(()=>{if(supabase)api.authMe().then(r=>setProfile(r.profile||null)).catch(()=>{});},120000);
  return ()=>{subscription.unsubscribe();clearInterval(heartbeat)};
 },[]);
 const value=useMemo(()=>({session,profile,loading,isAdmin:profile?.role==="admin",signIn:async(email,password)=>{if(!supabase)throw new Error("Supabase Auth is not configured in the frontend. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to frontend/.env.");const {data,error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;await load(data.session);await api.authLogin().catch(()=>{});return data;},signOut:async()=>{try{await api.authLogout()}catch{} if(supabase)await supabase.auth.signOut();setSession(null);setProfile(null);}}),[session,profile,loading]);
 return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(){return useContext(AuthContext);}
export function RequireAuth({children}){const a=useAuth();if(a.loading)return <div className="auth-loading">Loading secure session…</div>;if(!a.session)return <Login/>;if(!a.profile)return <div className="auth-loading">Preparing account…</div>;if(a.profile.is_active===false)return <div className="auth-loading"><div className="login-card"><h1>Account disabled</h1><p>Your account has been disabled by an administrator.</p><button className="primary-btn" onClick={a.signOut}>Sign out</button></div></div>;return children;}
export function RequireAdmin({children}){const a=useAuth();if(a.loading)return <div className="auth-loading">Loading secure session…</div>;if(!a.session)return <Login/>;if(!a.isAdmin)return <div className="auth-loading"><div className="login-card"><h1>Admin access required</h1><p>This area is restricted to project administrators.</p><button className="secondary-btn" onClick={()=>window.history.back()}>Go back</button></div></div>;return children;}
export function Login(){
 const a=useAuth(); const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
 const submit=async e=>{e.preventDefault();setBusy(true);setError("");try{await a.signIn(email.trim(),password);}catch(err){setError(err.message||"Login failed");}finally{setBusy(false);}};
 return <div className="login-screen"><div className="login-card"><div className="brand-mark">P</div><div className="eyebrow">POLYGON PROJECT · MADIKERI</div><h1>Secure Login</h1><p>Sign in to access the field operations application.</p><form onSubmit={submit}><label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email"/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" required autoComplete="current-password"/></label><button className="primary-btn" disabled={busy}>{busy?"Signing in…":"Sign in"}</button></form>{error&&<div className="login-error">{error}</div>}<small>Access is controlled by the project administrator.</small></div></div>;
}
