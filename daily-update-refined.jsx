import { useState, useEffect, useRef } from "react";

const sections = [
  { id: "dashboard", label: "Dashboard", shortLabel: "Dash" },
  { id: "the-six", label: "The Six", shortLabel: "Six" },
  { id: "the-take", label: "The Take", shortLabel: "Take" },
  { id: "big-stories", label: "Big Stories", shortLabel: "Stories" },
  { id: "tomorrows-headlines", label: "Tomorrow", shortLabel: "Tomorrow" },
  { id: "watchlist", label: "Watchlist", shortLabel: "Watch" },
  { id: "discovery", label: "Discovery", shortLabel: "Discovery" },
  { id: "worldview", label: "Worldview", shortLabel: "Worldview" },
  { id: "ref-big-stories", label: "Ref: Stories", shortLabel: "Ref:Stories" },
  { id: "ref-tomorrows", label: "Ref: Tomorrow", shortLabel: "Ref:Tmrw" },
];

const statusColors = {
  accelerating: { bg: "rgba(239, 68, 68, 0.12)", text: "#f87171", border: "rgba(239, 68, 68, 0.25)" },
  developing: { bg: "rgba(251, 191, 36, 0.12)", text: "#fbbf24", border: "rgba(251, 191, 36, 0.25)" },
  elevated: { bg: "rgba(239, 68, 68, 0.12)", text: "#f87171", border: "rgba(239, 68, 68, 0.25)" },
  new: { bg: "rgba(168, 85, 247, 0.12)", text: "#a855f7", border: "rgba(168, 85, 247, 0.25)" },
  watching: { bg: "rgba(148, 163, 184, 0.12)", text: "#94a3b8", border: "rgba(148, 163, 184, 0.25)" },
  building: { bg: "rgba(74, 222, 128, 0.12)", text: "#4ade80", border: "rgba(74, 222, 128, 0.25)" },
  accumulating: { bg: "rgba(251, 191, 36, 0.12)", text: "#fbbf24", border: "rgba(251, 191, 36, 0.25)" },
};

const StatusBadge = ({ status }) => {
  const colors = statusColors[status] || statusColors.watching;
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, textTransform: "uppercase",
      letterSpacing: "0.06em", padding: "3px 10px", borderRadius: 12,
      backgroundColor: colors.bg, color: colors.text,
      border: `1px solid ${colors.border}`, whiteSpace: "nowrap",
    }}>{status}</span>
  );
};

const SectionDivider = () => (
  <div style={{ height: 1, background: "linear-gradient(to right, transparent, rgba(212, 175, 55, 0.2), transparent)", margin: "0" }} />
);

const SectionLabel = ({ children, subtitle }) => (
  <div style={{
    fontSize: 11, fontWeight: 700, color: "#D4AF37",
    letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 20,
    display: "flex", alignItems: "center", gap: 10,
  }}>
    <span style={{ width: 18, height: 1, backgroundColor: "#D4AF37", display: "inline-block" }} />
    {children}
    {subtitle && <span style={{ fontSize: 10, color: "rgba(148, 163, 184, 0.6)", fontWeight: 500, textTransform: "none", letterSpacing: "0" }}>{subtitle}</span>}
  </div>
);

// Renders bold text within a string (handles **text** patterns)
const RichText = ({ text, style }) => {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span style={style}>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**")
          ? <strong key={i} style={{ color: "#F5EDE3", fontWeight: 700 }}>{part.slice(2, -2)}</strong>
          : part
      )}
    </span>
  );
};

