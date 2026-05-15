type SparklineProps = {
  values: number[];
  positive?: boolean;
  className?: string;
};

const Sparkline = ({ values, positive = true, className = '' }: SparklineProps) => {
  if (!values.length) return <div className={`h-12 w-full rounded bg-slate-950 ${className}`} />;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 0.000001);
  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * 100;
    const y = 100 - ((value - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');
  const stroke = positive ? '#22c55e' : '#ef4444';

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={`h-12 w-full ${className}`}>
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};

export default Sparkline;
