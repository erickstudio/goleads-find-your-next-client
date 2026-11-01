import { usePreferences } from "@/lib/PreferencesContext";

const LIGHT_LOGO = "https://media.base44.com/images/public/6ae63656edc313a907ad5680/12acd4060_2.png";
const DARK_LOGO = "https://media.base44.com/images/public/6ae63656edc313a907ad5680/36dbfe4f7_1.png";

export default function BrandWordmark({ size = "md", className = "" }) {
  const { resolvedTheme } = usePreferences();
  const dimensions = size === "lg" ? "h-12 w-44" : size === "sm" ? "h-8 w-28" : "h-10 w-36";
  return (
    <span className={`inline-flex shrink-0 items-center ${dimensions} ${className}`}>
      <img
        src={resolvedTheme === "dark" ? DARK_LOGO : LIGHT_LOGO}
        alt="GoLeads"
        className="block h-full w-full object-contain"
        decoding="async"
      />
    </span>
  );
}
