import { Metadata } from "next";

interface ShareData {
  line: string;
  origin: string;
  dest: string;
  time: string;
  day: string;
  crowdScore: number;
  crowdLabel: string;
  aiSummary: string;
  bestDeparture: { time: string; crowd: number };
  createdAt: string;
}

const LINE_COLORS: Record<string, string> = {
  "1":"#EE352E","2":"#EE352E","3":"#EE352E",
  "4":"#00933C","5":"#00933C","6":"#00933C",
  "7":"#B933AD","A":"#0039A6","C":"#0039A6","E":"#0039A6",
  "B":"#FF6319","D":"#FF6319","F":"#FF6319","M":"#FF6319",
  "G":"#6CBE45","J":"#996633","Z":"#996633","L":"#A7A9AC",
  "N":"#FCCC0A","Q":"#FCCC0A","R":"#FCCC0A","W":"#FCCC0A",
};

function crowdColor(pct: number) {
  if (pct < 40) return "#00b347";
  if (pct < 70) return "#f0a030";
  return "#e8304a";
}

function decodeShare(id: string): ShareData | null {
  try {
    return JSON.parse(Buffer.from(id, "base64url").toString());
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = decodeShare(id);
  if (!data) return { title: "ClearCommute" };
  return {
    title: `${data.line} train — ${data.crowdScore}% crowded | ClearCommute`,
    description: data.aiSummary || `${data.line} from ${data.origin} to ${data.dest} on ${data.day}`,
    openGraph: {
      title: `${data.line} train is ${data.crowdScore}% crowded`,
      description: data.aiSummary,
      siteName: "ClearCommute",
    },
  };
}

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = decodeShare(id);

  if (!data) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#0f0f14", color: "#f0eff8", fontFamily: "-apple-system, sans-serif", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 48 }}>🚇</div>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Link expired or invalid</h1>
        <a href="/" style={{ color: "#00b347", fontSize: 14 }}>Go to ClearCommute →</a>
      </div>
    );
  }

  const bulletColor = LINE_COLORS[data.line] || "#555";
  const scoreColor = crowdColor(data.crowdScore);

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f14", color: "#f0eff8",
      fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif", padding: "2rem 1rem",
      display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ maxWidth: 480, width: "100%" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <span style={{ fontSize: 28 }}>🚇</span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.5 }}>ClearCommute</div>
            <div style={{ fontSize: 12, color: "#9090a8" }}>AI-powered MTA crowd intelligence</div>
          </div>
        </div>

        {/* Main card */}
        <div style={{ background: "#1a1a22", borderRadius: 18, padding: "1.5rem",
          border: "1px solid rgba(255,255,255,0.07)", marginBottom: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>

          {/* Route */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: bulletColor,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 800, color: "white", flexShrink: 0,
              fontFamily: "Helvetica Neue, Arial, sans-serif" }}>
              {data.line}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>
                {data.origin} → {data.dest}
              </div>
              <div style={{ fontSize: 13, color: "#9090a8", marginTop: 2 }}>
                {data.day} · {data.time}
              </div>
            </div>
          </div>

          {/* Crowd score */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 48, fontWeight: 800, color: scoreColor, letterSpacing: -2 }}>
              {data.crowdScore}%
            </span>
            <span style={{ fontSize: 18, color: scoreColor, fontWeight: 600 }}>
              {data.crowdLabel}
            </span>
          </div>

          {/* Bar */}
          <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, marginBottom: 16, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${data.crowdScore}%`, background: scoreColor, borderRadius: 3 }} />
          </div>

          {/* AI Summary */}
          {data.aiSummary && (
            <p style={{ fontSize: 14, color: "#c0c0d8", lineHeight: 1.7, marginBottom: 16 }}>
              {data.aiSummary}
            </p>
          )}

          {/* Best departure */}
          {data.bestDeparture && (
            <div style={{ background: "#0a2e18", borderRadius: 10, padding: "12px 16px",
              display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#4ddb80", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  ✓ Recommended departure
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>
                  {data.bestDeparture.time}
                </div>
              </div>
              <div style={{ fontSize: 13, color: "#4ddb80", fontWeight: 600 }}>
                {data.bestDeparture.crowd}% crowded
              </div>
            </div>
          )}
        </div>

        {/* CTA */}
        <a href="/" style={{ display: "block", background: "#f0eff8", color: "#0f0f14",
          borderRadius: 12, padding: "14px", textAlign: "center", textDecoration: "none",
          fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
          Plan your commute → clearcommute.vercel.app
        </a>

        <p style={{ textAlign: "center", fontSize: 12, color: "#60607a" }}>
          Shared via ClearCommute · {new Date(data.createdAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
