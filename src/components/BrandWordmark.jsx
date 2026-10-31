import { Image } from "@/components/ui/image";

const LOGO = "https://media.base44.com/images/public/6ae63656edc313a907ad5680/c09d3f492_LogosdeGoLeads.png";
const WORDMARK = "https://media.base44.com/images/public/6ae63656edc313a907ad5680/f1161d8c4_GoLeads-wordmark-referencia.png";

export default function BrandWordmark({ size = "md", className = "" }) {
  const dimensions = size === "lg" ? "h-12 w-44" : size === "sm" ? "h-8 w-28" : "h-10 w-36";
  return (
    <span className={`inline-flex shrink-0 items-center ${dimensions} ${className}`} aria-label="GoLeads">
      <span className="inline-flex items-center gap-2 dark:hidden">
        <span className="inline-block h-7 w-11 overflow-hidden rounded-md">
          <Image src={LOGO} alt="" className="h-full w-full" fittingType="fill" />
        </span>
        <span className="font-heading text-xl font-bold tracking-tight text-foreground">GoLeads</span>
      </span>
      <Image src={WORDMARK} alt="GoLeads" className="hidden h-full w-full rounded-md dark:block" fittingType="fit" />
    </span>
  );
}