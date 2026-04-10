export default function DailyUpdateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // BriefViewer handles its own full-bleed backgrounds — no wrapper padding needed.
  return (
    <div>
      {children}
    </div>
  );
}
