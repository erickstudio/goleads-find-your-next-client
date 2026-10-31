import { safePublicUrl, isPublicIpv4 } from "@/lib/public-url";

function isPublicAddress(address, type) {
  if (type === 1) return isPublicIpv4(address);
  // Only global IPv6 unicast; reject special-use, transition, mapped and documentation ranges.
  if (type !== 28 || !/^[23][\da-f]{3}:/i.test(address)) return false;
  const [first, second = "0"] = address.toLowerCase().split(":");
  return first !== "2002" && !(first === "2001" && (parseInt(second || "0", 16) < 0x200 || second === "db8")) && first !== "3fff";
}

async function assertPublicDns(host, signal) {
  if (/^[\d.]+$/.test(host)) {
    if (!isPublicIpv4(host)) throw new Error("Non-public source address");
    return;
  }
  const answers = await Promise.all(["A", "AAAA"].map(async (type) => {
    const endpoint = new URL("https://cloudflare-dns.com/dns-query");
    endpoint.searchParams.set("name", host);
    endpoint.searchParams.set("type", type);
    const response = await fetch(endpoint, { headers: { Accept: "application/dns-json" }, redirect: "error", signal });
    if (!response.ok) throw new Error("Source DNS lookup failed");
    const result = await response.json();
    if (result.Status !== 0) throw new Error("Source DNS lookup failed");
    return (result.Answer || []).filter((record) => record.type === 1 || record.type === 28);
  }));
  const addresses = answers.flat();
  if (!addresses.length || addresses.some((record) => !isPublicAddress(record.data, record.type))) {
    throw new Error("Source DNS did not resolve exclusively to public addresses");
  }
}

export async function fetchPublicSource(rawUrl, options) {
  let next = rawUrl;
  for (let hop = 0; hop <= 4; hop++) {
    const safeUrl = safePublicUrl(next);
    if (!safeUrl) throw new Error("Unsafe source or redirect URL");
    await assertPublicDns(new URL(safeUrl).hostname, options.signal);
    const response = await fetch(safeUrl, { ...options, redirect: "manual" });
    if (![301, 302, 303, 307, 308].includes(response.status)) return { response, finalUrl: safeUrl };
    const location = response.headers.get("location");
    await response.body?.cancel();
    if (!location) throw new Error("Source redirect missing location");
    next = new URL(location, safeUrl).href;
  }
  throw new Error("Too many source redirects");
}