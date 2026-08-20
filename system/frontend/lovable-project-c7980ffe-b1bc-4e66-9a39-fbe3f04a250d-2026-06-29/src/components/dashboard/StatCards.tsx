import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area } from "recharts";
import { ArrowRight, TrendingDown } from "lucide-react";

const slaData = [{ v: 85 }, { v: 15 }];
const sparkData = [
  { v: 2.8 }, { v: 2.6 }, { v: 2.9 }, { v: 2.4 }, { v: 2.5 }, { v: 2.2 }, { v: 2.4 },
];

export function StatCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {/* Active conversations */}
      <div className="rounded-2xl bg-card border border-border p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-sm">Active conversations</h3>
          <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            More <ArrowRight className="h-3 w-3" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-bold">24</span>
              <span className="text-xs text-muted-foreground">Active AI</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: "70%" }} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-bold">8</span>
              <span className="text-xs text-muted-foreground">Human handled</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-secondary" style={{ width: "30%" }} />
            </div>
          </div>
        </div>
      </div>

      {/* SLA donut */}
      <div className="rounded-2xl bg-card border border-border p-6">
        <h3 className="font-semibold text-sm mb-3">SLA Performance</h3>
        <div className="flex items-center gap-4">
          <div className="relative h-28 w-28 shrink-0">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={slaData}
                  innerRadius={36}
                  outerRadius={50}
                  paddingAngle={2}
                  dataKey="v"
                  startAngle={90}
                  endAngle={-270}
                >
                  <Cell fill="var(--primary)" />
                  <Cell fill="var(--muted)" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center text-lg font-bold">
              85%
            </div>
          </div>
          <div className="text-xs">
            <div className="font-semibold text-success">Good</div>
            <div className="text-muted-foreground mt-1">SLA Target: 90%</div>
          </div>
        </div>
      </div>

      {/* Response time */}
      <div className="rounded-2xl bg-card border border-border p-6">
        <h3 className="font-semibold text-sm mb-3">Response time</h3>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">2.4h</span>
          <span className="text-xs text-muted-foreground">Average</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-success mt-1">
          <TrendingDown className="h-3 w-3" /> 12% faster
        </div>
        <div className="h-16 mt-2 -mx-2">
          <ResponsiveContainer>
            <AreaChart data={sparkData}>
              <defs>
                <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--secondary)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--secondary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke="var(--secondary)" strokeWidth={2} fill="url(#spark)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}