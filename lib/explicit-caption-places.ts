/** Conservative recovery: a labelled venue followed by an explicit street address.
 * No generated names/addresses, no coordinates, and never auto-saves a place.
 */
export function extractExplicitCaptionPlaces(caption: string): Array<{ name: string; address: string }> {
  const lines = caption.normalize("NFC").split(/\r?\n/).map(line => line.trim());
  const results: Array<{ name: string; address: string }> = [];
  for (let i = 0; i < lines.length && results.length < 10; i++) {
    const match = lines[i].match(/^(?:📍\s*|(?:상호|가게명|업체명|장소명)\s*[:：]\s*)(.+)$/u);
    if (!match) continue;
    const name = match[1].trim();
    const address = (lines[i + 1] || "").replace(/^(?:주소|Address)\s*[:：]\s*/i, "");
    if (name.length < 2 || name.length > 80 || /[@#]|https?:|[:：]/i.test(name)) continue;
    if (address.length > 240 || !/\d/.test(address)) continue;
    const street = /\b(?:street|st\.?|road|rd\.?|avenue|ave\.?|rue|via|soi)\b|đường|\bĐ\.|(?:로|길)\s*\d|\d+\s*(?:번길|丁目)/iu;
    if (!street.test(address)) continue;
    if (!results.some(item => item.name === name && item.address === address)) results.push({ name, address });
  }
  return results;
}
