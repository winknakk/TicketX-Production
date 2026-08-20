import welcomeImg from "@/assets/welcome-illustration.png";

export function WelcomeCard() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-primary/15 via-card to-secondary/15 border border-border p-6 flex items-center gap-6 overflow-hidden">
      <div className="flex-1 min-w-0">
        <h2 className="text-2xl font-bold mb-2">
          Welcome back, Admin! <span className="inline-block">👋</span>
        </h2>
        <p className="text-sm text-muted-foreground">
          You've learned <span className="font-semibold text-foreground">80%</span> of your goal this week!
          <br />
          Keep it up and improve your support!
        </p>
      </div>
      <img
        src={welcomeImg}
        alt=""
        loading="lazy"
        width={1024}
        height={1024}
        className="hidden sm:block h-32 w-auto -my-4"
      />
    </div>
  );
}