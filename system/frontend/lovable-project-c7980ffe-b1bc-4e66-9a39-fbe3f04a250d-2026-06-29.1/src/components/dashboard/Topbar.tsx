import { Bell, Calendar, ChevronDown } from "lucide-react";

export function Topbar() {
  return (
    <header className="flex items-center justify-between mb-8 gap-4 flex-wrap">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 rounded-xl bg-card border border-border px-4 py-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>20 Sep 2026, Friday</span>
        </div>
        <button className="relative h-10 w-10 rounded-xl bg-card border border-border flex items-center justify-center hover:border-primary transition">
          <Bell className="h-4 w-4" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-secondary" />
        </button>
        <button className="flex items-center gap-2 rounded-xl bg-card border border-border pl-1 pr-3 py-1 hover:border-primary transition">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-secondary to-primary" />
          <span className="text-sm font-medium">Admin</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </header>
  );
}