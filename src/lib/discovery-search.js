export function validateDiscoverySearch(search) {
  const out = {};
  for (const key of ["category", "location", "searchId"]) {
    if (typeof search?.[key] === "string" && search[key].trim()) out[key] = search[key].trim().slice(0, 120);
  }
  const windowDays = Number(search?.window);
  if ([30, 90, 180].includes(windowDays)) out.window = windowDays;
  if (search?.examples === "1" || search?.examples === true) out.examples = "1";
  if (search?.showDismissed === "1" || search?.showDismissed === true) out.showDismissed = "1";
  return out;
}