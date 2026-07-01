"use client";
import { BRAND } from "../lib/brand";
import { signInWithGoogle } from "../supabase";
import LogoMark from "./LogoMark";

// Sign-in / OTP modal. Presentational — all state/handlers via props.
export default function AuthModal({ open, user, setAuthOpen, otpSent, setOtpSent, otpCode, setOtpCode, authEmail, setAuthEmail, authError, setAuthError, handleAuth, handleVerifyOtp }) {
  if (!open || user) return null;
  return (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.78)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20,
        }} onClick={() => { setAuthOpen(false); setOtpSent(false); setOtpCode(''); setAuthError(null); setAuthEmail(""); }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: "100%", maxWidth: 360,
            background: BRAND.cream, borderRadius: 12,
            padding: "28px 24px",
            color: BRAND.charcoal,
            boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
            position: "relative",
          }}>
            <button onClick={() => { setAuthOpen(false); setOtpSent(false); setOtpCode(''); setAuthError(null); setAuthEmail(""); }} style={{
              position: "absolute", top: 12, right: 12,
              background: "transparent", border: "none", cursor: "pointer",
              fontSize: 18, color: BRAND.muted, lineHeight: 1, padding: 4,
            }}>✕</button>

            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <LogoMark size={80} />
            </div>

            {!otpSent ? (
              <>
                <div className="oswald" style={{ fontSize: 20, fontWeight: 700, letterSpacing: 0.5, marginBottom: 4, color: BRAND.charcoal }}>
                  SIGN IN
                </div>
                <div style={{ fontSize: 12, color: "#5A6770", marginBottom: 18, fontWeight: 500 }}>
                  Sign in to save your teams and preferences.
                </div>
                <button
                  onClick={async () => { try { await signInWithGoogle(); } catch(e) { setAuthError(e.message); } }}
                  style={{
                    width: "100%", padding: "12px", borderRadius: 8, border: `1.5px solid rgba(45,58,66,0.2)`,
                    background: BRAND.white, color: BRAND.charcoal, cursor: "pointer",
                    fontSize: 13, fontWeight: 600, letterSpacing: 0.3,
                    fontFamily: "'Inter', sans-serif",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    marginBottom: 16,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-3.59-13.46-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg>
                  Continue with Google
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div style={{ flex: 1, height: 1, background: "rgba(45,58,66,0.12)" }} />
                  <span style={{ fontSize: 11, color: "#9AA5AD", fontWeight: 600, letterSpacing: 1 }}>OR</span>
                  <div style={{ flex: 1, height: 1, background: "rgba(45,58,66,0.12)" }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 10, color: "#7A8890", marginBottom: 5, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700 }}>Email</label>
                  <input
                    type="email"
                    value={authEmail}
                    onChange={e => setAuthEmail(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAuth()}
                    placeholder="you@example.com"
                    style={{
                      width: "100%", padding: "11px 13px", borderRadius: 8,
                      background: BRAND.white, border: `1.5px solid rgba(45,58,66,0.15)`,
                      color: BRAND.charcoal, fontSize: 14, outline: "none", fontWeight: 500,
                      fontFamily: "'Inter', sans-serif",
                    }}
                  />
                </div>
                {authError && (
                  <div style={{
                    background: "rgba(232,69,69,0.08)", border: `1.5px solid ${BRAND.red}`,
                    color: BRAND.red, borderRadius: 7, padding: "8px 12px", fontSize: 12, marginBottom: 12, fontWeight: 600,
                  }}>{authError}</div>
                )}
                <button onClick={handleAuth} style={{
                  width: "100%", padding: "13px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: BRAND.green, color: BRAND.charcoal,
                  fontSize: 13, fontWeight: 700, letterSpacing: 1.5,
                  fontFamily: "'Oswald', sans-serif",
                  boxShadow: `0 4px 0 ${BRAND.greenDark}`,
                }}>SEND CODE →</button>
              </>
            ) : (
              <div>
                <div className="oswald" style={{ fontSize: 20, fontWeight: 700, color: BRAND.charcoal, marginBottom: 4 }}>
                  ENTER YOUR CODE
                </div>
                <div style={{ fontSize: 12, color: "#5A6770", marginBottom: 16, fontWeight: 500 }}>
                  We sent a sign-in code to <strong>{authEmail}</strong>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  value={otpCode}
                  onChange={e => { setOtpCode(e.target.value.replace(/\D/g, '')); setAuthError(null); }}
                  onKeyDown={e => e.key === "Enter" && handleVerifyOtp()}
                  placeholder="00000000"
                  autoFocus
                  style={{
                    width: "100%", padding: "14px 13px", borderRadius: 8, marginBottom: 12,
                    background: BRAND.white, border: `1.5px solid rgba(45,58,66,0.15)`,
                    color: BRAND.charcoal, fontSize: 28, outline: "none", fontWeight: 700,
                    fontFamily: "'Oswald', sans-serif", letterSpacing: 10, textAlign: "center",
                  }}
                />
                {authError && (
                  <div style={{
                    background: "rgba(232,69,69,0.08)", border: `1.5px solid ${BRAND.red}`,
                    color: BRAND.red, borderRadius: 7, padding: "8px 12px", fontSize: 12, marginBottom: 12, fontWeight: 600,
                  }}>{authError}</div>
                )}
                <button onClick={handleVerifyOtp} style={{
                  width: "100%", padding: "13px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: BRAND.green, color: BRAND.charcoal,
                  fontSize: 13, fontWeight: 700, letterSpacing: 1.5,
                  fontFamily: "'Oswald', sans-serif",
                  boxShadow: `0 4px 0 ${BRAND.greenDark}`,
                  marginBottom: 10,
                }}>VERIFY CODE →</button>
                <button onClick={() => { setOtpSent(false); setOtpCode(''); setAuthError(null); }} style={{
                  width: "100%", background: "transparent", border: `1.5px solid #9BA8B0`, borderRadius: 7,
                  padding: "8px 16px", fontSize: 11, fontWeight: 700, color: "#5A6770",
                  cursor: "pointer", fontFamily: "'Oswald', sans-serif", letterSpacing: 1,
                }}>← USE DIFFERENT EMAIL</button>
              </div>
            )}

            <div style={{ marginTop: 18, display: "flex", justifyContent: "center", gap: 1.5, opacity: 0.2 }}>
              {[3,1,2,4,1,3,2,1,4,2,3,1,2,1,3,4,1,2,3,1,4,2,1,3].map((w, i) => (
                <div key={i} style={{ width: w, height: 20, background: BRAND.charcoal }} />
              ))}
            </div>
            <div style={{ fontSize: 10, color: "#9BA8B0", textAlign: "center", marginTop: 10, letterSpacing: 1, fontWeight: 600 }}>
              ADMIT ONE · NO PASSWORD REQUIRED
            </div>
          </div>
        </div>
  );
}
