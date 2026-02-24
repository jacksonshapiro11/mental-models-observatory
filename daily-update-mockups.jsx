import { useState } from "react";

// Sample brief data matching the Editorial Bible structure
const sampleBrief = {
  date: "February 23, 2026",
  lifeNote: "Sunday morning clarity — the kind where coffee tastes better because you're not rushing anywhere. Took the dog out at sunrise and realized I've been so locked into screens that I forgot what unfiltered morning light does to your nervous system. Today's brief comes from that headspace: grounded, unhurried, seeing clearly.",
  newsTldr: "Markets pricing in a hawkish Fed pause while Iran nuclear talks stall, SaaS earnings continue the structural repricing thesis, and crypto infrastructure quietly builds through the noise of retail capitulation.",
  dashboard: [
    { label: "S&P 500", value: "5,847", change: "+0.3%", positive: true },
    { label: "10Y Yield", value: "4.62%", change: "+4bps", positive: false },
    { label: "BTC", value: "$94,200", change: "-1.2%", positive: false },
    { label: "ETH", value: "$2,780", change: "-2.1%", positive: false },
    { label: "SOL", value: "$148", change: "+0.8%", positive: true },
    { label: "Gold", value: "$2,945", change: "+0.4%", positive: true },
    { label: "DXY", value: "104.8", change: "+0.2%", positive: false },
    { label: "Oil (WTI)", value: "$76.30", change: "-0.6%", positive: false },
  ],
  theSix: [
    { headline: "Fed minutes reveal deeper split on rate path than market expects", detail: "Three governors pushing for cuts by June while two want to hold through year-end. The market is pricing the median, but the distribution matters more than the center — this is a bimodal Fed, not a consensual one." },
    { headline: "Datadog earnings crush estimates, stock drops 8%", detail: "Revenue up 27% but guidance 'only' 22%. The SaaS repricing thesis in real time: even great execution gets punished when multiples compress from 20x to 14x revenue. The new normal is earning your valuation quarterly." },
    { headline: "Iran nuclear talks suspended after IAEA report", detail: "Enrichment at 83.7% — technically not weapons-grade but close enough to change the insurance math. Oil barely moved, which tells you the market has priced in permanent Iran risk. The real trade is what happens to Gulf sovereign spending if diplomacy dies." },
    { headline: "Anthropic raises $5B at $80B valuation", detail: "The AI infrastructure buildout continues regardless of whether any single model 'wins.' This is the equivalent of selling picks and shovels — the compute demand curve hasn't even inflected yet." },
    { headline: "Japan 10Y hits 1.4%, highest since 2011", detail: "BOJ yield curve control is dead in everything but name. The last major buyer of global duration is becoming a seller. Second-order: Japanese capital repatriation is the most underpriced macro risk of 2026." },
    { headline: "EU proposes digital services tax overhaul targeting AI companies", detail: "Revenue-based taxation of AI inference APIs. If this passes, it fundamentally changes the unit economics of API-first AI businesses. Watch for US retaliation — this is trade war by other means." },
  ],
  theTake: {
    title: "The SaaS Repricing Is Structural, Not Cyclical",
    content: `The pattern is now undeniable across three earnings cycles: best-in-class SaaS companies growing 25%+ are getting valued like they're growing 15%. Datadog, MongoDB, Snowflake — the names don't matter. The multiple compression is the message.

Here's what the market is actually saying: the AI agent layer is going to displace a meaningful chunk of SaaS seat-based revenue within 3-5 years. Every workflow tool charging per-seat is now running on a countdown timer. The market isn't stupid — it's early.

The structural argument: if an AI agent can handle 60% of what a junior analyst does in a BI tool, the enterprise doesn't need 200 seats. It needs 50 seats and 10 agent licenses. The revenue model inverts from "more humans = more revenue" to "better agents = less revenue per workflow."

This doesn't mean SaaS is dead. It means the survivors will be the ones who own the data layer (Snowflake, Databricks) or become the agent orchestration layer themselves. The tools that sit on top — the dashboards, the project managers, the CRMs — are the ones getting repriced.

Position implication: long data infrastructure, short workflow SaaS. The market is doing this trade slowly. It will accelerate.`,
  },
  bigStories: [
    { title: "SaaS Structural Repricing", status: "accelerating", detail: "Multiple compression now systematic across best-in-class names" },
    { title: "Fed's Impossible Position", status: "developing", detail: "Bimodal rate path creates vol opportunity" },
    { title: "Iran Nuclear Escalation", status: "elevated", detail: "Talks suspended, enrichment approaching threshold" },
    { title: "Crypto Infrastructure Build", status: "quiet accumulation", detail: "Building through retail capitulation" },
    { title: "Gold Regime Change", status: "confirming", detail: "Central bank buying structural, not cyclical" },
    { title: "Japan Rate Normalization", status: "accelerating", detail: "Repatriation risk underpriced" },
    { title: "AI Energy Infrastructure", status: "early innings", detail: "Compute demand curve hasn't inflected" },
    { title: "Gulf Sovereign AI Play", status: "watching", detail: "Diplomacy failure could accelerate sovereign tech spend" },
  ],
  tomorrowsHeadlines: [
    { title: "Agent Commerce Layer", timeframe: "12-18 months", detail: "AI agents need payment rails — SOL positioning for this" },
    { title: "Professional Services Disruption", timeframe: "18-24 months", detail: "Legal, accounting, consulting fee structures will break" },
    { title: "Sovereign Compute Race", timeframe: "12-18 months", detail: "Nations treating AI compute like strategic reserve" },
    { title: "Humanoid Robotics Inflection", timeframe: "24-36 months", detail: "Component suppliers are the picks-and-shovels play" },
  ],
  watchlist: [
    { ticker: "ETN", name: "Eaton Corp", thesis: "Software-disguised industrial, power infrastructure for AI data centers", conviction: "high", status: "building" },
    { ticker: "SOL", name: "Solana", thesis: "Agent payment rails + fastest settlement layer", conviction: "medium-high", status: "accumulating" },
    { ticker: "6324.T", name: "Harmonic Drive", thesis: "Humanoid robotics picks-and-shovels, precision gears monopoly", conviction: "medium", status: "watching" },
  ],
  discovery: {
    title: "Why Cathedrals Took 200 Years to Build",
    content: "Reading about medieval cathedral construction and the intergenerational commitment it required. Builders who laid foundations knew they'd never see the spires. The interesting parallel: the best compounding systems — whether investment portfolios, knowledge bases, or institutions — require the same faith in future value that you can't yet see. This daily brief is a small cathedral.",
  },
};

