export default function DailyUpdateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The BriefViewer handles its own full-bleed dark background,
  // so we remove the default padding from the parent layout's <main>.
  // We use negative margin to counter the p-4 on <main id="main-content">.
  return (
    <div className="-m-4">
      {children}
    </div>
  );
}
