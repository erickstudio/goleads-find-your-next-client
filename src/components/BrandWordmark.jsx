import { Image } from "@/components/ui/image";

const LIGHT_LOGO = "https://media.base44.com/images/public/6ae63656edc313a907ad5680/12acd4060_2.png";
const DARK_LOGO = "https://media.base44.com/images/public/6ae63656edc313a907ad5680/36dbfe4f7_1.png";

export default function BrandWordmark({ size = "md", className = "" }) {
  const dimensions = size === "lg" ? "h-12 w-44" : size === "sm" ? "h-8 w-28" : "h-10 w-36";
  return (
    <span className={`inline-flex shrink-0 items-center ${dimensions} ${className}`} aria-label="GoLeads">
      <span className="block h-full w-full dark:hidden">
        <Image src={LIGHT_LOGO} alt="GoLeads" className="h-full w-full" fittingType="fit" />
      </span>
      <span className="hidden h-full w-full dark:block">
        <Image src="https://media.base44.com/images/public/6ae63656edc313a907ad5680/12acd4060_2.png" alt="GoLeads" className="h-full w-full" fittingType="fit" />
      </span>
    </span>);

}