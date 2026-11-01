// Shared by source ingestion and browser links, including previously saved records.
function hasControlOrSpaceChar(str) {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code <= 0x20 || code === 0x7f) return true;
  }
  return false;
}

export function safePublicUrl(value) {
  if (typeof value !== "string" || value.length > 500) return undefined;
  const trimmed = value.trim();
  if (!trimmed || hasControlOrSpaceChar(trimmed)) return undefined;
  try {
    const url = new URL(value.trim());
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.port) return undefined;
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (!host.includes(".") || /(?:^|\.)(?:localhost|local|internal|test|invalid|onion)$/.test(host)) return undefined;
    // Reject all IPv6 literals, including IPv4-mapped/translated addresses.
    if (host.includes(":")) return undefined;
    if (/^[\d.]+$/.test(host) && !isPublicIpv4(host)) return undefined;
    url.hostname = host;
    return url.href.length <= 500 ? url.href : undefined;
  } catch { return undefined; }
}

export function isPublicIpv4(address) {
  const parts = address.split(".");
  if (parts.length !== 4 || parts.some((p) => !/^\d{1,3}$/.test(p) || Number(p) > 255)) return false;
  const [a, b, c] = parts.map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 0 || b === 168 || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
}