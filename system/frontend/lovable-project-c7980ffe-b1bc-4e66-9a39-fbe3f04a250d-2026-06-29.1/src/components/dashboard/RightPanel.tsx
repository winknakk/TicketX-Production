import { Bell, Calendar, FileText, Users } from "lucide-react";

const reminders = [
  { icon: FileText, color: "bg-secondary/20 text-secondary", title: "Follow up tickets", date: "24 Sep 2026, Friday" },
  { icon: Calendar, color: "bg-primary/20 text-primary", title: "Weekly report", date: "25 Sep 2026, Wednesday" },
  { icon: Users, color: "bg-success/20 text-success", title: "Team meeting", date: "27 Sep 2026, Friday" },
];

export function RightPanel() {
  return (
    <aside className="hidden xl:flex w-80 shrink-0 flex-col gap-5 p-6 border-l border-border bg-card/40">
      {/* Profile */}
      <div className="rounded-2xl bg-card border border-border p-5">
        <h3 className="font-semibold text-sm mb-4">My Profile</h3>
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary to-secondary" />
            <span className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-success border-4 border-card" />
          </div>
          <div className="mt-3 font-semibold">Admin User</div>
          <div className="text-xs text-muted-foreground">Support Manager</div>
        </div>
        <div className="mt-5 space-y-3">
          <LangRow label="English" level="Advanced" pct={90} />
          <LangRow label="Thai" level="Native" pct={100} />
        </div>
      </div>

      {/* Reminders */}
      <div className="rounded-2xl bg-card border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm">Reminders</h3>
          <Bell className="h-4 w-4 text-muted-foreground" />
        </div>
        <ul className="space-y-3">
          {reminders.map((r) => {
            const Icon = r.icon;
            return (
              <li key={r.title} className="flex items-center gap-3">
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${r.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{r.title}</div>
                  <div className="text-xs text-muted-foreground">{r.date}</div>
                </div>
              </li>
            );
          })}
        </ul>
        <button className="mt-4 text-xs text-primary hover:underline">View all reminders</button>
      </div>
    </aside>
  );
}

function LangRow({ label, level, pct }: { label: string; level: string; pct: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{level}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}