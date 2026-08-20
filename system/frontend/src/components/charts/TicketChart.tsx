import React from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const weekData = [
  { name: 'Mon', Open: 20, InProgress: 15, Resolved: 5 },
  { name: 'Tue', Open: 25, InProgress: 20, Resolved: 10 },
  { name: 'Wed', Open: 18, InProgress: 25, Resolved: 15 },
  { name: 'Thu', Open: 30, InProgress: 18, Resolved: 22 },
  { name: 'Fri', Open: 22, InProgress: 30, Resolved: 25 },
  { name: 'Sat', Open: 10, InProgress: 12, Resolved: 30 },
  { name: 'Sun', Open: 5,  InProgress: 8,  Resolved: 35 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-4 py-3 text-xs shadow-xl"
      style={{
        background: 'var(--bg-3)',
        border: '1px solid var(--border-md)',
        minWidth: 140,
      }}
    >
      <p className="font-bold text-white mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-4 mb-1">
          <span className="flex items-center gap-1.5" style={{ color: 'var(--text-2)' }}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-bold text-white">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export const TicketChart: React.FC = () => (
  <div
    className="card p-6 flex flex-col anim-fade-up delay-100"
    style={{ height: 320, borderRadius: 'var(--r-xl)' }}
  >
    {/* Header */}
    <div className="flex items-start justify-between mb-5 shrink-0">
      <div>
        <h3 className="font-bold text-white text-[14px]">Ticket Volume</h3>
        <p className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--text-3)' }}>
          This week · 7-day breakdown
        </p>
      </div>
      <div className="flex items-center gap-3">
        {[
          { label: 'Open', color: 'var(--destructive)' },
          { label: 'In Progress', color: 'var(--primary)' },
          { label: 'Resolved', color: 'var(--success)' },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: l.color }} />
            <span className="text-[10.5px] font-medium" style={{ color: 'var(--text-3)' }}>
              {l.label}
            </span>
          </div>
        ))}
      </div>
    </div>

    {/* Chart */}
    <div className="flex-1 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={weekData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10.5, fill: 'var(--muted-foreground)', fontWeight: 600 }}
            tickLine={false}
            axisLine={false}
            dy={6}
          />
          <YAxis
            tick={{ fontSize: 10.5, fill: 'var(--muted-foreground)', fontWeight: 600 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--border)', radius: 8 }} />
          <Bar dataKey="Open" stackId="s" fill="var(--destructive)" barSize={14} radius={[0, 0, 0, 0]} />
          <Bar dataKey="InProgress" stackId="s" fill="var(--primary)" barSize={14} radius={[0, 0, 0, 0]} />
          <Bar dataKey="Resolved" stackId="s" fill="var(--success)" barSize={14} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);

/* ─── SLA Performance + Response Time mini charts ─── */
export const SLACard: React.FC<{ percentage: number }> = ({ percentage }) => {
  const circumference = 2 * Math.PI * 38;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="card p-5 flex flex-col anim-fade-up delay-200" style={{ borderRadius: 'var(--r-xl)' }}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
            SLA Performance
          </p>
          <p className="text-2xl font-black text-foreground mt-1">{percentage}%</p>
        </div>
        <span className="badge badge-medium">Target 90%</span>
      </div>

      {/* Large ring */}
      <div className="flex items-center justify-center flex-1 py-2">
        <div className="relative w-28 h-28">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 88 88">
            <circle cx="44" cy="44" r="38" stroke="var(--border)" strokeWidth="8" fill="none" />
            <circle
              cx="44" cy="44" r="38"
              stroke="url(#sla-grad)"
              strokeWidth="8"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 1s ease' }}
            />
            <defs>
              <linearGradient id="sla-grad" x1="1" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" />
                <stop offset="100%" stopColor="var(--accent)" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-black text-foreground">{percentage}%</span>
            <span className="text-[10px] font-semibold" style={{ color: 'var(--text-3)' }}>SLA Met</span>
          </div>
        </div>
      </div>

      <div
        className="mt-3 pt-3 flex justify-between text-[11px] font-semibold"
        style={{ borderTop: '1px solid var(--border)', color: 'var(--text-3)' }}
      >
        <span>Response</span>
        <span className="text-foreground font-bold">2.4 hrs avg</span>
      </div>
    </div>
  );
};

const respData = [
  { h: 1.2 }, { h: 2.1 }, { h: 1.8 }, { h: 3.0 },
  { h: 2.4 }, { h: 1.5 }, { h: 2.8 }, { h: 2.2 }, { h: 1.9 },
];

export const ResponseTimeCard: React.FC = () => (
  <div className="card p-5 anim-fade-up delay-250" style={{ borderRadius: 'var(--r-xl)' }}>
    <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>
      Avg Response Time
    </p>
    <p className="text-3xl font-black text-foreground">2.4<span className="text-base font-semibold ml-1" style={{ color: 'var(--text-3)' }}>hrs</span></p>

    <div className="mt-4 h-16">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={respData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="resp-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="h"
            stroke="var(--primary)"
            strokeWidth={2}
            fill="url(#resp-grad)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>

    <div
      className="mt-3 pt-3 flex justify-between text-[11px] font-semibold"
      style={{ borderTop: '1px solid var(--border)', color: 'var(--text-3)' }}
    >
      <span className="text-emerald-400 font-bold">↓ 12%</span>
      <span>vs last month</span>
    </div>
  </div>
);
