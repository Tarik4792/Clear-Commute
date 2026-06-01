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
  "G":"#6CBE45",
  "J":"#996633","Z":"#996633",
  "L":"#A7A9AC",
  "N":"#FCCC0A","Q":"#FCCC0A","R":"#FCCC0A","W":"#FCCC0A",
  "S":"#808183",
};

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

function to12Hour(time: string): string {
  const [hourStr, min] = time.split(":");
  const hour = parseInt(hourStr, 10);
  if (isNaN(hour) || !min) return time;
  const ampm = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 || 12;
  return `${h}:${min} ${ampm}`;
}

function crowdColor(pct: number) {
  if (pct < 40) return "var(--green)";
  if (pct < 70) return "var(--amber)";
  return "var(--red)";
}

function crowdLabel(pct: number) {
  if (pct < 30) return "Light";
  if (pct < 55) return "Moderate";
  if (pct < 75) return "Busy";
  return "Very Crowded";
}

function badgeStyle(pct: number, styles: Record<string, string>) {
  if (pct < 40) return styles.badgeBest;
  if (pct < 70) return styles.badgeOk;
  return styles.badgeBusy;
}

interface Arrival {
  line: string;
  minutes: number;
  direction: string;
  destination: string;
}

interface ArrivalsResult {
  arrivals: Arrival[];
  stopFound: boolean;
  message?: string;
  error?: string;
}

interface AnalysisResult {
  crowdScore: number;
  crowdLabel: string;
  estimatedDuration: string;
  estimatedWait: string;
  aiSummary: string;
  timeline: { time: string; crowd: number }[];
  departureSuggestions: { time: string; crowd: number; tag: string }[];
  tips: { icon: string; tip: string; detail: string }[];
}

const TIP_ICONS: Record<string, string> = {
  train: "🚇", clock: "🕐", "map-pin": "📍", star: "⭐", alert: "⚠️",
};

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
  const [error, setError] = useState("");

  useEffect(() => {
    const now = new Date();
    setTime(`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`);
    setDay(DAYS[now.getDay() === 0 ? 6 : now.getDay() - 1]);
  }, []);

  function handleTransitChange(val: string) {
    setTransit(val);
    setLine(LINES[val][0]);
  }

  async function analyze() {
    setLoading(true);
    setError("");
    setResult(null);
    setArrivals(null);

    try {
      const [analysisRes, arrivalsRes] = await Promise.allSettled([
        fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transit, line, origin, dest, time, day, purpose }),
        }).then(r => r.json()),
        transit === "subway"
          ? fetch("/api/arrivals", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ line, station: origin }),
            }).then(r => r.json())
          : Promise.resolve(null),
      ]);

      if (analysisRes.status === "fulfilled") {
        const data = analysisRes.value;
        if (data.error) throw new Error(data.error);
        setResult(data);
      } else {
        throw new Error("Analysis failed");
      }

      if (arrivalsRes.status === "fulfilled" && arrivalsRes.value) {
        setArrivals(arrivalsRes.value);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const maxCrowd = result ? Math.max(...result.timeline.map((t) => t.crowd), 1) : 1;

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>🚇</span>
            <div>
              <h1 className={styles.title}>ClearCommute</h1>
              <p className={styles.subtitle}>AI-powered MTA crowd intelligence • Live arrivals</p>
            </div>
          </div>
        </header>

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

          <button className={styles.analyzeBtn} onClick={analyze} disabled={loading}>
            {loading ? "Analyzing..." : "Analyze my commute →"}
          </button>
        </section>

        {error && <div className={styles.errorBox}><strong>Error:</strong> {error}</div>}

        {loading && (
          <div className={styles.card}>
            <div className={styles.loadingState}>
              <div className={styles.loadingDots}><span /><span /><span /></div>
              <p>Fetching live arrivals + AI crowd analysis for {TRANSIT_LABELS[transit]} {line}...</p>
            </div>
          </div>
        )}

        {arrivals && !loading && (
          <section className={styles.card}>
            <h2 className={styles.sectionLabel}>
              Live arrivals — {line} at {origin || "your station"}
              <span className={styles.liveBadge}>● LIVE</span>
            </h2>
            {!arrivals.stopFound && (
              <p className={styles.mutedNote}>{arrivals.message || "Station not found in database."}</p>
            )}
            {arrivals.stopFound && arrivals.arrivals.length === 0 && (
              <p className={styles.mutedNote}>No upcoming trains in the next 60 minutes.</p>
            )}
            {arrivals.stopFound && arrivals.arrivals.length > 0 && (
              <div className={styles.arrivalsList}>
                {arrivals.arrivals.map((arr, i) => (
                  <div key={i} className={styles.arrivalRow}>
                    <span className={styles.lineBullet} style={{ background: LINE_COLORS[arr.line] || "#555" }}>
                      {arr.line}
                    </span>
                    <span className={styles.arrivalDir}>{arr.direction}</span>
                    <span className={styles.arrivalTime}>
                      {arr.minutes === 0 ? "Now" : `${arr.minutes} min`}
                    </span>
                    <div className={styles.arrivalBar} style={{
                      width: `${Math.min(100, (arr.minutes / 15) * 100)}%`,
                      background: arr.minutes <= 2 ? "var(--green)" : arr.minutes <= 8 ? "var(--amber)" : "var(--border-strong)",
                    }} />
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
                <div className={styles.metric}>
                  <div className={styles.metricLabel}>Crowd level</div>
                  <div className={styles.metricValue} style={{ color: crowdColor(result.crowdScore) }}>
                    {result.crowdScore}%
                  </div>
                </div>
                <div className={styles.metric}>
                  <div className={styles.metricLabel}>Est. duration</div>
                  <div className={styles.metricValue}>{result.estimatedDuration}</div>
                </div>
                <div className={styles.metric}>
                  <div className={styles.metricLabel}>Est. wait</div>
                  <div className={styles.metricValue}>{result.estimatedWait}</div>
                </div>
              </div>

              <div className={styles.crowdBar}>
                <div className={styles.crowdFill} style={{ width: `${result.crowdScore}%`, background: crowdColor(result.crowdScore) }} />
              </div>

              <p className={styles.aiSummary}>{result.aiSummary}</p>

              <h3 className={styles.sectionLabelSm}>Crowd pattern — 2 hour window</h3>
              <div className={styles.timeline}>
                {result.timeline.map((slot, i) => {
                  const h = Math.round((slot.crowd / maxCrowd) * 52);
                  return (
                    <div key={i} className={styles.timeSlot}>
                      <div className={styles.barWrap}>
                        <div className={`${styles.bar} ${i === 3 ? styles.barActive : ""}`}
                          style={{ height: `${h}px`, background: crowdColor(slot.crowd) }} />
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
                    <div className={styles.departCrowd} style={{ color: crowdColor(dep.crowd) }}>
                      {crowdLabel(dep.crowd)}
                    </div>
                    <div className={`${styles.badge} ${badgeStyle(dep.crowd, styles)}`}>
                      {i === 0 ? "✓ Recommended" : crowdLabel(dep.crowd)}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className={styles.card}>
              <h2 className={styles.sectionLabel}>Insider tips for this route</h2>
              {result.tips.map((tip, i) => (
                <div key={i} className={styles.tipItem}>
                  <span className={styles.tipIcon}>{TIP_ICONS[tip.icon] || "💡"}</span>
                  <div>
                    <div className={styles.tipText}>{tip.tip}</div>
                    <div className={styles.tipDetail}>{tip.detail}</div>
                  </div>
                </div>
              ))}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}