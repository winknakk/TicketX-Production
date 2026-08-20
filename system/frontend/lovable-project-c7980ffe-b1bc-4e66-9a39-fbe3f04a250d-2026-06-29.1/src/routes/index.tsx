import { createFileRoute } from "@tanstack/react-router";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Topbar } from "@/components/dashboard/Topbar";
import { WelcomeCard } from "@/components/dashboard/WelcomeCard";
import { LatestTickets } from "@/components/dashboard/LatestTickets";
import { TicketsChart } from "@/components/dashboard/TicketsChart";
import { StatCards } from "@/components/dashboard/StatCards";
import { RightPanel } from "@/components/dashboard/RightPanel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AutomationX — Admin Dashboard" },
      { name: "description", content: "Modern AutomationX admin dashboard for tickets, conversations, and SLA monitoring." },
      { property: "og:title", content: "AutomationX — Admin Dashboard" },
      { property: "og:description", content: "Modern AutomationX admin dashboard for tickets, conversations, and SLA monitoring." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <Sidebar />
      <main className="flex-1 min-w-0 p-6 lg:p-8 space-y-6">
        <Topbar />
        <WelcomeCard />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <LatestTickets />
          <TicketsChart />
        </div>
        <StatCards />
      </main>
      <RightPanel />
    </div>
  );
}
