import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { ChevronDown } from "lucide-react";

const data = [
  { day: "Mon", open: 12, progress: 8, resolved: 5 },
  { day: "Tue", open: 18, progress: 10, resolved: 7 },
  { day: "Wed", open: 28, progress: 14, resolved: 6 },
  { day: "Thu", open: 16, progress: 12, resolved: 8 },
  { day: "Fri", open: 22, progress: 9, resolved: 10 },
  { day: "Sat", open: 14, progress: 6, resolved: 4 },
  { day: "Sun", open: 10, progress: 4, resolved: 3 },
];

export function TicketsChart() {
  return (
    <div className="rounded-2xl bg-card border border-border p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold">Tickets created (This week)</h3>
        <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          Last week <ChevronDown className="h-3 w-3" />
        </button>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap={18}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.3 }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                fontSize: 12,
              }}
            />
            <Bar dataKey="open" stackId="a" fill="var(--secondary)" radius={[0, 0, 0, 0]} />
            <Bar dataKey="progress" stackId="a" fill="var(--primary)" />
            <Bar dataKey="resolved" stackId="a" fill="var(--success)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-6 mt-4 text-xs text-muted-foreground">
        <Legend color="var(--secondary)" label="Open" />
        <Legend color="var(--primary)" label="In Progress" />
        <Legend color="var(--success)" label="Resolved" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </div>
  );
}