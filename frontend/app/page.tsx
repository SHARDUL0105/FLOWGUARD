import Hero from "@/components/hero/Hero";
import { AutoFix, FinalCTA, HowItWorks, PredictionSection, ProblemSection, ProjectsSection, SystemSection } from "@/components/home/Sections";
import SiteNav from "@/components/layout/SiteNav";

export default function Home() {
  return (
    <main className="relative">
      <SiteNav floating />
      <Hero />
      <ProblemSection />
      <HowItWorks />
      <SystemSection />
      <PredictionSection />
      <ProjectsSection />
      <AutoFix />
      <FinalCTA />
    </main>
  );
}
