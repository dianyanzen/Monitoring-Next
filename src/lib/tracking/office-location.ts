type LocationLike = {
  code?: string | null;
  name?: string | null;
};

const DISDUKCAPIL_KEY = "DINASKEPENDUDUKANDANPENCATATANSIPILKOTABANDUNG";

export function normalizeOfficeKey(value: unknown) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

function normalizeLocationNameKey(value: unknown) {
  return normalizeOfficeKey(value).replace(/^KECAMATAN/, "");
}

function officeCandidates(officeName: unknown) {
  const key = normalizeOfficeKey(officeName);
  if (!key) return [] as string[];
  const direct = key;
  const withoutPrefix = key.replace(/^KECAMATAN/, "");
  return Array.from(new Set([direct, withoutPrefix].filter(Boolean)));
}

export function isOfficeAllowedForLocation(officeName: unknown, locationCode: unknown, locationName: unknown) {
  const officeKeys = officeCandidates(officeName);
  if (!officeKeys.length) return true;

  const locationCodeKey = normalizeOfficeKey(locationCode);
  const locationNameKey = normalizeLocationNameKey(locationName);

  if (officeKeys.some((key) => key.includes("DISDUKCAPIL") || key === DISDUKCAPIL_KEY)) {
    return locationCodeKey === "99" || locationNameKey.includes("DINAS");
  }

  return officeKeys.some((officeKey) => {
    return (
      officeKey === locationCodeKey ||
      officeKey === locationNameKey ||
      locationNameKey.includes(officeKey) ||
      officeKey.includes(locationNameKey)
    );
  });
}

export function filterLocationsByOffice<T extends LocationLike>(officeName: unknown, locations: T[]) {
  const officeKeys = officeCandidates(officeName);
  if (!officeKeys.length) return locations;
  return locations.filter((item) => isOfficeAllowedForLocation(officeName, item.code, item.name));
}
