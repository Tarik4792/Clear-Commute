"use client";

import { useState, useEffect } from "react";
import styles from "./page.module.css";

const LINES: Record<string, string[]> = {
  subway: ["1","2","3","4","5","6","7","A","C","E","B","D","F","M","G","J","Z","L","N","Q","R","W","S"],
  bus: ["M1","M2","M3","M4","M5","M7","M9","M10","M11","M14","M15","M20","M22","M23","M31","M34","M42","M50","M57","M60","M66","M72","M79","M86","M96","M98","M99","M100","M101","M102","M103","M104","M106","M116","Bx1","Bx2","Bx3","Bx4","Q1","Q2","Q3","Q4","B1","B2","B3","B6","B9","B10"],
  lirr: ["Port Washington","Babylon","Ronkonkoma","Montauk","Oyster Bay","Long Beach","Far Rockaway","Hempstead","West Hempstead","Port Jefferson"],
  mnr: ["Hudson","Harlem","New Haven","Pascack Valley","Port Jervis"],
  sir: ["Main Line"],
  path: ["NY-NJ (33rd St)","NY-NJ (WTC)","Hoboken-33rd","Hoboken-WTC","Newark-WTC"],
};

const TRANSIT_LABELS: Record<string, string> = {
  subway: "NYC Subway", bus: "MTA Bus", lirr: "LIRR",
  mnr: "Metro-North", sir: "Staten Island Railway", path: "PATH Train",
};

const LINE_COLORS: Record<string, string> = {
  "1":"#EE352E","2":"#EE352E","3":"#EE352E",
  "4":"#00933C","5":"#00933C","6":"#00933C",
  "7":"#B933AD",
  "A":"#0039A6","C":"#0039A6","E":"#0039A6",
  "B":"#FF6319","D":"#FF6319","F":"#FF6319","M":"#FF6319",
  "G":"#6CBE45","J":"#996633","Z":"#996633",
  "L":"#A7A9AC",
  "N":"#FCCC0A","Q":"#FCCC0A","R":"#FCCC0A","W":"#FCCC0A",
  "S":"#808183",
};

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

interface SavedProfile {
  id: string; name: string; transit: string; line: string;
  origin: string; dest: string; time: string; day: string; purpose: string;
}
interface ServiceAlert { header: string; description: string; effect: string; }
interface Weather { temperature: number; condition: string; isRaining: boolean; isSnowing: boolean; isStormy: boolean; isClear: boolean; }
interface Arrival { line: string; minutes: number; direction: string; destination: string; }
interface ArrivalsResult { arrivals: Arrival[]; stopFound: boolean; message?: string; }
interface AnalysisResult {
  crowdScore: number; crowdLabel: string; estimatedDuration: string; estimatedWait: string;
  aiSummary: string; timeline: { time: string; crowd: number }[];
  departureSuggestions: { time: string; crowd: number }[];
  tips: { icon: string; tip: string; detail: string }[];
}
interface User { id: string; email?: string; }

function to12Hour(time: string): string {
  const [hourStr, min] = time.split(":");
  const hour = parseInt(hourStr, 10);
  if (isNaN(hour) || !min) return time;
  return `${hour % 12 || 12}:${min} ${hour >= 12 ? "PM" : "AM"}`;
}
function crowdColor(pct: number) { return pct < 40 ? "var(--green)" : pct < 70 ? "var(--amber)" : "var(--red)"; }
function crowdLabel(pct: number) { return pct < 30 ? "Light" : pct < 55 ? "Moderate" : pct < 75 ? "Busy" : "Very Crowded"; }
function getBadgeClass(pct: number, isFirst: boolean, s: Record<string,string>) { return isFirst ? s.badgeBest : pct < 70 ? s.badgeOk : s.badgeBusy; }
function alertIcon(effect: string) { return effect.includes("NO_SERVICE") ? "🚫" : effect.includes("DELAY") ? "⏱️" : "⚠️"; }
function alertColor(effect: string) { return effect.includes("NO_SERVICE") || effect.includes("SUSPENSION") ? "var(--red)" : "var(--amber)"; }

