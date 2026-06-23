"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function SettingsPage() {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        setError("You must be signed in to delete your account.");
        setDeleting(false);
        return;
      }

      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to delete account");
      }

      await supabase.auth.signOut();
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setDeleting(false);
    }
  };

  return (
    <main style={styles.main}>
      <div style={styles.container}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: '1rem', cursor: 'pointer', padding: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          ← Back
        </button>
        <h1 style={styles.heading}>Settings</h1>

        <button
          style={{ ...styles.deleteButton, color: "#94a3b8", borderColor: "#374151", marginBottom: "1.5rem" }}
          onClick={async () => {
            await supabase.auth.signOut();
            router.push("/");
          }}
        >
          Sign Out
        </button>

        <section style={styles.section}>
          <h2 style={styles.sectionHeading}>Account</h2>
          <p style={styles.description}>
            Permanently delete your ClearCommute account and all associated data.
            This action cannot be undone.
          </p>

          {!showConfirm ? (
            <button style={styles.deleteButton} onClick={() => setShowConfirm(true)}>
              Delete Account
            </button>
          ) : (
            <div style={styles.confirmBox}>
              <p style={styles.confirmText}>
                This will permanently delete your account and all your data.
                Type <strong>DELETE</strong> below to confirm.
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                style={styles.input}
                disabled={deleting}
              />
              {error && <p style={styles.error}>{error}</p>}
              <div style={styles.buttonRow}>
                <button
                  style={styles.cancelButton}
                  onClick={() => {
                    setShowConfirm(false);
                    setConfirmText("");
                    setError(null);
                  }}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  style={{
                    ...styles.confirmDeleteButton,
                    opacity: confirmText === "DELETE" && !deleting ? 1 : 0.5,
                    cursor: confirmText === "DELETE" && !deleting ? "pointer" : "not-allowed",
                  }}
                  onClick={handleDeleteAccount}
                  disabled={confirmText !== "DELETE" || deleting}
                >
                  {deleting ? "Deleting..." : "Permanently Delete"}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    backgroundColor: "#0a0e1a",
    color: "#e2e8f0",
    padding: "2rem 1.5rem",
  },
  container: {
    maxWidth: 480,
    margin: "0 auto",
  },
  heading: {
    fontSize: "1.75rem",
    fontWeight: 600,
    marginBottom: "2rem",
  },
  section: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: 12,
    padding: "1.5rem",
  },
  sectionHeading: {
    fontSize: "1.1rem",
    fontWeight: 600,
    marginBottom: "0.75rem",
    color: "#f87171",
  },
  description: {
    fontSize: "0.9rem",
    color: "#94a3b8",
    marginBottom: "1.25rem",
    lineHeight: 1.5,
  },
  deleteButton: {
    backgroundColor: "transparent",
    color: "#f87171",
    border: "1px solid #f87171",
    borderRadius: 8,
    padding: "0.6rem 1.2rem",
    fontSize: "0.9rem",
    fontWeight: 500,
    cursor: "pointer",
  },
  confirmBox: {
    backgroundColor: "#1a1410",
    border: "1px solid #7f1d1d",
    borderRadius: 8,
    padding: "1rem",
  },
  confirmText: {
    fontSize: "0.85rem",
    color: "#fca5a5",
    marginBottom: "0.75rem",
    lineHeight: 1.5,
  },
  input: {
    width: "100%",
    padding: "0.5rem 0.75rem",
    borderRadius: 6,
    border: "1px solid #374151",
    backgroundColor: "#0a0e1a",
    color: "#e2e8f0",
    fontSize: "0.9rem",
    marginBottom: "0.75rem",
    boxSizing: "border-box",
  },
  buttonRow: {
    display: "flex",
    gap: "0.75rem",
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "transparent",
    color: "#94a3b8",
    border: "1px solid #374151",
    borderRadius: 8,
    padding: "0.6rem 1rem",
    fontSize: "0.875rem",
    cursor: "pointer",
  },
  confirmDeleteButton: {
    flex: 1,
    backgroundColor: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "0.6rem 1rem",
    fontSize: "0.875rem",
    fontWeight: 600,
  },
  error: {
    fontSize: "0.8rem",
    color: "#f87171",
    marginBottom: "0.75rem",
  },
};
