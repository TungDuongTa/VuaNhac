/**
 * Fold Vietnamese (and other Latin diacritics) to ASCII for search matching.
 * Covers every Vietnamese letter + tone combination as precomposed characters.
 */
const VIETNAMESE_CHAR_MAP: Record<string, string> = {
  // a / A family
  à: "a",
  á: "a",
  ả: "a",
  ã: "a",
  ạ: "a",
  ă: "a",
  ằ: "a",
  ắ: "a",
  ẳ: "a",
  ẵ: "a",
  ặ: "a",
  â: "a",
  ầ: "a",
  ấ: "a",
  ẩ: "a",
  ẫ: "a",
  ậ: "a",
  À: "a",
  Á: "a",
  Ả: "a",
  Ã: "a",
  Ạ: "a",
  Ă: "a",
  Ằ: "a",
  Ắ: "a",
  Ẳ: "a",
  Ẵ: "a",
  Ặ: "a",
  Â: "a",
  Ầ: "a",
  Ấ: "a",
  Ẩ: "a",
  Ẫ: "a",
  Ậ: "a",

  // e / E family
  è: "e",
  é: "e",
  ẻ: "e",
  ẽ: "e",
  ẹ: "e",
  ê: "e",
  ề: "e",
  ế: "e",
  ể: "e",
  ễ: "e",
  ệ: "e",
  È: "e",
  É: "e",
  Ẻ: "e",
  Ẽ: "e",
  Ẹ: "e",
  Ê: "e",
  Ề: "e",
  Ế: "e",
  Ể: "e",
  Ễ: "e",
  Ệ: "e",

  // i / I family
  ì: "i",
  í: "i",
  ỉ: "i",
  ĩ: "i",
  ị: "i",
  Ì: "i",
  Í: "i",
  Ỉ: "i",
  Ĩ: "i",
  Ị: "i",

  // o / O family
  ò: "o",
  ó: "o",
  ỏ: "o",
  õ: "o",
  ọ: "o",
  ô: "o",
  ồ: "o",
  ố: "o",
  ổ: "o",
  ỗ: "o",
  ộ: "o",
  ơ: "o",
  ờ: "o",
  ớ: "o",
  ở: "o",
  ỡ: "o",
  ợ: "o",
  Ò: "o",
  Ó: "o",
  Ỏ: "o",
  Õ: "o",
  Ọ: "o",
  Ô: "o",
  Ồ: "o",
  Ố: "o",
  Ổ: "o",
  Ỗ: "o",
  Ộ: "o",
  Ơ: "o",
  Ờ: "o",
  Ớ: "o",
  Ở: "o",
  Ỡ: "o",
  Ợ: "o",

  // u / U family
  ù: "u",
  ú: "u",
  ủ: "u",
  ũ: "u",
  ụ: "u",
  ư: "u",
  ừ: "u",
  ứ: "u",
  ử: "u",
  ữ: "u",
  ự: "u",
  Ù: "u",
  Ú: "u",
  Ủ: "u",
  Ũ: "u",
  Ụ: "u",
  Ư: "u",
  Ừ: "u",
  Ứ: "u",
  Ử: "u",
  Ữ: "u",
  Ự: "u",

  // y / Y family
  ỳ: "y",
  ý: "y",
  ỷ: "y",
  ỹ: "y",
  ỵ: "y",
  Ỳ: "y",
  Ý: "y",
  Ỷ: "y",
  Ỹ: "y",
  Ỵ: "y",

  // d / D with stroke
  đ: "d",
  Đ: "d",
};

const VIETNAMESE_CHAR_RE = new RegExp(
  `[${Object.keys(VIETNAMESE_CHAR_MAP).join("")}]`,
  "g",
);

/** Lowercase ASCII fold for Vietnamese titles / artists / queries. */
export function normalizeVietnamese(text: string): string {
  return text
    .replace(VIETNAMESE_CHAR_RE, (ch) => VIETNAMESE_CHAR_MAP[ch] ?? ch)
    .toLowerCase()
    // Fallback for any remaining combining marks / other Latin diacritics
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
