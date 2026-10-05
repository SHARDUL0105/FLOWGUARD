"use client";
import DemoModeToggle from "./DemoModeToggle";
import { useFlowStore } from "@/store/flowguardStore";

/** Command-center header: title, system status pill, Live/Replay toggle. */
export default function TopBar() {
  const incident = useFlowStore((s) => Object.values(s.nodes).some((n) => n.status !== "healthy"));
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 px-6 pb-3 md:px-10">
      <div>
        <p className="text-[12px] text-mute">Checkout Platform</p>
        <h1 className="text-[28px] font-semibold leading-none tracking-tight">Command center</h1>
      </div>
      <div className="flex items-center gap-5">
        <DemoModeToggle />
        <span className={`flex items-center gap-2 text-[12.5px] ${incident ? "text-crit" : "text-ok"}`}>
          <span className={`h-2 w-2 rounded-full ${incident ? "animate-pulse bg-crit" : "bg-ok"}`} />
          {incident ? "Incident in progress" : "All services steady"}
        </span>
      </div>
    </div>
  );
}
