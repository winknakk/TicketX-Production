import React from 'react';

interface KPICardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  accentColor: string; // CSS color / gradient string
  trend?: { value: string; up: boolean };
}

export const KPICard: React.FC<KPICardProps> = ({
  label,
  value,
  sub,
  icon,
  accentColor,
  trend,
}) => (
  <div
    className="card p-5 relative overflow-hidden anim-fade-up"
    style={{ borderRadius: 'var(--r-xl)' }}
  >
    {/* Background glow blob */}
    <div
      className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-20 pointer-events-none"
      style={{ background: accentColor }}
    />

    <div className="flex items-start justify-between relative z-10">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-3)' }}>
          {label}
        </p>
        <p className="text-3xl font-black text-white tracking-tight leading-none">{value}</p>
        {sub && (
          <p className="text-[11.5px] font-medium mt-1.5" style={{ color: 'var(--text-3)' }}>
            {sub}
          </p>
        )}
        {trend && (
          <div className="flex items-center gap-1.5 mt-2">
            <span
              className="text-[11px] font-bold flex items-center gap-0.5"
              style={{ color: trend.up ? 'var(--emerald)' : 'var(--rose)' }}
            >
              {trend.up ? '↑' : '↓'} {trend.value}
            </span>
            <span className="text-[10.5px]" style={{ color: 'var(--text-4)' }}>vs last week</span>
          </div>
        )}
      </div>

      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${accentColor}22`, color: accentColor }}
      >
        {icon}
      </div>
    </div>
  </div>
);

interface StatCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  type?: 'default' | 'sparkline' | 'radial';
  percentage?: number;
  isPositive?: boolean;
  trend?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subValue,
  type = 'default',
  percentage = 0,
  isPositive = true,
  trend,
}) => {
  return (
    <div
      className="card p-5 relative overflow-hidden flex flex-col justify-between anim-fade-up"
      style={{ minHeight: '140px', borderRadius: 'var(--r-xl)' }}
    >
      <div>
        <span className="text-[11px] font-bold uppercase tracking-widest block" style={{ color: 'var(--text-3)' }}>
          {title}
        </span>
        <h3 className="text-3xl font-black text-white tracking-tight mt-2">{value}</h3>
      </div>

      <div className="mt-3 flex items-center justify-between">
        {type === 'default' && (
          <div className="flex items-center gap-1.5">
            {trend && (
              <span
                className="text-[11.5px] font-bold flex items-center"
                style={{ color: isPositive ? 'var(--emerald)' : 'var(--rose)' }}
              >
                {isPositive ? '↑' : '↓'} {trend}
              </span>
            )}
            {subValue && (
              <span className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>{subValue}</span>
            )}
          </div>
        )}

        {type === 'sparkline' && (
          <div className="w-full flex items-center justify-between">
            <div>
              <span className="text-[11.5px] font-bold" style={{ color: 'var(--emerald)' }}>↓ 12%</span>
              <span className="text-[11px] ml-1.5" style={{ color: 'var(--text-3)' }}>vs last month</span>
            </div>
            <svg className="w-20 h-8 overflow-visible" viewBox="0 0 100 30" fill="none">
              <defs>
                <linearGradient id="sg1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0,25 C15,22 25,12 40,18 C55,24 65,5 80,10 C90,12 100,5 100,5"
                stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M0,25 C15,22 25,12 40,18 C55,24 65,5 80,10 C90,12 100,5 100,5 L100,30 L0,30 Z"
                fill="url(#sg1)" opacity="0.15" />
            </svg>
          </div>
        )}

        {type === 'radial' && (
          <div className="w-full flex items-center justify-between">
            <span className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>{subValue}</span>
            <div className="relative w-12 h-12">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path stroke="var(--border)" strokeWidth="3.5" fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path stroke="url(#ring-grad)" strokeDasharray={`${percentage}, 100`}
                  strokeWidth="3.5" strokeLinecap="round" fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831">
                  <defs>
                    <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="var(--primary)" />
                      <stop offset="100%" stopColor="var(--accent)" />
                    </linearGradient>
                  </defs>
                </path>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-foreground">
                {percentage}%
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
