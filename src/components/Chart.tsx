/** Renders an SVG from the shared chart library with screen colours. Server-safe. */
export default function Chart({ svg, label, maxWidth }: { svg: string; label: string; maxWidth?: number }) {
  return <div className="chart" role="img" aria-label={label} style={{ maxWidth }} dangerouslySetInnerHTML={{ __html: svg }} />;
}
