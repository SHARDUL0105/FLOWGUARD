// Owner: Shardul. Landing: hero, 5 stages (DETECT->UNDERSTAND->PREDICT->SIMULATE->RECOMMEND), "Enter Command Center".
import Link from "next/link";
export default function Landing() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6">
      <h1 className="text-6xl font-bold">FLOWGUARD</h1>
      <p className="text-slate-400">Don&apos;t wait for your system to fail. Predict it. Simulate it. Stop it.</p>
      <Link href="/command-center" className="glass px-6 py-3">Enter Command Center</Link>
    </main>
  );
}
