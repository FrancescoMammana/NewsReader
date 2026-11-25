export async function translateTextClient(
  text: string,
  targetLang = 'it',
  sourceLang = 'auto',
): Promise<string> {
  if (!text || !text.trim()) return text;
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Errore HTTP traduzione: ${res.status}`);
  }
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    return text;
  }
  let translated = '';
  for (const chunk of data[0]) {
    if (Array.isArray(chunk) && typeof chunk[0] === 'string') {
      translated += chunk[0];
    }
  }
  return translated || text;
}