// Status badge colors
const statusColors = {
  accelerating: { bg: "rgba(239, 68, 68, 0.15)", text: "#f87171", border: "rgba(239, 68, 68, 0.3)" },
  developing: { bg: "rgba(251, 191, 36, 0.15)", text: "#fbbf24", border: "rgba(251, 191, 36, 0.3)" },
  elevated: { bg: "rgba(239, 68, 68, 0.15)", text: "#f87171", border: "rgba(239, 68, 68, 0.3)" },
  "quiet accumulation": { bg: "rgba(74, 222, 128, 0.15)", text: "#4ade80", border: "rgba(74, 222, 128, 0.3)" },
  confirming: { bg: "rgba(74, 222, 128, 0.15)", text: "#4ade80", border: "rgba(74, 222, 128, 0.3)" },
  "early innings": { bg: "rgba(96, 165, 250, 0.15)", text: "#60a5fa", border: "rgba(96, 165, 250, 0.3)" },
  watching: { bg: "rgba(148, 163, 184, 0.15)", text: "#94a3b8", border: "rgba(148, 163, 184, 0.3)" },
  building: { bg: "rgba(74, 222, 128, 0.15)", text: "#4ade80", border: "rgba(74, 222, 128, 0.3)" },
  accumulating: { bg: "rgba(251, 191, 36, 0.15)", text: "#fbbf24", border: "rgba(251, 191, 36, 0.3)" },
};

