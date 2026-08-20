import { Link } from "@tanstack/react-router";
import {
  LayoutDashboard,
  MessageSquare,
  Ticket,
  Users,
  BarChart3,
  UserCog,
  Settings,
  Sparkles,
} from "lucide-react";

const nav = [
  { icon: LayoutDashboard, label: "Dashboard", active: true },
  { icon: MessageSquare, label: "Conversations" },
  { icon: Ticket, label: "Tickets" },
  { icon: Users, label: "Customers" },
  { icon: BarChart3, label: "Reports" },
  { icon: UserCog, label: "Agents" },
  { icon: Settings, label: "Settings" },
];

export function Sidebar() {
  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-card border-r border-border p-5">
      <Link to="/" className="flex items-center gap-3 mb-8 px-2">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-primary-foreground">
          AX
        </div>
        <div>
          <div className="font-bold leading-tight">AutomationX</div>
          <div className="text-xs text-muted-foreground">Admin Portal</div>
        </div>
      </Link>

      <nav className="flex flex-col gap-1">
        {nav.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                item.active
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30 p-5 text-center">
        <div className="mx-auto mb-3 h-10 w-10 rounded-xl bg-primary/30 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="font-semibold text-sm">Upgrade to PRO</div>
        <p className="text-xs text-muted-foreground mt-1 mb-3">
          Unlock more features and report export.
        </p>
        <button className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition">
          Upgrade Now
        </button>
      </div>
    </aside>
  );
}