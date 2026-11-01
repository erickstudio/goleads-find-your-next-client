import { Image } from "@/components/ui/image";

const LIGHT_LOGO = "https://media.base44.com/images/public/6ae63656edc313a907ad5680/3db70aa5f_logocolor2.png";
const DARK_LOGO = "https://media.base44.com/images/public/6ae63656edc313a907ad5680/6125cb31c_Logoblanco1.png";

export default function BrandWordmark({ size = "md", className = "" }) {
  const dimensions = size === "lg" ? "h-12 w-44" : size === "sm" ? "h-8 w-28" : "h-10 w-36";
  return (
    <span className={`inline-flex shrink-0 items-center ${dimensions} ${className}`} aria-label="GoLeads">
      <Image src={LIGHT_LOGO} alt="GoLeads" className="h-full w-full dark:hidden" fittingType="fit" />
      <Image src={DARK_LOGO} alt="GoLeads" className="hidden h-full w-full dark:block" fittingType="fit" />
    </span>
  );
}