export function coverImageStyle(item: { coverImageUrl?: string }): string | null {
  const imageUrl = item.coverImageUrl?.trim();

  if (!imageUrl) {
    return null;
  }

  return `linear-gradient(180deg, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.46)), url("${imageUrl}")`;
}
