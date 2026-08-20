import { ArrowRight } from "lucide-react";

const tickets = [
  { id: "TCK-2026-63219", title: "POS system login issue", status: "Open", pct: 25, color: "bg-secondary" },
  { id: "TCK-2026-99469", title: "Orbit app crash", status: "In Progress", pct: 44, color: "bg-primary" },
  { id: "TCK-2026-56123", title: "Printer not found", status: "In Progress", pct: 40, color: "bg-primary" },
  { id: "TCK-2026-88121", title: "Receipt not printing", status: "Open", pct: 15, color: "bg-secondary" },
  { id: "TCK-2026-33221", title: "Stock sync error", status: "Resolved", pct: 76, color: "bg-success" },
];

export function LatestTickets() {
  return (
    <div className="rounded-2xl bg-card border border-border p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold">Latest tickets</h3>
        <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          More <ArrowRight className="h-3 w-3" />
        </button>
      </div>
      <ul className="space-y-4">
        {tickets.map((t) => (
          <li key={t.id}>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <div className="min-w-0">
                <div className="font-medium">{t.id}</div>
                <div className="text-xs text-muted-foreground">{t.title}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">{t.status}</div>
                <div className="text-sm font-semibold">{t.pct}%</div>
              </div>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${t.color}`}
                style={{ width: `${t.pct}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}