export default function DailyUpdateRefined() {
  const [activeSection, setActiveSection] = useState("dashboard");
  const sectionRefs = useRef({});

  useEffect(() => {
    const observers = [];
    const options = { rootMargin: "-120px 0px -60% 0px", threshold: 0 };
    sections.forEach((section) => {
      const el = sectionRefs.current[section.id];
      if (!el) return;
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => { if (entry.isIntersecting) setActiveSection(section.id); });
      }, options);
      observer.observe(el);
      observers.push(observer);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const scrollToSection = (id) => {
    const el = sectionRefs.current[id];
    if (el) {
      const y = el.getBoundingClientRect().top + window.pageYOffset - 110;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  const currentIndex = sections.findIndex((s) => s.id === activeSection);
  const progress = ((currentIndex + 1) / sections.length) * 100;

  return (
    <div style={{
      minHeight: "100vh", backgroundColor: "#2a1a0f", color: "#E5DACB",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    }}>
      {/* ====== STICKY NAV ====== */}
      <div style={{
        position: "sticky", top: 0, zIndex: 100,
        backgroundColor: "rgba(42, 26, 15, 0.97)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(212, 175, 55, 0.12)",
      }}>
        <div style={{ height: 2, background: "rgba(212, 175, 55, 0.08)", position: "relative" }}>
          <div style={{ height: "100%", width: `${progress}%`, backgroundColor: "#D4AF37", transition: "width 0.3s ease" }} />
        </div>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, paddingBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#F5EDE3" }}>Daily Update</span>
              <span style={{ fontSize: 12, color: "rgba(212, 175, 55, 0.6)", fontWeight: 500 }}>Monday, February 23, 2026</span>
            </div>
            <span style={{ fontSize: 11, color: "rgba(148, 163, 184, 0.4)", fontWeight: 500 }}>{currentIndex + 1} of {sections.length}</span>
          </div>
          <div style={{ display: "flex", gap: 2, paddingBottom: 10 }}>
            {sections.map((section, i) => {
              const isActive = section.id === activeSection;
              const isPast = i < currentIndex;
              return (
                <button key={section.id} onClick={() => scrollToSection(section.id)} style={{
                  flex: 1, padding: "8px 4px", fontSize: 11,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? "#1A1410" : isPast ? "#D4AF37" : "#94a3b8",
                  backgroundColor: isActive ? "#D4AF37" : isPast ? "rgba(212, 175, 55, 0.08)" : "transparent",
                  border: isActive ? "none" : "1px solid rgba(212, 175, 55, 0.12)",
                  borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap",
                  transition: "all 0.2s", textAlign: "center",
                }}>{section.shortLabel}</button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ====== MAIN CONTENT ====== */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 100px" }}>

        {/* Opening quote */}
        <p style={{ fontSize: 16, color: "#D4AF37", fontStyle: "italic", lineHeight: 1.7, marginBottom: 24 }}>
          The person you'll be in five years is built by what you do today when nobody's watching.
        </p>

        {/* TLDR */}
        <div style={{ marginBottom: 48 }}>
          <p style={{ fontSize: 17, color: "#94a3b8", lineHeight: 1.65, fontStyle: "italic", borderLeft: "2px solid rgba(212, 175, 55, 0.3)", paddingLeft: 20 }}>
            Trump raised tariffs to 15% and the market shrugged. Crypto didn't. NVIDIA reports Wednesday. Iran talks Thursday. State of the Union tomorrow. The compression before the breakout.
          </p>
        </div>

        {/* ====== DASHBOARD ====== */}
        <section ref={(el) => (sectionRefs.current["dashboard"] = el)} style={{ marginBottom: 56 }}>
          <SectionLabel>The Dashboard</SectionLabel>

          {/* Equities */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#F5EDE3", marginBottom: 12 }}>Equities</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(212, 175, 55, 0.15)" }}>
                    {["Index", "Price", "1D", "5D", "1M", "1Y", "50D MA", "200D MA", "200W MA"].map((h) => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: h === "Index" ? "left" : "right", color: "#94a3b8", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["S&P 500", "6,910", "+0.7%", "+0.3%", "-1.3%", "+15%", "~6,902", "~6,924", "~5,200"],
                    ["Nasdaq 100", "22,886", "+0.9%", "+0.1%", "-3.5%", "+12%", "~23,100", "~22,800", "~16,400"],
                    ["Dow", "49,626", "+0.5%", "+0.3%", "+0.3%", "+16%", "~49,800", "~48,600", "~37,500"],
                  ].map((row, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(212, 175, 55, 0.06)" }}>
                      {row.map((cell, j) => (
                        <td key={j} style={{
                          padding: "10px 10px", textAlign: j === 0 ? "left" : "right",
                          color: j === 0 ? "#F5EDE3" : j === 1 ? "#F5EDE3" : cell.startsWith("+") ? "#4ade80" : cell.startsWith("-") ? "#f87171" : "#C4B5A0",
                          fontWeight: j <= 1 ? 600 : 500, fontVariantNumeric: "tabular-nums",
                        }}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 14, color: "#C4B5A0", lineHeight: 1.7, marginTop: 14, fontStyle: "italic" }}>
              Futures down ~0.5-0.7% on the 15% tariff headline. Friday's SCOTUS rally put S&P right back into the 50D/200D convergence zone. The market treated 10% → 15% as noise — Yardeni: "sit still and do nothing." VIX at 19.09. Mag 7 ETF down ~6% YTD. NVIDIA reports Wednesday after close — most important single event this month.
            </p>
          </div>

          {/* Crypto */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#F5EDE3", marginBottom: 12 }}>Crypto</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(212, 175, 55, 0.15)" }}>
                    {["Asset", "Price", "1D", "5D", "1M", "ATH", "50D MA", "200D EMA", "200W MA"].map((h) => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: h === "Asset" ? "left" : "right", color: "#94a3b8", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["BTC", "~$65,200", "-4.2%", "-4.8%", "-25%", "$126K (Oct '25)", "~$82,000", "~$85,000", "~$42,000"],
                    ["ETH", "~$1,870", "-5.4%", "-6.0%", "-29%", "$5,200 (Mar '25)", "~$2,800", "~$3,100", "~$2,200"],
                    ["SOL", "~$80", "-4.5%", "-5.0%", "-22%", "$340 (Nov '25)", "~$185", "~$200", "~$65"],
                  ].map((row, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(212, 175, 55, 0.06)" }}>
                      {row.map((cell, j) => (
                        <td key={j} style={{
                          padding: "10px 10px", textAlign: j === 0 ? "left" : "right",
                          color: j === 0 ? "#F5EDE3" : j === 1 ? "#F5EDE3" : cell.startsWith("+") ? "#4ade80" : cell.startsWith("-") ? "#f87171" : "#C4B5A0",
                          fontWeight: j <= 1 ? 600 : 500, fontVariantNumeric: "tabular-nums",
                        }}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 14, color: "#C4B5A0", lineHeight: 1.7, marginTop: 14, fontStyle: "italic" }}>
              BTC crashed 5% overnight on the 15% tariff news, touching $64,200 before bouncing to ~$65-66K. Equities futures down 0.5%. Crypto down 5%. That's not correlation — that's crypto being the weekend liquidity sponge for macro fear. ETF outflows now near $4B over five weeks. Vitalik sold ~$18M in ETH over recent weeks. Fear & Greed plumbing new lows. "Bitcoin to zero" Google searches hit US record. The capitulation data is textbook — the question is whether textbook still applies in a structurally different cycle.
            </p>
          </div>

          {/* Commodities & Rates */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#F5EDE3", marginBottom: 12 }}>Commodities & Rates</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(212, 175, 55, 0.15)" }}>
                    {["Asset", "Price", "1D", "1M", "1Y", "50D MA", "200D MA"].map((h) => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: h === "Asset" ? "left" : "right", color: "#94a3b8", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Gold", "~$5,138", "+1.0%", "+5.6%", "+43%", "~$4,900", "~$4,400"],
                    ["Silver", "~$87", "+6.0%", "+3.5%", "+41%", "~$80", "~$68"],
                    ["Brent", "$71.08", "-1.0%", "+10%", "+1%", "~$69", "~$72"],
                    ["US 10Y", "4.08%", "flat", "-15bp", "-42bp", "—", "—"],
                  ].map((row, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(212, 175, 55, 0.06)" }}>
                      {row.map((cell, j) => (
                        <td key={j} style={{
                          padding: "10px 10px", textAlign: j === 0 ? "left" : "right",
                          color: j === 0 ? "#F5EDE3" : j === 1 ? "#F5EDE3" : cell.startsWith("+") ? "#4ade80" : cell.startsWith("-") ? "#f87171" : "#C4B5A0",
                          fontWeight: j <= 1 ? 600 : 500, fontVariantNumeric: "tabular-nums",
                        }}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 14, color: "#C4B5A0", lineHeight: 1.7, marginTop: 14, fontStyle: "italic" }}>
              Gold above $5,100 — tariff chaos is rocket fuel for the safe haven bid. Silver absolutely ripping: +6% today to $87, outperforming gold as industrial + monetary demand converge. Goldman reiterated $5,400 year-end gold target. Silver Institute projects 6th consecutive year of structural deficit. Brent holding ~$71 on Iran talk optimism, but the tariff-driven demand uncertainty is a headwind.
            </p>
          </div>
        </section>

        <SectionDivider />

        {/* ====== THE SIX ====== */}
        <section ref={(el) => (sectionRefs.current["the-six"] = el)} style={{ margin: "56px 0" }}>
          <SectionLabel>The Six</SectionLabel>

          {/* Markets & Macro */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#F5EDE3", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.06em" }}>Markets & Macro</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div><RichText text="**Trump raised global tariffs from 10% to 15% Saturday — the maximum allowed under Section 122.** Markets barely flinched. MSCI World flat. The 150-day clock is now running on a higher base. This is the ceiling of what Section 122 permits without Congress. The next escalation requires new legal authority." style={{ fontSize: 15, color: "#C4B5A0", lineHeight: 1.75 }} /></div>
              <div><RichText text="**Fed Governor Waller spoke today at NABE.** March rate decision hinges on February labor data. He's &quot;looking through&quot; tariffs on inflation — if labor weakens further, he'd support a cut. If it firms, pause. He dissented in January wanting a cut. Translation: the dovish wing of the Fed is data-dependent, not tariff-dependent. The SCOTUS ruling doesn't change his calculus." style={{ fontSize: 15, color: "#C4B5A0", lineHeight: 1.75 }} /></div>
              <div><RichText text="**Yale Budget Lab: effective tariff rate now below the pre-SCOTUS 16%.** Section 122 at 15% is narrower than IEEPA was — excludes USMCA-compliant goods, energy, critical minerals, pharma, electronics. Net impact: modestly disinflationary vs the old regime, despite the higher headline number." style={{ fontSize: 15, color: "#C4B5A0", lineHeight: 1.75 }} /></div>
              <div><RichText text="**S&P futures down 0.5-0.7% pre-market on the 15% headline.** But the Friday rally absorbed the SCOTUS shock. The real test comes Wednesday with NVIDIA earnings. If Jensen delivers, the tariff noise fades. If he disappoints, the AI capex narrative cracks." style={{ fontSize: 15, color: "#C4B5A0", lineHeight: 1.75 }} /></div>
              <div><RichText text="**EU Parliament trade committee votes Tuesday on freezing the US-EU trade deal.** ECB's Lagarde warned Sunday the tariff moves threaten the agreement. India-US trade talks paused. South Korea reviewing its deal. The diplomatic fallout from SCOTUS + 15% is still cascading through the global trade system." style={{ fontSize: 15, color: "#C4B5A0", lineHeight: 1.75 }} /></div>
            </div>
          </div>

          {/* Crypto */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#F5EDE3", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.06em" }}>Crypto</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div><RichText text="**BTC crashed 5% overnight, touching $64,200** before bouncing to ~$65-66K. The 15% tariff announcement hit during thin Sunday liquidity. Crypto is the only risk asset that trades 24/7, making it the first to absorb macro shocks." style={{ fontSize: 15, color: "#C4B5A0", lineHeight: 1.75 }} /></div>
              <div><RichText text="**A $61M BTC whale position was liquidated on HTX** — largest single forced closure in 24 hours. BTC open interest dropped to $19.5B, far below the 2026 peak of $38.3B. Leverage is being wrung out." style={{ fontSize: 15, color: "#C4B5A0", lineHeight: 1.75 }} /></div>
              <div><RichText text="**Bitcoin ETFs: $3.8B in outflows over five consecutive weeks.** Historic streak. Institutional wariness persists since the October crash. But BlackRock's IBIT redemptions remain minimal — the retail-facing funds are hemorrhaging, not the institutional tier." style={{ fontSize: 15, color: "#C4B5A0", lineHeight: 1.75 }} /></div>
              <div><RichText text="**Vitalik Buterin sold ~1,870 ETH ($3.7M) in two days**, part of ~$18M total recent sales. ETH slid from $1,988 to $1,870 during the period. The founder selling into weakness is a bad look regardless of his stated charitable motives." style={{ fontSize: 15, color: "#C4B5A0", lineHeight: 1.75 }} /></div>
              <div><RichText text="**&quot;Bitcoin to zero&quot; Google searches hit a US all-time high this month.** Historically, peak despair searches correlate with bottoms. But the market structure — 49% drawdown over 139 days without a meaningful relief rally — is unprecedented in BTC's history." style={{ fontSize: 15, color: "#C4B5A0", lineHeight: 1.75 }} /></div>
              <div><RichText text="**$317M in token unlocks scheduled this week** across SUI, JUP, GRASS, EIGEN, and others. New supply pressure into an already fragile market." style={{ fontSize: 15, color: "#C4B5A0", lineHeight: 1.75 }} /></div>
            </div>
          </div>

          {/* AI & Tech */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#F5EDE3", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.06em" }}>AI & Tech</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div><RichText text="**NVIDIA reports Q4 FY2026 Wednesday after close.** Street expects $65.6B revenue (+65% YoY), $1.52 EPS. Goldman expects a $2B beat. Blackwell ramp, Rubin visibility, China sales status, and FY2027 guidance are the four things that matter. Jensen told CNBC earlier this month the $500B Blackwell+Rubin pipeline through end of CY2026 was tracking above forecast." style={{ fontSize: 15, color: "#C4B5A0", lineHeight: 1.75 }} /></div>
              <div><RichText text="**Meta guided CY2026 capex to $115-135B. Alphabet: $175-185B. Amazon: $200B.** All dramatically above Street expectations. The hyperscaler GPU arms race is accelerating, not plateauing. NVIDIA's problem isn't demand — it's whether anyone else can catch up." style={{ fontSize: 15, color: "#C4B5A0", lineHeight: 1.75 }} /></div>
              <div><RichText text="**NVIDIA released analysis showing 4-10x cost reduction for AI inference** by pairing Blackwell GPUs with open-source models. The inference economics are improving faster than training economics — this matters because inference is the growth workload." style={{ fontSize: 15, color: "#C4B5A0", lineHeight: 1.75 }} /></div>
              <div><RichText text="**Mag 7 ETF (MAGS) down ~6% YTD.** Microsoft -18%. Only Alphabet and NVIDIA in the green. The market is differentiating within Big Tech for the first time since 2022." style={{ fontSize: 15, color: "#C4B5A0", lineHeight: 1.75 }} /></div>
            </div>
          </div>

          {/* Geopolitics */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#F5EDE3", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.06em" }}>Geopolitics</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div><RichText text={`**Iran-US nuclear talks confirmed for Thursday in Geneva — third round.** Omani mediator confirmed. Iran's Araghchi said he expects to meet Witkoff, called a diplomatic solution a "good chance." Iran still working on draft proposal. The gap: US wants zero enrichment, Iran insists on retaining civilian nuclear capacity. Thursday is the most important geopolitical event this week.`} style={{ fontSize: 15, color: "#C4B5A0", lineHeight: 1.75 }} /></div>
              <div><RichText text={`**Iran's Pezeshkian: "encouraging signals" but "prepared for any potential scenario."** Witkoff said Trump is curious why Iran hasn't "capitulated." The US has the largest military presence in the Middle East in decades. Both sides signaling readiness for talks AND war simultaneously.`} style={{ fontSize: 15, color: "#C4B5A0", lineHeight: 1.75 }} /></div>
              <div><RichText text="**Armed man shot and killed by Secret Service at Mar-a-Lago overnight.** Austin Tucker Martin, 21, from North Carolina. Had a shotgun and gas can. Trump was at the White House. Third security incident targeting political figures in five days — a Georgia man rushed the Capitol last week. Political violence trend accelerating." style={{ fontSize: 15, color: "#C4B5A0", lineHeight: 1.75 }} /></div>
              <div><RichText text="**DHS shutdown enters Week 2.** Congress returns today. No deal expected before State of the Union tomorrow night. Global Entry suspended. TSA PreCheck reversal caused confusion. TSA workers miss their first full paycheck March 14 if the impasse continues. The shutdown is the backdrop for tomorrow's SOTU — 15+ Democratic lawmakers boycotting." style={{ fontSize: 15, color: "#C4B5A0", lineHeight: 1.75 }} /></div>
              <div><RichText text="**State of the Union tomorrow night at 9pm ET.** Trump faces: SCOTUS tariff defeat, Iran deadline, DHS shutdown, and 60% disapproval. Virginia Governor Spanberger delivers Democratic response. The speech itself is theater — the policy signals around tariffs, Iran, and the shutdown are what matters." style={{ fontSize: 15, color: "#C4B5A0", lineHeight: 1.75 }} /></div>
            </div>
          </div>

          {/* Deep Read / Listen */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#F5EDE3", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.06em" }}>Deep Read / Listen</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ padding: "16px 20px", backgroundColor: "rgba(61, 40, 21, 0.35)", borderRadius: 10, border: "1px solid rgba(212, 175, 55, 0.06)" }}>
                <div style={{ fontSize: 15, color: "#C4B5A0", lineHeight: 1.75 }}>
                  <strong style={{ color: "#F5EDE3" }}>🎧 Dwarkesh Podcast — Patrick Collison on the infrastructure layer for AI commerce.</strong> How Stripe is positioning for agent-to-agent payments and why the payment rails built for humans may not work for machines. If x402 and Solana are one path, Stripe is the other. Understanding both is essential. <em style={{ color: "#94a3b8" }}>(~90 min, full listen)</em>
                </div>
              </div>
              <div style={{ padding: "16px 20px", backgroundColor: "rgba(61, 40, 21, 0.35)", borderRadius: 10, border: "1px solid rgba(212, 175, 55, 0.06)" }}>
                <div style={{ fontSize: 15, color: "#C4B5A0", lineHeight: 1.75 }}>
                  <strong style={{ color: "#F5EDE3" }}>📖 Yale Budget Lab — "State of Tariffs: February 21, 2026."</strong> The most rigorous quantitative analysis of the post-SCOTUS tariff landscape. Models the fiscal impact of Section 122 at both 150-day expiry and permanent extension. Essential for understanding the actual economic impact vs the headline noise. <em style={{ color: "#94a3b8" }}>(~15 min read)</em>
                </div>
              </div>
              <div style={{ padding: "16px 20px", backgroundColor: "rgba(61, 40, 21, 0.35)", borderRadius: 10, border: "1px solid rgba(212, 175, 55, 0.06)" }}>
                <div style={{ fontSize: 15, color: "#C4B5A0", lineHeight: 1.75 }}>
                  <strong style={{ color: "#F5EDE3" }}>🎧 MacroVoices — Russell Napier on financial repression and the gold regime change.</strong> Napier argues central bank gold buying is a generational structural shift, not a cyclical trade. Connects the gold/DXY decoupling to the end of dollar hegemony. Relevant for Thesis #5 and the gold Big Story. <em style={{ color: "#94a3b8" }}>(~55 min, skip to 12:00)</em>
                </div>
              </div>
            </div>
          </div>

          {/* Inner Game */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#F5EDE3", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.06em" }}>Inner Game</div>
            <div style={{ padding: "24px 28px", backgroundColor: "rgba(212, 175, 55, 0.04)", borderRadius: 12, borderLeft: "3px solid #D4AF37" }}>
              <p style={{ fontSize: 17, color: "#D4AF37", fontStyle: "italic", lineHeight: 1.7, marginBottom: 6 }}>
                "The impediment to action advances action. What stands in the way becomes the way."
              </p>
              <p style={{ fontSize: 14, color: "#94a3b8", marginBottom: 18 }}>— Marcus Aurelius (Meditations, V.20)</p>
              <p style={{ fontSize: 15, color: "#E5DACB", lineHeight: 1.8, marginBottom: 16 }}>
                You know that thing you've been avoiding? The conversation, the decision, the habit you keep putting off because the timing isn't right? Marcus is pointing at something you already know: the resistance IS the path. The hard conversation builds the relationship. The uncomfortable decision builds the judgment. The habit you don't feel like starting is the one that changes everything.
              </p>
              <p style={{ fontSize: 15, color: "#E5DACB", lineHeight: 1.8, marginBottom: 16 }}>
                The obstacle isn't blocking your progress. It's the raw material for it. Every time you move toward the thing that's hard, you're building the version of yourself that doesn't flinch.
              </p>
              <p style={{ fontSize: 15, color: "#E5DACB", lineHeight: 1.8 }}>
                <strong style={{ color: "#F5EDE3" }}>Today's action:</strong> Name the one thing you've been avoiding this week — not at work, in your actual life. Send the text. Make the appointment. Have the conversation. Do the smallest possible version of it before you go to bed tonight. Momentum compounds.
              </p>
            </div>
          </div>
        </section>

        <SectionDivider />

        {/* ====== THE TAKE ====== */}
        <section ref={(el) => (sectionRefs.current["the-take"] = el)} style={{ margin: "56px 0" }}>
          <SectionLabel>The Take</SectionLabel>
          <div style={{ padding: "32px 0", borderTop: "2px solid rgba(212, 175, 55, 0.25)", borderBottom: "2px solid rgba(212, 175, 55, 0.25)" }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: "#F5EDE3", lineHeight: 1.2, marginBottom: 28, letterSpacing: "-0.025em" }}>
              The Market Has Learned to Ignore the President on Trade
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.9, color: "#E5DACB", marginBottom: 22 }}>
              The 15% tariff announcement dropped Saturday. Crypto crashed 5%. Equities barely moved. Gold surged. The divergence tells you everything about where real price discovery is happening and where the market thinks the signal is.
            </p>
            <p style={{ fontSize: 16, lineHeight: 1.9, color: "#E5DACB", marginBottom: 22 }}>
              <strong style={{ color: "#F5EDE3" }}>The market's mental model has shifted.</strong> For most of 2025, every tariff announcement created genuine uncertainty about the effective rate, the duration, and the scope. Businesses couldn't plan. Investors couldn't model. The tariff volatility premium was real. Post-SCOTUS, the market has re-categorized presidential trade announcements from "structural policy" to "noise within a legal constraint."
            </p>
            <p style={{ fontSize: 16, lineHeight: 1.9, color: "#E5DACB", marginBottom: 22 }}>
              <strong style={{ color: "#F5EDE3" }}>The constraint is real and binding.</strong> Section 122 caps at 15% for 150 days. The president can't go higher without Congress. He can't go longer without Congress. And the exclusions — USMCA, energy, minerals, pharma, electronics — mean the effective rate is well below the headline. Yale Budget Lab estimates the effective rate is now lower than the pre-SCOTUS 16%. The market internalized this in hours.
            </p>
            <p style={{ fontSize: 16, lineHeight: 1.9, color: "#E5DACB", marginBottom: 22 }}>
              <strong style={{ color: "#F5EDE3" }}>What Waller's speech confirmed today.</strong> The Fed isn't recalibrating for tariffs either. Waller explicitly said he "looks through" tariff effects on inflation — both on the way up and on the way down. The SCOTUS ruling doesn't change his calculus. Labor data is what drives the March 17-18 decision. The Fed has joined the market in treating trade policy as transitory noise.
            </p>
            <p style={{ fontSize: 16, lineHeight: 1.9, color: "#E5DACB", marginBottom: 22 }}>
              <strong style={{ color: "#F5EDE3" }}>The second-order implication nobody's discussing:</strong> If the market stops responding to tariff announcements, the president loses his primary economic leverage tool. Tariffs worked as policy because they moved markets. Markets that don't move in response to tariffs can't be used as coercion. This is a structural reduction in executive economic power that goes beyond the legal constraint.
            </p>
            <p style={{ fontSize: 16, lineHeight: 1.9, color: "#E5DACB", marginBottom: 22 }}>
              <strong style={{ color: "#F5EDE3" }}>The contrarian risk:</strong> Congress hands the president new trade authority. A 60-vote Senate threshold makes this unlikely in the current environment, but the political dynamics could shift after a recession or security crisis. Don't price it at zero.
            </p>
            <p style={{ fontSize: 16, lineHeight: 1.9, color: "#E5DACB" }}>
              <strong style={{ color: "#F5EDE3" }}>The honest framework:</strong> The era of trade-by-tweet is over. The era of trade-by-legislation hasn't started yet. We're in a gap where the effective tariff rate is known, bounded, and temporary. That's the most favorable trade policy environment since early 2025. The market knows it. The question is whether Congress fills the gap before the 150-day clock expires in July.
            </p>
          </div>
        </section>

        <SectionDivider />

        {/* ====== BIG STORIES ====== */}
        <section ref={(el) => (sectionRefs.current["big-stories"] = el)} style={{ margin: "56px 0" }}>
          <SectionLabel subtitle="— The macro trends that matter through the daily noise. Updated when news moves the needle. Silent when it doesn't.">Big Stories</SectionLabel>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {[
              { num: 1, title: "Iran — Deal or War, Thursday Is the Test", status: "elevated",
                state: `Third round of talks confirmed for Thursday in Geneva. Omani mediator positive. Iran's Araghchi says "good chance" for diplomacy. Pezeshkian voices cautious optimism but says Tehran is "prepared for any scenario." US military buildup is largest in the Middle East in decades. Trump's 10-15 day deadline from Feb 19 is approaching.`,
                update: `Key development — Iran is bringing a draft proposal to Thursday's talks. This is the first time a written proposal enters the discussion. If the US sees it as a serious starting point, the diplomatic window extends. If not, the military option activates within days. Brent at $71 prices diplomacy. Witkoff's "capitulated" language suggests US patience is thin. Anti-government protests resuming in Iran add domestic pressure on Tehran.` },
              { num: 2, title: "Tariff Regime — SCOTUS Aftermath", status: "developing",
                state: `Trump raised to 15% — the Section 122 maximum. Market shrugged. EU, India, South Korea, UK all reassessing trade deals. 150-day clock expires ~July 20. Effective rate now below pre-SCOTUS 16% due to broad exclusions. $133-175B in potential refunds — Bessent deferred to lower courts, could take "weeks or months."`,
                stateNote: `UPDATED from "Executive Authority Under Legal Siege"`,
                update: `This is now the defining trade story. Markets have stopped reacting to presidential tariff announcements. The constraint is legal, mathematical, and temporal. Next test: EU Parliament trade committee vote Tuesday. Congressional dynamics around new trade authority become the variable to watch.` },
              { num: 3, title: "Crypto Bear Market — Deepening", status: "accelerating",
                state: `BTC crashed to ~$64,200 overnight, now ~$65-66K. Down 49% from October ATH. ETF outflows $3.8B in five weeks. Fear & Greed at historic lows. "Bitcoin to zero" US searches at all-time high.`,
                update: `The 15% tariff crash confirmed that crypto isn't decoupled from macro — it's the most sensitive overnight risk barometer. $61M whale liquidated. BTC OI at $19.5B vs $38.3B peak. Leverage purge continues. Vitalik selling ETH. The capitulation indicators are screaming bottom, but the drawdown duration (139 days without relief rally) is unprecedented. Strategy's $76K average cost basis getting uncomfortable. 200W MA at ~$42K remains the cycle floor.` },
              { num: 4, title: "Gold Regime Change — Accelerating", status: "accelerating",
                state: `Gold above $5,100. Silver surging to $87 (+6% today). Goldman reiterated $5,400 year-end target. Gold/DXY decoupling sustained and intensifying.`,
                update: `Tariff chaos + Iran risk + crypto crash = gold's perfect storm. Silver outperforming gold is a new signal — the gold/silver ratio compressing from elevated levels as both monetary and industrial demand converge. Silver Institute: 6th consecutive structural deficit year in 2026. Central bank re-accumulation confirmed by Goldman. The gold trade is becoming a silver trade too.` },
              { num: 5, title: "The Fed's Impossible Position", status: "developing",
                state: `Rates 3.50-3.75%. Core PCE 3.0%. Waller dissented wanting a cut in January. Markets pricing ~62bp cuts. Warsh takes chair in May.`,
                update: `Waller's NABE speech was a masterclass in hedging. He'll hold if labor firms. He'll cut if it weakens. He's "looking through" tariffs — SCOTUS ruling doesn't change his view. March FOMC (March 17-18) hinges on February labor report (March 6) and CPI (March 11). The two-sided risk thesis is playing out exactly as tracked.` },
              { num: 6, title: "AI Capex Cycle — NVIDIA Earnings Week", status: "elevated",
                state: `$660-690B across hyperscalers in 2026. Meta, Alphabet, Amazon capex guides all dramatically above consensus. NVIDIA reports Wednesday.`,
                update: `This is the single most important week for the AI investment narrative in 2026 so far. $65.6B revenue consensus, but Goldman expects $67B+. If NVIDIA beats and guides up, the AI capex fatigue narrative dies. If margins slip or China guidance disappoints, the correction in AI-adjacent names deepens. Blackwell ramp and FY2027 guidance are the variables.` },
              { num: 7, title: "DHS Shutdown / Government Dysfunction", status: "developing",
                state: `Week 2. Congress returns today. Global Entry suspended. TSA PreCheck confusion. 260K employees working without pay. Democrats demanding ICE reforms after Pretti shooting; Republicans refusing.`,
                update: `No deal expected before SOTU tomorrow. GOP believes shutdown lasts through the address — they think Democrats are using it as political theater. TSA workers miss first full paycheck March 14. The shutdown is now the political backdrop for SOTU and the tariff debate simultaneously.` },
              { num: 8, title: "Political Violence Trend", status: "new",
                state: `Armed man shot at Mar-a-Lago overnight. Third incident targeting political figures in 5 days (Capitol breach, Mar-a-Lago, plus Charlie Kirk assassination, Minnesota lawmakers, Shapiro residence arson in the past year). Capitol Police investigated 14,938 cases last year vs 9,474 in 2024.`,
                stateNote: "NEW",
                update: `Story added. The escalation pattern is impossible to ignore. SOTU tomorrow with 15+ Democratic boycotts. Security concerns are real and growing. The political temperature around immigration enforcement (the DHS shutdown catalyst was CBP killing two US citizens) is producing cascading effects.` },
            ].map((story) => (
              <div key={story.num} style={{ padding: "20px 24px", backgroundColor: "rgba(61, 40, 21, 0.35)", borderRadius: 12, border: "1px solid rgba(212, 175, 55, 0.08)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(212, 175, 55, 0.4)" }}>{story.num}.</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#F5EDE3", lineHeight: 1.3 }}>{story.title}</span>
                  </div>
                  <StatusBadge status={story.status} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#D4AF37", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Current state{story.stateNote ? ` (${story.stateNote})` : ""}:
                  </span>
                  <span style={{ fontSize: 14, color: "#C4B5A0", lineHeight: 1.7, marginLeft: 6 }}>{story.state}</span>
                </div>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#D4AF37", textTransform: "uppercase", letterSpacing: "0.06em" }}>Today's update:</span>
                  <span style={{ fontSize: 14, color: "#C4B5A0", lineHeight: 1.7, marginLeft: 6 }}>{story.update}</span>
                </div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 13, color: "#94a3b8", fontStyle: "italic", lineHeight: 1.6, marginTop: 20 }}>
            Remaining Big Stories — no change today: SaaS Repricing (#2), Humanoid Robotics (#8), Crypto Regulatory Clarity (#9), India Energy Realignment (#10), US-China Tech Decoupling (#12), Nuclear Renaissance (#13), Strategy BTC Treasury Risk (#14), Silver Supply Deficit (#15), AI Model Architecture Shift (#16), Japan Monetary Policy (#17), European Defense Spending (#18), US Fiscal Trajectory (#19), Global Dollar System (#20).
          </p>
        </section>

        <SectionDivider />

        {/* ====== TOMORROW'S HEADLINES ====== */}
        <section ref={(el) => (sectionRefs.current["tomorrows-headlines"] = el)} style={{ margin: "56px 0" }}>
          <SectionLabel subtitle="— What the market will be talking about in 12-18 months.">Tomorrow's Headlines</SectionLabel>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ padding: "20px 24px", backgroundColor: "rgba(61, 40, 21, 0.3)", borderRadius: 12, border: "1px solid rgba(96, 165, 250, 0.08)" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#F5EDE3", marginBottom: 10 }}>Agent Commerce Creates a New Payment Layer</div>
              <div style={{ fontSize: 14, color: "#C4B5A0", lineHeight: 1.75 }}>
                <strong style={{ color: "#60a5fa" }}>New evidence today:</strong> BTC's 5% crash on a Sunday while equities were closed demonstrates exactly why machine-speed commerce can't settle on legacy rails. When AI agents need to execute transactions 24/7, the system that's live at 1:30am Sunday handles the flow — for better or worse. The Stripe vs Solana question (centralized vs decentralized settlement) is becoming urgent, not theoretical.
              </div>
            </div>
            <div style={{ padding: "20px 24px", backgroundColor: "rgba(61, 40, 21, 0.3)", borderRadius: 12, border: "1px solid rgba(96, 165, 250, 0.08)" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#F5EDE3", marginBottom: 10 }}>The Stablecoin Economy</div>
              <div style={{ fontSize: 14, color: "#C4B5A0", lineHeight: 1.75 }}>
                <strong style={{ color: "#60a5fa" }}>New evidence today:</strong> ProShares' stablecoin-ready ETF debuted to $17B, sparking speculation about institutional stablecoin flows. If GENIUS Act implementation proceeds on schedule (Jan 2027), the infrastructure for bank-issued stablecoins is being built now. The ETF debut suggests institutional demand is ahead of the regulatory timeline.
              </div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: "#94a3b8", fontStyle: "italic", marginTop: 16 }}>Full reference list (20 items) unchanged — see Worldview document.</p>
        </section>

        <SectionDivider />

        {/* ====== WATCHLIST ====== */}
        <section ref={(el) => (sectionRefs.current["watchlist"] = el)} style={{ margin: "56px 0" }}>
          <SectionLabel subtitle="— Regime-changing 2-10x opportunities. Small bets, big asymmetry. Most will be wrong.">Watchlist</SectionLabel>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* ETN */}
            <div style={{ padding: "20px 24px", backgroundColor: "rgba(61, 40, 21, 0.45)", borderRadius: 12, border: "1px solid rgba(212, 175, 55, 0.1)" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#D4AF37", fontFamily: "'SF Mono', 'Fira Code', monospace", marginBottom: 4 }}>ETN <span style={{ fontSize: 14, fontWeight: 500, color: "#94a3b8", fontFamily: "inherit" }}>— Software company disguised as an industrial</span></div>
              <p style={{ fontSize: 14, color: "#C4B5A0", lineHeight: 1.7, marginBottom: 10 }}>~$380. Data center orders +200%. Electrical backlog $15.3B.</p>
              <p style={{ fontSize: 14, color: "#C4B5A0", lineHeight: 1.7, marginBottom: 8 }}><strong style={{ color: "#F5EDE3" }}>The insight:</strong> Every data center needs recurring power management software that isn't broken out. Re-rates from "industrial 29x" to "hybrid 35x+." If the AI-energy convergence plays out, 3-5x over 3-5 years.</p>
              <p style={{ fontSize: 13, color: "#4ade80", lineHeight: 1.6, marginBottom: 4 }}><strong>Upside:</strong> Software reclassification at 35x = $560 (47%). AI energy narrative = $700+ (80%+).</p>
              <p style={{ fontSize: 13, color: "#f87171", lineHeight: 1.6, marginBottom: 4 }}><strong>Downside:</strong> Buildout slows, range-bound (~10%).</p>
              <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, marginBottom: 4 }}><strong style={{ color: "#4ade80" }}>Validates:</strong> Software-attached revenue reported. Data center &gt;25% of revenue.</p>
              <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}><strong style={{ color: "#f87171" }}>Rejects:</strong> Margins flat. No software breakout through 2027.</p>
            </div>

            {/* SOL */}
            <div style={{ padding: "20px 24px", backgroundColor: "rgba(61, 40, 21, 0.45)", borderRadius: 12, border: "1px solid rgba(212, 175, 55, 0.1)" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#D4AF37", fontFamily: "'SF Mono', 'Fira Code', monospace", marginBottom: 4 }}>SOL <span style={{ fontSize: 14, fontWeight: 500, color: "#94a3b8", fontFamily: "inherit" }}>— Agent payment rails</span></div>
              <p style={{ fontSize: 14, color: "#C4B5A0", lineHeight: 1.7, marginBottom: 10 }}>~$80, down 76% from ATH.</p>
              <p style={{ fontSize: 14, color: "#C4B5A0", lineHeight: 1.7, marginBottom: 8 }}><strong style={{ color: "#F5EDE3" }}>The insight:</strong> AI agents need micropayments at machine speed. Banks can't clear $0.001. Solana can. Leading all chains in payment volume during a bear. Staking ETFs creating institutional floor. Nobody models machine transaction volume.</p>
              <p style={{ fontSize: 13, color: "#4ade80", lineHeight: 1.6, marginBottom: 4 }}><strong>Upside:</strong> Agent commerce + cycle recovery = $200-300 (2.5-3.5x). Machine commerce real = $500+ (6x).</p>
              <p style={{ fontSize: 13, color: "#f87171", lineHeight: 1.6, marginBottom: 4 }}><strong>Downside:</strong> Agents use Stripe. SOL to $40 (~50%).</p>
              <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, marginBottom: 4 }}><strong style={{ color: "#4ade80" }}>Validates:</strong> Agent tx volume on Solana. x402 &gt;$1B cumulative. ETF inflow trend persists.</p>
              <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, marginBottom: 10 }}><strong style={{ color: "#f87171" }}>Rejects:</strong> Agent commerce centralizes. Reliability issues.</p>
              <p style={{ fontSize: 13, color: "#D4AF37", fontStyle: "italic", lineHeight: 1.6 }}><em>Feb 23 note:</em> SOL dropped 4.5% with broader crypto on the tariff crash. The bear case: every risk-off event hits SOL harder than BTC. The bull case: the price is where you want to be buying a 6x opportunity, not a 2x one.</p>
            </div>

            {/* Harmonic Drive */}
            <div style={{ padding: "20px 24px", backgroundColor: "rgba(61, 40, 21, 0.45)", borderRadius: 12, border: "1px solid rgba(212, 175, 55, 0.1)" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#D4AF37", fontFamily: "'SF Mono', 'Fira Code', monospace", marginBottom: 4 }}>6324.T <span style={{ fontSize: 14, fontWeight: 500, color: "#94a3b8", fontFamily: "inherit" }}>— Harmonic Drive — Humanoid picks-and-shovels</span></div>
              <p style={{ fontSize: 14, color: "#C4B5A0", lineHeight: 1.7, marginBottom: 10 }}>~¥3,800.</p>
              <p style={{ fontSize: 14, color: "#C4B5A0", lineHeight: 1.7, marginBottom: 8 }}><strong style={{ color: "#F5EDE3" }}>The insight:</strong> Every humanoid platform needs the same precision actuators. Near-monopoly on strain wave gears, minimal Western coverage. Wins regardless of which platform wins.</p>
              <p style={{ fontSize: 13, color: "#4ade80", lineHeight: 1.6, marginBottom: 4 }}><strong>Upside:</strong> 500K units/yr by 2028, 20-40 actuators each. Revenue triples = 3x+.</p>
              <p style={{ fontSize: 13, color: "#f87171", lineHeight: 1.6, marginBottom: 4 }}><strong>Downside:</strong> Timeline slips. Chinese competitors. 30-50% down.</p>
              <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, marginBottom: 4 }}><strong style={{ color: "#4ade80" }}>Validates:</strong> Tesla ships externally. Humanoid OEM backlog growth.</p>
              <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}><strong style={{ color: "#f87171" }}>Rejects:</strong> Production &lt;10K in 2026.</p>
            </div>

            {/* Gulf Sovereign AI */}
            <div style={{ padding: "20px 24px", backgroundColor: "rgba(61, 40, 21, 0.45)", borderRadius: 12, border: "1px solid rgba(212, 175, 55, 0.1)" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#D4AF37", fontFamily: "'SF Mono', 'Fira Code', monospace", marginBottom: 4 }}>Gulf Sovereign AI <span style={{ fontSize: 14, fontWeight: 500, color: "#94a3b8", fontFamily: "inherit" }}>— Thematic, watching for vehicle</span></div>
              <p style={{ fontSize: 14, color: "#C4B5A0", lineHeight: 1.7, marginBottom: 8 }}><strong style={{ color: "#F5EDE3" }}>The insight:</strong> Gulf running oil playbook with compute. Cheapest energy, 3.5B people need AI outside US/China. 95% of AI allocation is US tech. UAE at 14x vs S&P 21x.</p>
              <p style={{ fontSize: 13, color: "#4ade80", lineHeight: 1.6, marginBottom: 4 }}><strong>Upside:</strong> G42 IPO creates investable category. 30%+ broad.</p>
              <p style={{ fontSize: 13, color: "#f87171", lineHeight: 1.6, marginBottom: 4 }}><strong>Downside:</strong> Captured by hyperscalers. 10-15%.</p>
              <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, marginBottom: 4 }}><strong style={{ color: "#4ade80" }}>Validates:</strong> G42 IPO. Sovereign AI deals bypass AWS/Azure.</p>
              <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}><strong style={{ color: "#f87171" }}>Rejects:</strong> Hyperscalers go direct. No differentiated tech.</p>
            </div>
          </div>
        </section>

        <SectionDivider />

        {/* ====== DISCOVERY ====== */}
        <section ref={(el) => (sectionRefs.current["discovery"] = el)} style={{ margin: "56px 0" }}>
          <SectionLabel>Discovery</SectionLabel>
          <div style={{ padding: "24px 28px", backgroundColor: "rgba(212, 175, 55, 0.04)", borderRadius: 12, borderLeft: "3px solid #D4AF37" }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#F5EDE3", marginBottom: 12, lineHeight: 1.3 }}>
              Silver's Industrial Demand Is an AI Story Now
            </div>
            <p style={{ fontSize: 15, color: "#E5DACB", lineHeight: 1.8 }}>
              The Silver Institute projects a 67-million-ounce supply deficit in 2026 — the sixth consecutive year. The narrative has been solar panels. The emerging story is AI data centers and advanced semiconductors. Every GPU needs silver in its interconnects. Every data center needs silver in its power systems. The AI infrastructure buildout is creating a new demand channel that isn't in any commodity model. When AI infrastructure people and precious metals people start quoting the same supply chains, pay attention.
            </p>
          </div>
        </section>

        <SectionDivider />

        {/* ====== WORLDVIEW UPDATES ====== */}
        <section ref={(el) => (sectionRefs.current["worldview"] = el)} style={{ margin: "56px 0 0" }}>
          <SectionLabel>Worldview Updates</SectionLabel>
          <p style={{ fontSize: 14, color: "#94a3b8", marginBottom: 20, fontStyle: "italic" }}>Proposed changes based on today's brief:</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { num: 1, text: `**Big Stories reorganized.** "Executive Authority Under Legal Siege" renamed to "Tariff Regime — SCOTUS Aftermath" and refocused on trade specifically. The broader executive authority constraint remains valid but the market-relevant story is now the 150-day Section 122 clock and the diplomatic fallout.` },
              { num: 2, text: `**New Big Story: Political Violence Trend.** Mar-a-Lago, Capitol breach, and the accelerating pattern of political violence warrant tracking. Connects to DHS shutdown (CBP killing sparked the standoff) and SOTU security.` },
              { num: 3, text: `**Thesis #2 note (Fed two-sided risk):** Waller's NABE speech confirmed the framework. He's looking through tariffs, data-dependent on labor. March FOMC hinges on Feb labor (March 6) + CPI (March 11). No confidence change — still High.` },
              { num: 4, text: `**Crypto Bear Market: update current state.** BTC to ~$65K. 49% from ATH. 139 days without relief rally — unprecedented. Fear indicators at historic extremes.` },
              { num: 5, text: `**Gold regime: update price.** Gold above $5,100. Silver surging to $87. Gold/silver ratio compressing. Goldman $5,400 target reiterated.` },
              { num: 6, text: `**Framework addition: "Market Tariff Desensitization."** Markets no longer respond to presidential tariff announcements within the Section 122 constraint. The structural reduction in executive economic leverage is a new dynamic. Tariff volatility premium has collapsed. This framework applies until Congress grants new authority or the 150-day clock forces action.` },
            ].map((item) => (
              <div key={item.num} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#D4AF37", minWidth: 20 }}>{item.num}.</span>
                <div style={{ fontSize: 14, color: "#C4B5A0", lineHeight: 1.7 }}>
                  <RichText text={item.text} style={{ fontSize: 14, color: "#C4B5A0", lineHeight: 1.7 }} />
                </div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 13, color: "#94a3b8", fontStyle: "italic", marginTop: 20 }}>
            Source check: Any sources to add or remove? Any new voices, dashboards, or feeds that surfaced today that should join the list?
          </p>
        </section>

        <SectionDivider />

        {/* ====== FULL REFERENCE: BIG STORIES ====== */}
        <section ref={(el) => (sectionRefs.current["ref-big-stories"] = el)} style={{ margin: "56px 0" }}>
          <SectionLabel subtitle="Complete tracking corpus. Updated states reflect today's brief where applicable.">Full Reference: Big Stories</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { num: 1, title: "Iran — Deal or War", text: "Third round of talks confirmed for Thursday in Geneva. Iran bringing draft proposal. US military buildup largest since 2003. Trump's 10-15 day deadline approaching. Brent at $71 prices diplomacy. If strikes: $85-90. If Hormuz: $100+.", date: "Updated Feb 23." },
              { num: 2, title: "SaaS Repricing — Phase 2 of AI Disruption", text: "Software ETFs down 17-23% YTD. $1T+ wiped. Sell-off indiscriminate. CrowdStrike/Cloudflare -8% into broad rally was new signal. Watch Q1 enterprise renewal data (March/April).", date: "Last updated Feb 21." },
              { num: 3, title: "Crypto Bear Market — Cycle or Regime Break?", text: "BTC ~$65K, down 49% from ATH. 139 days without meaningful relief rally — unprecedented. ETF outflows $3.8B in five weeks. Fear indicators at historic extremes. SOL ETFs only category with net inflows in February. Strategy sitting on unrealized loss at $76K avg cost. 200W MA at ~$42K = last cycle floor.", date: "Updated Feb 23." },
              { num: 4, title: "Gold Regime Change — Reserve Diversification", text: "Gold above $5,100. Silver surging to $87. PBoC buying 15 consecutive months. Gold/DXY decoupling sustained. Goldman reiterated $5,400 year-end target. Silver Institute: 6th consecutive structural deficit. Gold/silver ratio compressing.", date: "Updated Feb 23." },
              { num: 5, title: "The Fed's Impossible Position", text: "Rates 3.50-3.75%. Core PCE 3.0%. Waller dissented in January wanting a cut. NABE speech today: looking through tariffs, data-dependent on labor. March FOMC (March 17-18) hinges on Feb labor (March 6) + CPI (March 11). Warsh takes chair May.", date: "Updated Feb 23." },
              { num: 6, title: 'Tariff Regime — SCOTUS Aftermath (renamed from "Executive Authority Under Legal Siege")', text: "Trump raised to 15% — Section 122 maximum. Market shrugged. Effective rate below pre-SCOTUS 16% due to broad exclusions. 150-day clock expires ~July 20. $133-175B in potential refunds — Bessent deferred to lower courts. EU, India, South Korea, UK reassessing trade deals. Markets have stopped reacting to presidential tariff announcements.", date: "Updated Feb 23." },
              { num: 7, title: "AI Capex Cycle — NVIDIA Earnings Week", text: "$660-690B across hyperscalers in 2026. Meta $115-135B, Alphabet $175-185B, Amazon $200B — all above consensus. NVIDIA reports Wednesday. $65.6B revenue consensus. Blackwell ramp, Rubin visibility, China sales, FY2027 guidance are the variables.", date: "Updated Feb 23." },
              { num: 8, title: "Humanoid Robotics Industrialization", text: "Tesla Gen 3 mass production Jan 2026. Figure at BMW. 1X at $20K consumer. Target 100K+ units 2026. Component supply chain doesn't exist at scale. Watching GTC March 16 for physical AI signals.", date: "Last updated Feb 20." },
              { num: 9, title: "Crypto Regulatory Clarity Era", text: "GENIUS Act regs due July 18. CLARITY Act pushing for Senate vote before midterms. FDIC approved bank stablecoin issuance. Grayscale AAVE ETF filed. SEC + CFTC building joint token taxonomy. Binary: bills pass before midterms or they don't.", date: "Last updated Feb 20." },
              { num: 10, title: "India Energy Realignment", text: "India's potential pivot away from Russian oil (1.8M bpd) linked to US trade deal. Unconfirmed. India-US trade talks paused post-SCOTUS. If real, biggest energy flow realignment in decades.", date: "Last updated Feb 20." },
              { num: 11, title: "DHS Shutdown / Government Dysfunction", text: "Week 2. Congress returns today. Global Entry suspended. TSA PreCheck reversal caused confusion. No deal expected before SOTU tomorrow. TSA workers miss first full paycheck March 14. Democrats demanding ICE reforms; Republicans refusing.", date: "Updated Feb 23." },
              { num: 12, title: "US-China Tech Decoupling", text: "Export controls tightening. Two separate AI ecosystems forming. NVIDIA designing China-specific chips at reduced capability. China reopened access to H200 chips for select companies. Long-term: bifurcated global tech stack.", date: "Last updated Feb 22." },
              { num: 13, title: "Nuclear Renaissance / Energy Infrastructure", text: "AI power demand driving nuclear restart conversations. Oklo, Cameco gaining attention. Grid investment rising but permitting timelines measured in years, not months.", date: "Last updated Feb 22." },
              { num: 14, title: "Strategy (MSTR) Bitcoin Treasury Risk", text: "Holding 717K BTC at $76K avg cost basis. Unrealized loss deepening as BTC drops to ~$65K. Forced selling risk escalates below $50K. Convertible debt structure creates nonlinear downside.", date: "Last updated Feb 22." },
              { num: 15, title: "Silver Supply Deficit", text: "6th consecutive year of structural deficit projected for 2026 (67M oz shortfall). Industrial demand growing — solar, electronics, AI data centers, semiconductors. Mine supply flat. Gold/silver ratio compressing from elevated levels.", date: "Updated Feb 23." },
              { num: 16, title: "AI Model Architecture Shift", text: "Training paradigm showing diminishing returns. Sutskever left OpenAI, LeCun left Meta for world model lab. Inference-time compute emerging as new frontier. If architecture shifts, different hardware wins.", date: "Last updated Feb 22." },
              { num: 17, title: "Japan Monetary Policy Normalization", text: "BOJ exiting zero interest rate policy. Japan is largest foreign holder of US Treasuries. Rate normalization risks carry trade unwind. Yen strengthening pressures US bond market.", date: "Last updated Feb 22." },
              { num: 18, title: "European Defense Spending Surge", text: "Post-Ukraine security environment driving NATO budgets higher. Fiscal pressure on already-stretched European sovereigns. Industrial capacity constraints limit speed of rearmament.", date: "Last updated Feb 22." },
              { num: 19, title: "US Fiscal Trajectory", text: "$36T+ debt. Interest payments exceeding defense spending. Structural pressure on Fed independence as fiscal dominance dynamics intensify. Lyn Alden's \"gradual print\" framework.", date: "Last updated Feb 22." },
              { num: 20, title: "Global Dollar System Under Stress", text: "Central bank gold buying as dollar diversification proxy. PBoC, RBI, and emerging market central banks reducing Treasury holdings in favor of gold. Generational trend, not a trade.", date: "Last updated Feb 22." },
              { num: 21, title: "Political Violence Trend (NEW)", text: "Mar-a-Lago breach (Feb 23), Capitol breach (Feb 18), Charlie Kirk assassination, Minnesota lawmakers killed, Shapiro residence arson. Capitol Police investigated 14,938 cases in 2025 vs 9,474 in 2024. Pattern accelerating. SOTU security concerns elevated.", date: "Added Feb 23." },
            ].map((item) => (
              <div key={item.num} style={{ padding: "16px 20px", backgroundColor: "rgba(61, 40, 21, 0.35)", borderRadius: 10, border: "1px solid rgba(212, 175, 55, 0.08)" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#D4AF37", fontFamily: "'SF Mono', 'Fira Code', monospace" }}>{item.num}.</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#F5EDE3" }}>{item.title}</span>
                </div>
                <p style={{ fontSize: 14, color: "#C4B5A0", lineHeight: 1.7, marginBottom: 6 }}>{item.text}</p>
                <p style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>{item.date}</p>
              </div>
            ))}
          </div>
        </section>

        <SectionDivider />

        {/* ====== FULL REFERENCE: TOMORROW'S HEADLINES ====== */}
        <section ref={(el) => (sectionRefs.current["ref-tomorrows"] = el)} style={{ margin: "56px 0 0" }}>
          <SectionLabel subtitle="What the market will be talking about in 12-18 months. Updated when new evidence surfaces.">Full Reference: Tomorrow's Headlines</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { num: 1, title: "AI Infrastructure Becomes an Energy Story", text: '"Who has the power" > "who has the chips." Nuclear renaissance, grid infrastructure, energy-sovereign AI.' },
              { num: 2, title: "Agent Commerce Creates a New Payment Layer", text: "x402, Coinbase Wallets, Lightspark. Machine-speed settlement layer that doesn't exist yet.", evidence: "New evidence Feb 23: BTC's Sunday crash demonstrates why 24/7 settlement matters for machine commerce." },
              { num: 3, title: "Phase 3: Professional Services After SaaS", text: "$1.2T globally. Pure labor arbitrage. Same agents replacing software seats replace the humans implementing that software." },
              { num: 4, title: "Quantum Crosses the Usefulness Threshold", text: "IBM + Microsoft converging. First commercial quantum application within 18 months." },
              { num: 5, title: "Sovereign Compute as Geopolitical Strategy", text: "Gulf positioning first. Compute as strategic resource like oil. India and Brazil next." },
              { num: 6, title: "The Memory Wall", text: "HBM4 supply-constrained. SK Hynix/Samsung bottleneck. AI SSDs emerging. The constraint keeps shifting downstream." },
              { num: 7, title: "Neuromorphic Computing as Alternative Architecture", text: "Inference energy economics could be transformative. Can't do training, but inference is the fastest-growing workload." },
              { num: 8, title: "The Stablecoin Economy", text: "GENIUS Act Jan 2027. Banks can issue. Protocols can settle. Stablecoin supply may rival M1 in emerging markets.", evidence: "New evidence Feb 23: ProShares stablecoin-ready ETF debuted to $17B." },
              { num: 9, title: "AI-Native vs AI-Augmented Incumbents", text: "Built-on-AI companies have structural cost advantages over bolt-on-AI incumbents. The gap widens as models improve." },
              { num: 10, title: "Open Source AI vs Closed Model Economics", text: "If open-source reaches parity, value shifts to application layer and data moats." },
              { num: 11, title: "Edge AI / On-Device Intelligence", text: "Privacy, latency, cost advantages. Bends cloud compute demand curve." },
              { num: 12, title: "Robotics-as-a-Service", text: "Pay-per-task robot labor. $15/hr equivalent vs $25/hr human. First contracts 2026-2027." },
              { num: 13, title: "Synthetic Biology Industrialization", text: "Biology as manufacturing platform. AI + protein design accelerating timeline." },
              { num: 14, title: "Carbon Credit Markets Maturation", text: "Voluntary + compliance converging. Blockchain verification. Microsoft/Google backstopping demand." },
              { num: 15, title: "Digital Identity Infrastructure", text: "Proof of humanity becomes real need. Deepfakes + AI agents driving urgency." },
              { num: 16, title: "Longevity Science Crossing Clinical Thresholds", text: "GLP-1 mortality data. CRISPR approved. First anti-aging drug Phase 3 trials." },
              { num: 17, title: "Water Scarcity as Investable Theme", text: "Desalination improving. Agricultural efficiency critical. Moving from ESG niche to core infra." },
              { num: 18, title: "Space Economy Commercialization", text: "Starship 10x cost reduction. $469B → $1T+ by 2030. Under-allocated institutionally." },
              { num: 19, title: "DeFi Insurance / Risk Markets", text: "On-chain risk transfer. $6T traditional insurance market. 1% capture = $60B." },
              { num: 20, title: "The Great Retraining", text: "AI displacing white-collar faster than blue-collar. Political economy of displacement by 2027." },
            ].map((item) => (
              <div key={item.num} style={{ padding: "14px 20px", backgroundColor: "rgba(61, 40, 21, 0.3)", borderRadius: 10, border: "1px solid rgba(212, 175, 55, 0.06)" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#D4AF37", fontFamily: "'SF Mono', 'Fira Code', monospace" }}>{item.num}.</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#F5EDE3" }}>{item.title}</span>
                </div>
                <p style={{ fontSize: 14, color: "#C4B5A0", lineHeight: 1.7, marginBottom: item.evidence ? 6 : 0 }}>{item.text}</p>
                {item.evidence && <p style={{ fontSize: 13, color: "#a855f7", fontStyle: "italic", lineHeight: 1.6 }}>{item.evidence}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <div style={{ marginTop: 64, paddingTop: 24, borderTop: "1px solid rgba(212, 175, 55, 0.1)", textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "rgba(148, 163, 184, 0.4)" }}>Mental Models Observatory — Daily Update</div>
        </div>
      </div>
    </div>
  );
}