const TIP_ICONS: Record<string, string> = { train: "🚇", clock: "🕐", "map-pin": "📍", star: "⭐", alert: "⚠️" };

export default function Home() {
  const [transit, setTransit] = useState("subway");
  const [line, setLine] = useState("5");
  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState("");
  const [time, setTime] = useState("08:00");
  const [day, setDay] = useState("Monday");
  const [purpose, setPurpose] = useState("commute");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [arrivals, setArrivals] = useState<ArrivalsResult | null>(null);
  const [alerts, setAlerts] = useState<ServiceAlert[]>([]);
  const [error, setError] = useState("");
  const [busArrivals, setBusArrivals] = useState<{
    arrivals: { route: string; destination: string; minutes: number | null; presentable: string }[];
    stopName: string;
  } | null>(null);
  const [busLoading, setBusLoading] = useState(false);
  const [heatmap, setHeatmap] = useState<{
    heatmap: Record<string, number[]>;
    peakDay: string;
    peakHour: string;
    lightestDay: string;
    lightestHour: string;
  } | null>(null);
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  const [saveMsg, setSaveMsg] = useState("");
  const [weather, setWeather] = useState<Weather | null>(null);
  const [notifStatus, setNotifStatus] = useState<"default"|"granted"|"denied">("default");

  // Create supabase client lazily to avoid build-time env var issues
  function getSupabase() {
    const { createClient } = require("@supabase/supabase-js");
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"signin"|"signup">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const now = new Date();
    setTime(`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`);
    setDay(DAYS[now.getDay() === 0 ? 6 : now.getDay() - 1]);
    fetch("/api/weather").then(r => r.json()).then(d => { if (d.temperature) setWeather(d); });
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifStatus(Notification.permission as "default"|"granted"|"denied");
    }
    // Check for existing session
    getSupabase().auth.getSession().then(({ data: { session } }: { data: { session: { user: { id: string; email?: string } } | null } }) => {
      if (session?.user) {
        setUser(session.user as User);
        loadCloudProfiles(session.user.id);
      } else {
        const saved = localStorage.getItem("clearcommute_profiles");
        if (saved) setProfiles(JSON.parse(saved));
      }
    });
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(console.error);
    }
  }, []);

  async function loadCloudProfiles(userId: string) {
    const res = await fetch("/api/commutes", { headers: { "x-user-id": userId } });
    const data = await res.json();
    if (data.commutes) {
      const mapped = data.commutes.map((c: Record<string, string>) => ({
        id: c.id, name: c.name, transit: c.transit, line: c.line,
        origin: c.origin, dest: c.destination, time: c.depart_time,
        day: c.day, purpose: c.purpose,
      }));
      setProfiles(mapped);
    }
  }

  async function handleAuth() {
    setAuthLoading(true);
    setAuthError("");
    try {
      if (authMode === "signup") {
        const { data, error } = await getSupabase().auth.signUp({ email: authEmail, password: authPassword });
        if (error) throw error;
        if (data.user) {
          setUser(data.user as User);
          setShowAuth(false);
          // Migrate localStorage profiles to cloud
          const saved = localStorage.getItem("clearcommute_profiles");
          if (saved) {
            const local = JSON.parse(saved);
            for (const p of local) {
              await fetch("/api/commutes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: data.user.id, commute: p }),
              });
            }
            localStorage.removeItem("clearcommute_profiles");
          }
          await loadCloudProfiles(data.user.id);
        }
      } else {
        const { data, error } = await getSupabase().auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) throw error;
        if (data.user) {
          setUser(data.user as User);
          setShowAuth(false);
          await loadCloudProfiles(data.user.id);
        }
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSignOut() {
    await getSupabase().auth.signOut();
    setUser(null);
    setProfiles([]);
  }

  function handleTransitChange(val: string) { setTransit(val); setLine(LINES[val][0]); }

  async function subscribeToNotifications() {
    try {
      const permission = await Notification.requestPermission();
      setNotifStatus(permission as "default"|"granted"|"denied");
      if (permission !== "granted") return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub, userId: user?.id || null }),
      });
    } catch (err) { console.error("Subscribe error:", err); }
  }

  async function saveProfile() {
    const name = `${line} · ${origin || "?"} → ${dest || "?"} · ${to12Hour(time)}`;
    const profile: SavedProfile = { id: Date.now().toString(), name, transit, line, origin, dest, time, day, purpose };

    if (user) {
      // Save to Supabase
      const res = await fetch("/api/commutes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, commute: profile }),
      });
      const data = await res.json();
      if (data.commute) {
        await loadCloudProfiles(user.id);
      }
    } else {
      // Save to localStorage
      const updated = [profile, ...profiles].slice(0, 5);
      setProfiles(updated);
      localStorage.setItem("clearcommute_profiles", JSON.stringify(updated));
    }
    setSaveMsg("Saved!"); setTimeout(() => setSaveMsg(""), 2000);
  }

  function loadProfile(p: SavedProfile) {
    setTransit(p.transit); setLine(p.line); setOrigin(p.origin); setDest(p.dest);
    setTime(p.time); setDay(p.day); setPurpose(p.purpose);
    setResult(null); setArrivals(null); setAlerts([]);
    setTimeout(() => runAnalysis(p.transit, p.line, p.origin, p.dest, p.time, p.day, p.purpose), 100);
  }

  async function deleteProfile(id: string) {
    if (user) {
      await fetch("/api/commutes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, commuteId: id }),
      });
      await loadCloudProfiles(user.id);
    } else {
      const updated = profiles.filter(p => p.id !== id);
      setProfiles(updated);
      localStorage.setItem("clearcommute_profiles", JSON.stringify(updated));
    }
  }

  async function runAnalysis(t: string, l: string, o: string, d: string, tm: string, dy: string, pu: string) {
    setLoading(true); setError(""); setResult(null); setArrivals(null); setAlerts([]); setHeatmap(null); setBusArrivals(null);
    try {
      fetch("/api/heatmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transit: t, line: l, origin: o, dest: d }),
      }).then(r => r.json()).then(d => { if (d.heatmap) setHeatmap(d); }).catch(console.error);

      const requests: Promise<unknown>[] = [
        fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transit: t, line: l, origin: o, dest: d, time: tm, day: dy, purpose: pu, weather }) }).then(r => r.json()),
      ];
      if (t === "subway") {
        requests.push(fetch("/api/arrivals", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ line: l, station: o }) }).then(r => r.json()));
        requests.push(fetch("/api/alerts", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ line: l }) }).then(r => r.json()));
      }
      const results = await Promise.allSettled(requests);
      if (results[0].status === "fulfilled") {
        const data = results[0].value as AnalysisResult & { error?: string };
        if (data.error) throw new Error(data.error);
        setResult(data);
      } else throw new Error("Analysis failed");
      if (results[1]?.status === "fulfilled") setArrivals(results[1].value as ArrivalsResult);
      if (results[2]?.status === "fulfilled") {
        const alertData = results[2].value as { alerts: ServiceAlert[] };
        setAlerts(alertData.alerts || []);
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong"); }
    finally { setLoading(false); }
  }

  async function fetchBusLocation() {
    if (!navigator.geolocation) return;
    setBusLoading(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const res = await fetch("/api/bus", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ route: line, lat: pos.coords.latitude, lon: pos.coords.longitude }),
        });
        const data = await res.json();
        if (data.arrivals) setBusArrivals(data);
      } catch (err) { console.error("Bus fetch error:", err); }
      finally { setBusLoading(false); }
    }, () => setBusLoading(false));
  }

  function analyze() { runAnalysis(transit, line, origin, dest, time, day, purpose); }
  const maxCrowd = result ? Math.max(...result.timeline.map(t => t.crowd), 1) : 1;

  return (
    <main className={styles.main}>
      <div className={styles.container}>

        {/* AUTH MODAL */}
        {showAuth && (
          <div className={styles.modalOverlay} onClick={() => setShowAuth(false)}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
              <h2 className={styles.modalTitle}>{authMode === "signin" ? "Sign in" : "Create account"}</h2>
              <p className={styles.modalSub}>Sync your commutes across all devices</p>
              {authError && <div className={styles.authError}>{authError}</div>}
              <div className={styles.formGroup}>
                <label className={styles.label}>Email</label>
                <input className={styles.input} type="email" value={authEmail}
                  onChange={e => setAuthEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div className={styles.formGroup} style={{ marginTop: 12 }}>
                <label className={styles.label}>Password</label>
                <input className={styles.input} type="password" value={authPassword}
                  onChange={e => setAuthPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <button className={styles.analyzeBtn} style={{ marginTop: 16 }}
                onClick={handleAuth} disabled={authLoading}>
                {authLoading ? "Loading..." : authMode === "signin" ? "Sign in" : "Create account"}
              </button>
              <button className={styles.authToggle}
                onClick={() => setAuthMode(authMode === "signin" ? "signup" : "signin")}>
                {authMode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>
          </div>
        )}

        <header className={styles.header}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>🚇</span>
            <div>
              <h1 className={styles.title}>ClearCommute</h1>
              <p className={styles.subtitle}>
                AI-powered MTA crowd intelligence • Live arrivals
                {weather && (
                  <span className={styles.weatherBadge}>
                    {weather.isRaining ? "🌧️" : weather.isSnowing ? "❄️" : weather.isStormy ? "⛈️" : weather.isClear ? "☀️" : "🌤️"}
                    {" "}{weather.temperature}°F · {weather.condition}
                  </span>
                )}
              </p>
            </div>
            <div className={styles.headerActions}>
              {user ? (
                <button className={styles.authBtn} onClick={handleSignOut} title="Sign out">👤 {user.email?.split("@")[0]}</button>
              ) : (
                <button className={styles.authBtn} onClick={() => setShowAuth(true)}>Sign in</button>
              )}
              <button className={styles.notifBtn}
                onClick={() => {
                  if (notifStatus === "granted") {
                    alert("To turn off notifications, go to your browser settings and block notifications for clearcommute.vercel.app");
                  } else { subscribeToNotifications(); }
                }}
                title={notifStatus === "granted" ? "Notifications on" : "Enable notifications"}>
                {notifStatus === "granted" ? "🔔" : "🔕"}
              </button>
            </div>
          </div>
        </header>

        {profiles.length > 0 && (
          <section className={styles.card}>
            <h2 className={styles.sectionLabel}>
              My commutes {user && <span className={styles.cloudBadge}>☁️ synced</span>}
            </h2>
            <div className={styles.profilesList}>
              {profiles.map(p => (
                <div key={p.id} className={styles.profileRow}>
                  <button className={styles.profileBtn} onClick={() => loadProfile(p)}>
                    <span className={styles.profileBullet} style={{ background: LINE_COLORS[p.line] || "#555" }}>{p.line}</span>
                    <span className={styles.profileName}>{p.name}</span>
                  </button>
                  <button className={styles.profileDelete} onClick={() => deleteProfile(p.id)}>✕</button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className={styles.card}>
          <h2 className={styles.sectionLabel}>Plan your commute</h2>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Transit type</label>
              <select className={styles.select} value={transit} onChange={e => handleTransitChange(e.target.value)}>
                {Object.entries(TRANSIT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Line / Route</label>
              <select className={styles.select} value={line} onChange={e => setLine(e.target.value)}>
                {LINES[transit].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className={styles.formRowThree}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Origin station</label>
              <input className={styles.input} value={origin} onChange={e => setOrigin(e.target.value)} placeholder="e.g. Baychester Av" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Destination</label>
              <input className={styles.input} value={dest} onChange={e => setDest(e.target.value)} placeholder="e.g. 59 St" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Depart around</label>
              <input className={styles.input} type="time" value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Day</label>
              <select className={styles.select} value={day} onChange={e => setDay(e.target.value)}>
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Trip purpose</label>
              <select className={styles.select} value={purpose} onChange={e => setPurpose(e.target.value)}>
                <option value="commute">Morning commute</option>
                <option value="evening">Evening commute</option>
                <option value="leisure">Leisure / errand</option>
                <option value="airport">Airport transfer</option>
              </select>
            </div>
          </div>
          <div className={styles.btnRow}>
            <button className={styles.analyzeBtn} onClick={analyze} disabled={loading}>
              {loading ? "Analyzing..." : "Analyze my commute →"}
            </button>
            <button className={styles.saveBtn} onClick={saveProfile} disabled={!origin && !dest}>
              {saveMsg || "Save commute"}
            </button>
          </div>
          {transit === "bus" && (
            <button className={styles.busBtn} onClick={fetchBusLocation} disabled={busLoading}>
              {busLoading ? "Finding nearest stop..." : "📍 Live bus arrivals near me"}
            </button>
          )}
        </section>

        {error && <div className={styles.errorBox}><strong>Error:</strong> {error}</div>}

        {loading && (
          <div className={styles.card}>
            <div className={styles.loadingState}>
              <div className={styles.loadingDots}><span /><span /><span /></div>
              <p>Fetching live data + AI analysis for {TRANSIT_LABELS[transit]} {line}...</p>
            </div>
          </div>
        )}

        {alerts.length > 0 && !loading && (
          <section className={styles.alertsCard}>
            <h2 className={styles.sectionLabel}>⚠️ Service alerts — {line} train</h2>
            {alerts.map((a, i) => (
              <div key={i} className={styles.alertItem} style={{ borderLeftColor: alertColor(a.effect) }}>
                <div className={styles.alertHeader}>{alertIcon(a.effect)} {a.header}</div>
              </div>
            ))}
          </section>
        )}

        {busArrivals && transit === "bus" && !loading && (
          <section className={styles.card}>
            <h2 className={styles.sectionLabel}>
              🚌 Live bus arrivals — {line}
              <span className={styles.liveBadge}>● LIVE</span>
            </h2>
            <p className={styles.mutedNote} style={{ marginBottom: 12 }}>Nearest stop: {busArrivals.stopName}</p>
            {busArrivals.arrivals.length === 0 && <p className={styles.mutedNote}>No buses in the next 60 minutes.</p>}
            <div className={styles.arrivalsList}>
              {busArrivals.arrivals.map((arr, i) => (
                <div key={i} className={styles.arrivalRow}>
                  <span className={styles.lineBullet} style={{ background: "#FF6319", fontSize: 10 }}>{arr.route}</span>
                  <span className={styles.arrivalDir}>{arr.destination}</span>
                  <span className={styles.arrivalTime}>{arr.presentable}</span>
                  <div className={styles.arrivalBar} style={{
                    width: arr.minutes !== null ? `${Math.min(100,(arr.minutes/15)*100)}%` : "50%",
                    background: (arr.minutes || 0) <= 2 ? "var(--green)" : (arr.minutes || 0) <= 8 ? "var(--amber)" : "var(--border-strong)",
                  }} />
                </div>
              ))}
            </div>
          </section>
        )}

        {arrivals && !loading && (
          <section className={styles.card}>
            <h2 className={styles.sectionLabel}>
              Live arrivals — {line} at {origin || "your station"}
              <span className={styles.liveBadge}>● LIVE</span>
            </h2>
            {!arrivals.stopFound && <p className={styles.mutedNote}>{arrivals.message || "Station not found."}</p>}
            {arrivals.stopFound && arrivals.arrivals.length === 0 && <p className={styles.mutedNote}>No upcoming trains in the next 60 minutes.</p>}
            {arrivals.stopFound && arrivals.arrivals.length > 0 && (
              <div className={styles.arrivalsList}>
                {arrivals.arrivals.map((arr, i) => (
                  <div key={i} className={styles.arrivalRow}>
                    <span className={styles.lineBullet} style={{ background: LINE_COLORS[arr.line] || "#555" }}>{arr.line}</span>
                    <span className={styles.arrivalDir}>{arr.direction}</span>
                    <span className={styles.arrivalTime}>{arr.minutes === 0 ? "Now" : `${arr.minutes} min`}</span>
                    <div className={styles.arrivalBar} style={{ width: `${Math.min(100,(arr.minutes/15)*100)}%`, background: arr.minutes <= 2 ? "var(--green)" : arr.minutes <= 8 ? "var(--amber)" : "var(--border-strong)" }} />
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {result && !loading && (
          <div className={styles.results}>
            <section className={styles.card}>
              <h2 className={styles.sectionLabel}>Crowd forecast — {line} at {to12Hour(time)}</h2>
              <div className={styles.metricGrid}>
                <div className={styles.metric}><div className={styles.metricLabel}>Crowd level</div><div className={styles.metricValue} style={{ color: crowdColor(result.crowdScore) }}>{result.crowdScore}%</div></div>
                <div className={styles.metric}><div className={styles.metricLabel}>Est. duration</div><div className={styles.metricValue}>{result.estimatedDuration}</div></div>
                <div className={styles.metric}><div className={styles.metricLabel}>Est. wait</div><div className={styles.metricValue}>{result.estimatedWait}</div></div>
              </div>
              <div className={styles.crowdBar}><div className={styles.crowdFill} style={{ width: `${result.crowdScore}%`, background: crowdColor(result.crowdScore) }} /></div>
              <p className={styles.aiSummary}>{result.aiSummary}</p>
              <h3 className={styles.sectionLabelSm}>Crowd pattern — 2 hour window</h3>
              <div className={styles.timeline}>
                {result.timeline.map((slot, i) => {
                  const h = Math.round((slot.crowd / maxCrowd) * 52);
                  return (
                    <div key={i} className={styles.timeSlot}>
                      <div className={styles.barWrap}>
                        <div className={`${styles.bar} ${i === 3 ? styles.barActive : ""}`} style={{ height: `${h}px`, background: crowdColor(slot.crowd) }} />
                      </div>
                      <div className={styles.timeLabel}>{slot.time}</div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className={styles.card}>
              <h2 className={styles.sectionLabel}>Best departure times</h2>
              <div className={styles.departGrid}>
                {result.departureSuggestions.map((dep, i) => (
                  <div key={i} className={`${styles.departOption} ${i === 0 ? styles.departBest : ""}`}>
                    <div className={styles.departTime}>{dep.time}</div>
                    <div className={styles.departCrowd} style={{ color: crowdColor(dep.crowd) }}>{crowdLabel(dep.crowd)}</div>
                    <div className={`${styles.badge} ${getBadgeClass(dep.crowd, i === 0, styles)}`}>{i === 0 ? "✓ Recommended" : crowdLabel(dep.crowd)}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className={styles.card}>
              <h2 className={styles.sectionLabel}>Insider tips for this route</h2>
              {result.tips.map((tip, i) => (
                <div key={i} className={styles.tipItem}>
                  <span className={styles.tipIcon}>{TIP_ICONS[tip.icon] || "💡"}</span>
                  <div><div className={styles.tipText}>{tip.tip}</div><div className={styles.tipDetail}>{tip.detail}</div></div>
                </div>
              ))}
            </section>

            {heatmap && (
              <section className={styles.card}>
                <h2 className={styles.sectionLabel}>Weekly crowd heatmap — {line} line</h2>
                <div className={styles.heatmapInsights}>
                  <span>🔴 Busiest: {heatmap.peakDay} {heatmap.peakHour}</span>
                  <span>🟢 Lightest: {heatmap.lightestDay} {heatmap.lightestHour}</span>
                </div>
                <div className={styles.heatmapGrid}>
                  <div className={styles.heatmapLabels}>
                    {["12a","1a","2a","3a","4a","5a","6a","7a","8a","9a","10a","11a","12p","1p","2p","3p","4p","5p","6p","7p","8p","9p","10p","11p"].map(h => (
                      <div key={h} className={styles.heatmapHourLabel}>{h}</div>
                    ))}
                  </div>
                  {["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map(day => (
                    <div key={day} className={styles.heatmapRow}>
                      <div className={styles.heatmapDayLabel}>{day.slice(0,3)}</div>
                      <div className={styles.heatmapCells}>
                        {(heatmap.heatmap[day] || []).map((val, i) => (
                          <div
                            key={i}
                            className={styles.heatmapCell}
                            title={`${day} ${i}:00 — ${val}% crowded`}
                            style={{
                              background: val < 20 ? "var(--green)" :
                                val < 45 ? "#7bc67e" :
                                val < 65 ? "var(--amber)" :
                                val < 80 ? "#e8834a" : "var(--red)",
                              opacity: val < 5 ? 0.15 : 0.3 + (val / 100) * 0.7,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}