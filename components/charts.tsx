"use client";

/**
 * Gráficos SVG do Dynamic UI Engine — série única, matiz azul do sistema
 * (--series-1), marcas finas com ponta arredondada, grid recessivo e labels
 * diretos nos pontos relevantes.
 */

const SERIES = "var(--series-1)";
const GRID = "var(--grid)";
const MUTED = "var(--ink-muted)";
const INK = "var(--ink-2)";

export function BarChart({ data, unit }: { data: { label: string; value: number }[]; unit?: string }) {
  if (!data.length) return <p className="text-sm text-[var(--ink-muted)]">Sem dados no período.</p>;
  const max = Math.max(...data.map((d) => d.value), 1);
  const rowH = 34;
  const labelW = 190;
  const valueW = 70;
  const chartW = 560;
  const height = data.length * rowH;
  const fmt = (v: number) => (unit === "R$" ? `R$ ${v.toLocaleString("pt-BR")}` : v.toLocaleString("pt-BR"));

  return (
    <svg viewBox={`0 0 ${chartW} ${height}`} className="w-full" role="img" aria-label="Gráfico de barras">
      {data.map((d, i) => {
        const w = Math.max(((chartW - labelW - valueW) * d.value) / max, 3);
        const y = i * rowH;
        return (
          <g key={d.label}>
            <title>{`${d.label}: ${fmt(d.value)}${unit && unit !== "R$" ? ` ${unit}` : ""}`}</title>
            <text x={labelW - 10} y={y + rowH / 2 + 4} textAnchor="end" fontSize="12.5" fill={INK}>
              {d.label.length > 26 ? d.label.slice(0, 25) + "…" : d.label}
            </text>
            <rect x={labelW} y={y + rowH / 2 - 9} width={w} height={18} rx={4} fill={SERIES} className="hover:opacity-80" />
            <text x={labelW + w + 8} y={y + rowH / 2 + 4} fontSize="12" fill={MUTED}>
              {fmt(d.value)}
            </text>
          </g>
        );
      })}
      <line x1={labelW} y1={0} x2={labelW} y2={height} stroke="var(--axis)" strokeWidth="1" />
    </svg>
  );
}

export function LineChart({ data, unit }: { data: { label: string; value: number }[]; unit?: string }) {
  if (data.length < 2) return <p className="text-sm text-[var(--ink-muted)]">Sem dados suficientes no período.</p>;
  const W = 620;
  const H = 220;
  const pad = { l: 56, r: 16, t: 14, b: 26 };
  const max = Math.max(...data.map((d) => d.value)) * 1.1;
  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / (data.length - 1);
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const path = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const gridLines = [0.25, 0.5, 0.75, 1].map((f) => max * f);
  const fmt = (v: number) =>
    unit === "R$" ? `R$ ${Math.round(v).toLocaleString("pt-BR")}` : Math.round(v).toLocaleString("pt-BR");
  const step = Math.ceil(data.length / 8);
  const peak = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Gráfico de linha">
      {gridLines.map((v) => (
        <g key={v}>
          <line x1={pad.l} y1={y(v)} x2={W - pad.r} y2={y(v)} stroke={GRID} strokeWidth="1" />
          <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill={MUTED}>
            {unit === "R$" ? `${Math.round(v / 1000)}k` : Math.round(v)}
          </text>
        </g>
      ))}
      <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke="var(--axis)" strokeWidth="1" />
      {data.map((d, i) =>
        i % step === 0 ? (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10.5" fill={MUTED}>
            {d.label}
          </text>
        ) : null
      )}
      <path d={path} fill="none" stroke={SERIES} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <circle key={i} cx={x(i)} cy={y(d.value)} r={i === peak ? 4 : 3} fill={SERIES} opacity={i === peak ? 1 : 0}
          className="hover:opacity-100">
          <title>{`${d.label}: ${fmt(d.value)}`}</title>
        </circle>
      ))}
      <text x={x(peak)} y={y(data[peak].value) - 9} textAnchor="middle" fontSize="11.5" fontWeight="600" fill={INK}>
        {fmt(data[peak].value)}
      </text>
    </svg>
  );
}