const StatusBadge = ({ status }) => {
  const colors = statusColors[status] || statusColors.watching;
  return (
    <span style={{
      fontSize: "11px",
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      padding: "3px 10px",
      borderRadius: "12px",
      backgroundColor: colors.bg,
      color: colors.text,
      border: `1px solid ${colors.border}`,
      whiteSpace: "nowrap",
    }}>
      {status}
    </span>
  );
};

const ConvictionDots = ({ level }) => {
  const levels = { low: 1, medium: 2, "medium-high": 3, high: 4 };
  const filled = levels[level] || 2;
  return (
    <div style={{ display: "flex", gap: "3px", alignItems: "center" }}>
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: i <= filled ? "#D4AF37" : "rgba(212, 175, 55, 0.2)",
            border: i <= filled ? "none" : "1px solid rgba(212, 175, 55, 0.3)",
          }}
        />
      ))}
    </div>
  );
};

// ============================================
// LAYOUT 1: Single Scroll, Sectioned
// ============================================
const SingleScrollLayout = () => {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      {/* Date & TLDR */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 13, color: "#D4AF37", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
          {sampleBrief.date}
        </div>
        <p style={{ fontSize: 16, color: "#94a3b8", lineHeight: 1.6, fontStyle: "italic" }}>
          {sampleBrief.newsTldr}
        </p>
      </div>

      {/* Life Note */}
      <section style={{ marginBottom: 48, paddingBottom: 48, borderBottom: "1px solid rgba(212, 175, 55, 0.15)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#D4AF37", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>Life Note</div>
        <p style={{ fontSize: 16, lineHeight: 1.8, color: "#E5DACB" }}>
          {sampleBrief.lifeNote}
        </p>
      </section>

      {/* Dashboard */}
      <section style={{ marginBottom: 48, paddingBottom: 48, borderBottom: "1px solid rgba(212, 175, 55, 0.15)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#D4AF37", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>Dashboard</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {sampleBrief.dashboard.map((item) => (
            <div key={item.label} style={{
              backgroundColor: "rgba(61, 40, 21, 0.6)",
              borderRadius: 10,
              padding: "14px 16px",
              border: "1px solid rgba(212, 175, 55, 0.1)",
            }}>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6, fontWeight: 500 }}>{item.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#F5EDE3", fontVariantNumeric: "tabular-nums" }}>{item.value}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: item.positive ? "#4ade80" : "#f87171", marginTop: 4 }}>
                {item.change}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* The Six */}
      <section style={{ marginBottom: 48, paddingBottom: 48, borderBottom: "1px solid rgba(212, 175, 55, 0.15)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#D4AF37", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 20 }}>The Six</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {sampleBrief.theSix.map((item, i) => (
            <div key={i}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#F5EDE3", marginBottom: 6, lineHeight: 1.4 }}>{item.headline}</div>
              <div style={{ fontSize: 15, color: "#C4B5A0", lineHeight: 1.7 }}>{item.detail}</div>
            </div>
          ))}
        </div>
      </section>

      {/* The Take — Hero treatment */}
      <section style={{
        marginBottom: 48,
        paddingBottom: 48,
        borderBottom: "1px solid rgba(212, 175, 55, 0.15)",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#D4AF37", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>The Take</div>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: "#F5EDE3", lineHeight: 1.25, marginBottom: 24, letterSpacing: "-0.02em" }}>
          {sampleBrief.theTake.title}
        </h2>
        {sampleBrief.theTake.content.split("\n\n").map((para, i) => (
          <p key={i} style={{ fontSize: 16, lineHeight: 1.85, color: "#E5DACB", marginBottom: 20 }}>{para}</p>
        ))}
      </section>

      {/* Big Stories */}
      <section style={{ marginBottom: 48, paddingBottom: 48, borderBottom: "1px solid rgba(212, 175, 55, 0.15)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#D4AF37", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>Big Stories</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sampleBrief.bigStories.map((story, i) => (
            <div key={i} style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              backgroundColor: "rgba(61, 40, 21, 0.4)",
              borderRadius: 8,
              border: "1px solid rgba(212, 175, 55, 0.08)",
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#F5EDE3" }}>{story.title}</div>
                <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>{story.detail}</div>
              </div>
              <StatusBadge status={story.status} />
            </div>
          ))}
        </div>
      </section>

      {/* Tomorrow's Headlines */}
      <section style={{ marginBottom: 48, paddingBottom: 48, borderBottom: "1px solid rgba(212, 175, 55, 0.15)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#D4AF37", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>Tomorrow's Headlines</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {sampleBrief.tomorrowsHeadlines.map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#60a5fa",
                backgroundColor: "rgba(96, 165, 250, 0.1)",
                padding: "4px 10px",
                borderRadius: 10,
                whiteSpace: "nowrap",
                marginTop: 2,
              }}>
                {item.timeframe}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#F5EDE3" }}>{item.title}</div>
                <div style={{ fontSize: 14, color: "#94a3b8", marginTop: 4 }}>{item.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Watchlist */}
      <section style={{ marginBottom: 48, paddingBottom: 48, borderBottom: "1px solid rgba(212, 175, 55, 0.15)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#D4AF37", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>Watchlist</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {sampleBrief.watchlist.map((item, i) => (
            <div key={i} style={{
              padding: "16px 20px",
              backgroundColor: "rgba(61, 40, 21, 0.5)",
              borderRadius: 10,
              border: "1px solid rgba(212, 175, 55, 0.12)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: "#D4AF37", fontFamily: "monospace" }}>{item.ticker}</span>
                  <span style={{ fontSize: 14, color: "#94a3b8" }}>{item.name}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <ConvictionDots level={item.conviction} />
                  <StatusBadge status={item.status} />
                </div>
              </div>
              <div style={{ fontSize: 14, color: "#C4B5A0", lineHeight: 1.6 }}>{item.thesis}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Discovery */}
      <section style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#D4AF37", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Discovery</div>
        <div style={{
          padding: "20px 24px",
          backgroundColor: "rgba(212, 175, 55, 0.06)",
          borderRadius: 10,
          borderLeft: "3px solid #D4AF37",
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#F5EDE3", marginBottom: 10 }}>{sampleBrief.discovery.title}</div>
          <p style={{ fontSize: 15, color: "#E5DACB", lineHeight: 1.75 }}>{sampleBrief.discovery.content}</p>
        </div>
      </section>
    </div>
  );
};

// ============================================
// LAYOUT 2: Tabbed/Accordion Sections
// ============================================
const TabbedLayout = () => {
  const [activeTab, setActiveTab] = useState("take");

  const tabs = [
    { id: "life", label: "Life Note", icon: "☀" },
    { id: "dashboard", label: "Dashboard", icon: "◈" },
    { id: "six", label: "The Six", icon: "⬡" },
    { id: "take", label: "The Take", icon: "◆" },
    { id: "stories", label: "Big Stories", icon: "◉" },
    { id: "tomorrow", label: "Tomorrow", icon: "→" },
    { id: "watchlist", label: "Watchlist", icon: "◎" },
    { id: "discovery", label: "Discovery", icon: "✦" },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case "life":
        return <p style={{ fontSize: 16, lineHeight: 1.85, color: "#E5DACB" }}>{sampleBrief.lifeNote}</p>;
      case "dashboard":
        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {sampleBrief.dashboard.map((item) => (
              <div key={item.label} style={{
                backgroundColor: "rgba(61, 40, 21, 0.6)",
                borderRadius: 10,
                padding: "14px 16px",
                border: "1px solid rgba(212, 175, 55, 0.1)",
              }}>
                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>{item.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#F5EDE3" }}>{item.value}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: item.positive ? "#4ade80" : "#f87171", marginTop: 4 }}>{item.change}</div>
              </div>
            ))}
          </div>
        );
      case "six":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {sampleBrief.theSix.map((item, i) => (
              <div key={i}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#F5EDE3", marginBottom: 6 }}>{item.headline}</div>
                <div style={{ fontSize: 15, color: "#C4B5A0", lineHeight: 1.7 }}>{item.detail}</div>
              </div>
            ))}
          </div>
        );
      case "take":
        return (
          <div>
            <h2 style={{ fontSize: 26, fontWeight: 800, color: "#F5EDE3", lineHeight: 1.25, marginBottom: 24 }}>{sampleBrief.theTake.title}</h2>
            {sampleBrief.theTake.content.split("\n\n").map((p, i) => (
              <p key={i} style={{ fontSize: 16, lineHeight: 1.85, color: "#E5DACB", marginBottom: 20 }}>{p}</p>
            ))}
          </div>
        );
      case "stories":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {sampleBrief.bigStories.map((s, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", backgroundColor: "rgba(61, 40, 21, 0.4)", borderRadius: 8 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#F5EDE3" }}>{s.title}</div>
                  <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>{s.detail}</div>
                </div>
                <StatusBadge status={s.status} />
              </div>
            ))}
          </div>
        );
      case "tomorrow":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {sampleBrief.tomorrowsHeadlines.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#60a5fa", backgroundColor: "rgba(96, 165, 250, 0.1)", padding: "4px 10px", borderRadius: 10, whiteSpace: "nowrap", marginTop: 2 }}>{item.timeframe}</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#F5EDE3" }}>{item.title}</div>
                  <div style={{ fontSize: 14, color: "#94a3b8", marginTop: 4 }}>{item.detail}</div>
                </div>
              </div>
            ))}
          </div>
        );
      case "watchlist":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {sampleBrief.watchlist.map((item, i) => (
              <div key={i} style={{ padding: "16px 20px", backgroundColor: "rgba(61, 40, 21, 0.5)", borderRadius: 10, border: "1px solid rgba(212, 175, 55, 0.12)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: "#D4AF37", fontFamily: "monospace" }}>{item.ticker}</span>
                    <span style={{ fontSize: 14, color: "#94a3b8" }}>{item.name}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <ConvictionDots level={item.conviction} />
                    <StatusBadge status={item.status} />
                  </div>
                </div>
                <div style={{ fontSize: 14, color: "#C4B5A0", lineHeight: 1.6 }}>{item.thesis}</div>
              </div>
            ))}
          </div>
        );
      case "discovery":
        return (
          <div style={{ padding: "20px 24px", backgroundColor: "rgba(212, 175, 55, 0.06)", borderRadius: 10, borderLeft: "3px solid #D4AF37" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#F5EDE3", marginBottom: 10 }}>{sampleBrief.discovery.title}</div>
            <p style={{ fontSize: 15, color: "#E5DACB", lineHeight: 1.75 }}>{sampleBrief.discovery.content}</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      {/* Date & TLDR */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 13, color: "#D4AF37", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>{sampleBrief.date}</div>
        <p style={{ fontSize: 16, color: "#94a3b8", lineHeight: 1.6, fontStyle: "italic" }}>{sampleBrief.newsTldr}</p>
      </div>

      {/* Tab Bar */}
      <div style={{
        display: "flex",
        gap: 4,
        marginBottom: 32,
        overflowX: "auto",
        paddingBottom: 4,
        borderBottom: "1px solid rgba(212, 175, 55, 0.15)",
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? "#D4AF37" : "#94a3b8",
              backgroundColor: activeTab === tab.id ? "rgba(212, 175, 55, 0.1)" : "transparent",
              border: "none",
              borderBottom: activeTab === tab.id ? "2px solid #D4AF37" : "2px solid transparent",
              borderRadius: "6px 6px 0 0",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 0.2s",
            }}
          >
            <span style={{ marginRight: 6 }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ minHeight: 400 }}>
        {renderTabContent()}
      </div>
    </div>
  );
};

// ============================================
// LAYOUT 3: Magazine Layout
// ============================================
const MagazineLayout = () => {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Date & TLDR - full width */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 13, color: "#D4AF37", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>{sampleBrief.date}</div>
        <p style={{ fontSize: 17, color: "#94a3b8", lineHeight: 1.6, fontStyle: "italic" }}>{sampleBrief.newsTldr}</p>
      </div>

      {/* Row 1: Life Note + Dashboard */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 20, marginBottom: 20 }}>
        {/* Life Note Card */}
        <div style={{
          padding: "24px",
          backgroundColor: "rgba(61, 40, 21, 0.4)",
          borderRadius: 12,
          border: "1px solid rgba(212, 175, 55, 0.1)",
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#D4AF37", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>Life Note</div>
          <p style={{ fontSize: 15, lineHeight: 1.75, color: "#E5DACB" }}>{sampleBrief.lifeNote}</p>
        </div>

        {/* Dashboard Card */}
        <div style={{
          padding: "24px",
          backgroundColor: "rgba(61, 40, 21, 0.4)",
          borderRadius: 12,
          border: "1px solid rgba(212, 175, 55, 0.1)",
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#D4AF37", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>Dashboard</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {sampleBrief.dashboard.map((item) => (
              <div key={item.label} style={{
                backgroundColor: "rgba(42, 26, 15, 0.6)",
                borderRadius: 8,
                padding: "10px 12px",
                border: "1px solid rgba(212, 175, 55, 0.08)",
              }}>
                <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#F5EDE3" }}>{item.value}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: item.positive ? "#4ade80" : "#f87171", marginTop: 2 }}>{item.change}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: The Take — feature article, full width */}
      <div style={{
        padding: "36px 40px",
        backgroundColor: "rgba(212, 175, 55, 0.04)",
        borderRadius: 14,
        border: "1px solid rgba(212, 175, 55, 0.15)",
        marginBottom: 20,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#D4AF37", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>The Take</div>
        <h2 style={{ fontSize: 30, fontWeight: 800, color: "#F5EDE3", lineHeight: 1.2, marginBottom: 24, letterSpacing: "-0.02em" }}>{sampleBrief.theTake.title}</h2>
        <div style={{ columns: 2, columnGap: 32 }}>
          {sampleBrief.theTake.content.split("\n\n").map((p, i) => (
            <p key={i} style={{ fontSize: 15, lineHeight: 1.8, color: "#E5DACB", marginBottom: 18, breakInside: "avoid" }}>{p}</p>
          ))}
        </div>
      </div>

      {/* Row 3: The Six + Big Stories */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* The Six */}
        <div style={{
          padding: "24px",
          backgroundColor: "rgba(61, 40, 21, 0.4)",
          borderRadius: 12,
          border: "1px solid rgba(212, 175, 55, 0.1)",
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#D4AF37", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 18 }}>The Six</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {sampleBrief.theSix.slice(0, 4).map((item, i) => (
              <div key={i}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#F5EDE3", marginBottom: 4 }}>{item.headline}</div>
                <div style={{ fontSize: 13, color: "#C4B5A0", lineHeight: 1.65 }}>{item.detail}</div>
              </div>
            ))}
            <div style={{ fontSize: 13, color: "#D4AF37", cursor: "pointer" }}>+ 2 more →</div>
          </div>
        </div>

        {/* Big Stories Tracker */}
        <div style={{
          padding: "24px",
          backgroundColor: "rgba(61, 40, 21, 0.4)",
          borderRadius: 12,
          border: "1px solid rgba(212, 175, 55, 0.1)",
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#D4AF37", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 18 }}>Big Stories Tracker</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sampleBrief.bigStories.map((s, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < sampleBrief.bigStories.length - 1 ? "1px solid rgba(212, 175, 55, 0.06)" : "none" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#F5EDE3" }}>{s.title}</span>
                <StatusBadge status={s.status} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Tomorrow + Watchlist + Discovery */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
        {/* Tomorrow */}
        <div style={{
          padding: "24px",
          backgroundColor: "rgba(61, 40, 21, 0.4)",
          borderRadius: 12,
          border: "1px solid rgba(212, 175, 55, 0.1)",
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#D4AF37", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>Tomorrow's Headlines</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {sampleBrief.tomorrowsHeadlines.map((item, i) => (
              <div key={i}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#F5EDE3" }}>{item.title}</div>
                <div style={{ fontSize: 11, color: "#60a5fa", marginTop: 2 }}>{item.timeframe}</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4, lineHeight: 1.5 }}>{item.detail}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Watchlist */}
        <div style={{
          padding: "24px",
          backgroundColor: "rgba(61, 40, 21, 0.4)",
          borderRadius: 12,
          border: "1px solid rgba(212, 175, 55, 0.1)",
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#D4AF37", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>Watchlist</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {sampleBrief.watchlist.map((item, i) => (
              <div key={i} style={{ paddingBottom: 16, borderBottom: i < sampleBrief.watchlist.length - 1 ? "1px solid rgba(212, 175, 55, 0.08)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: "#D4AF37", fontFamily: "monospace" }}>{item.ticker}</span>
                  <ConvictionDots level={item.conviction} />
                </div>
                <div style={{ fontSize: 12, color: "#C4B5A0", lineHeight: 1.5 }}>{item.thesis}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Discovery */}
        <div style={{
          padding: "24px",
          backgroundColor: "rgba(212, 175, 55, 0.06)",
          borderRadius: 12,
          border: "1px solid rgba(212, 175, 55, 0.15)",
          borderLeft: "3px solid #D4AF37",
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#D4AF37", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>Discovery</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#F5EDE3", marginBottom: 10 }}>{sampleBrief.discovery.title}</div>
          <p style={{ fontSize: 13, color: "#E5DACB", lineHeight: 1.7 }}>{sampleBrief.discovery.content}</p>
        </div>
      </div>
    </div>
  );
};

// ============================================
// Main App: Layout Comparison
// ============================================
export default function DailyUpdateMockups() {
  const [activeLayout, setActiveLayout] = useState("scroll");

  const layouts = [
    { id: "scroll", label: "Option A: Single Scroll", desc: "Continuous read, clear sections, The Take gets hero treatment" },
    { id: "tabbed", label: "Option B: Tabbed Sections", desc: "Jump to any section, interactive, compact" },
    { id: "magazine", label: "Option C: Magazine", desc: "Mixed-width cards, data-dense, visual hierarchy" },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#2a1a0f",
      color: "#E5DACB",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        backgroundColor: "rgba(42, 26, 15, 0.95)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(212, 175, 55, 0.15)",
        padding: "16px 32px",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#D4AF37", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12 }}>
            Daily Update — Layout Comparison
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {layouts.map((l) => (
              <button
                key={l.id}
                onClick={() => setActiveLayout(l.id)}
                style={{
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: activeLayout === l.id ? 700 : 500,
                  color: activeLayout === l.id ? "#1A1410" : "#D4AF37",
                  backgroundColor: activeLayout === l.id ? "#D4AF37" : "transparent",
                  border: activeLayout === l.id ? "none" : "1px solid rgba(212, 175, 55, 0.3)",
                  borderRadius: 8,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {l.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 8 }}>
            {layouts.find((l) => l.id === activeLayout)?.desc}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "40px 32px 80px" }}>
        {activeLayout === "scroll" && <SingleScrollLayout />}
        {activeLayout === "tabbed" && <TabbedLayout />}
        {activeLayout === "magazine" && <MagazineLayout />}
      </div>
    </div>
  );
}