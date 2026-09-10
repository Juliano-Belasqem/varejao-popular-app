export type PublicationTargetOption = {
  value: string;
  network: "instagram" | "facebook";
  type: "feed" | "story" | "carousel" | "reel";
  label: string;
};

export const publicationTargets: PublicationTargetOption[] = [
  { value: "instagram:feed", network: "instagram", type: "feed", label: "Instagram · Feed" },
  { value: "instagram:story", network: "instagram", type: "story", label: "Instagram · Story" },
  { value: "instagram:carousel", network: "instagram", type: "carousel", label: "Instagram · Carrossel" },
  { value: "instagram:reel", network: "instagram", type: "reel", label: "Instagram · Reel" },
  { value: "facebook:feed", network: "facebook", type: "feed", label: "Facebook · Feed" },
  { value: "facebook:story", network: "facebook", type: "story", label: "Facebook · Story" },
  { value: "facebook:reel", network: "facebook", type: "reel", label: "Facebook · Reel" },
];

export function isSupportedPublicationTarget(network: string, type: string) {
  return publicationTargets.some((target) => target.network === network && target.type === type);
}

export function parsePublicationTarget(value: string) {
  const target = publicationTargets.find((item) => item.value === value);
  return target ? { network: target.network, type: target.type } : null;
}
