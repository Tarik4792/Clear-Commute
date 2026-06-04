"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle"|"loading"|"success"|"error">("idle");
  const [message, setMessage] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Supabase puts the token in the URL hash
    const hash = window.location.hash;
    if (!hash.includes("access_token")) {
      setStatus("error");
      setMessage("Invalid or expired reset link. Please request a new one.");
    }
  }, []);

  async function handleReset() {
    if (password !== confirm) {
      setMessage("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      setMessage("Password must be at least 6 characters");
      return;
    }
    setStatus("loading");
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setStatus("success");
      setMessage("Password updated! Redirecting...");
      setTimeout(() => router.push("/"), 2000);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Failed to update password");
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", padding: "1rem",
      fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
      background: "var(--bg, #0f0f14)", color: "var(--text, #f0eff8)"
    }}>
      <div style={{
        background: "var(--surface, #1a1a22)", borderRadius: 18,
        padding: "2rem", width: "100%", maxWidth: 400,
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.3)"
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🚇</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, letterSpacing: -0.5 }}>
          Reset your password
        </h1>
        <p style={{ fontSize: 14, color: "#9090a8", marginBottom: 24 }}>
          ClearCommute — Enter your new password below
        </p>

        {message && (
          <div style={{
            padding: "10px 12px", borderRadius: 10, marginBottom: 16,
            fontSize: 13, fontWeight: 500,
            background: status === "success" ? "#0a2e18" : "#2a0a10",
            color: status === "success" ? "#4ddb80" : "#f07080",
          }}>
            {message}
          </div>
        )}

        {status !== "success" && status !== "error" && (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#9090a8", textTransform: "uppercase", letterSpacing: 0.4, display: "block", marginBottom: 5 }}>
                New Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: "100%", padding: "10px 12px", fontSize: 15,
                  borderRadius: 10, border: "1.5px solid rgba(255,255,255,0.1)",
                  background: "#22222c", color: "#f0eff8", outline: "none",
                  boxSizing: "border-box"
                }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#9090a8", textTransform: "uppercase", letterSpacing: 0.4, display: "block", marginBottom: 5 }}>
                Confirm Password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: "100%", padding: "10px 12px", fontSize: 15,
                  borderRadius: 10, border: "1.5px solid rgba(255,255,255,0.1)",
                  background: "#22222c", color: "#f0eff8", outline: "none",
                  boxSizing: "border-box"
                }}
              />
            </div>
            <button
              onClick={handleReset}
              disabled={status === "loading"}
              style={{
                width: "100%", padding: 13, fontSize: 15, fontWeight: 600,
                borderRadius: 10, border: "none", cursor: "pointer",
                background: status === "loading" ? "#444" : "#f0eff8",
                color: "#0f0f14", transition: "opacity 0.15s"
              }}
            >
              {status === "loading" ? "Updating..." : "Update password"}
            </button>
          </>
        )}

        {status === "error" && message.includes("Invalid") && (
          <button
            onClick={() => router.push("/")}
            style={{
              width: "100%", padding: 13, fontSize: 15, fontWeight: 600,
              borderRadius: 10, border: "none", cursor: "pointer",
              background: "#f0eff8", color: "#0f0f14", marginTop: 8
            }}
          >
            Back to ClearCommute
          </button>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
