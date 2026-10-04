import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "solid" | "outline" | "ghost" | "paper";
const styles: Record<Variant, string> = {
  solid: "bg-forest text-paper hover:bg-forest-2",
  outline: "border border-ink/20 text-ink hover:border-ink",
  ghost: "text-ink hover:text-forest",
  paper: "bg-paper text-forest hover:bg-white",
};

interface Common { variant?: Variant; className?: string; children: React.ReactNode }
type LinkProps = Common & { href: string } & Omit<React.ComponentProps<typeof Link>, "href" | "className" | "children">;
type BtnProps = Common & { href?: undefined } & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button(props: LinkProps | BtnProps) {
  const { variant = "solid", className, children, ...rest } = props;
  const cls = cn("inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13.5px] font-medium transition-colors duration-300 disabled:opacity-40", styles[variant], className);
  if (typeof (rest as LinkProps).href === "string") {
    const { href, ...r } = rest as LinkProps;
    return <Link href={href} className={cls} {...r}>{children}</Link>;
  }
  return <button className={cls} {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>{children}</button>;
}
