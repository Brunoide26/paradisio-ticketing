// Spanish letters: base Latin alphabet, accented vowels, ñ/ü, plus space/apostrophe/hyphen
// for compound and hyphenated names ("O'Brien", "Anne-Marie", "María José").
const NAME_CHARS_RE = /^[a-zA-ZñÑüÜáéíóúÁÉÍÓÚ' -]+$/;
const VOWEL_RE = /[aeiouáéíóúAEIOUÁÉÍÓÚ]/;
const REPEATED_CHAR_RE = /(.)\1{2,}/; // same character 3+ times in a row, e.g. "aaa"

function isValidNamePart(value) {
  const v = (value || '').trim();
  if (v.length < 2) return false;
  if (!NAME_CHARS_RE.test(v)) return false;
  if (!VOWEL_RE.test(v)) return false;
  if (REPEATED_CHAR_RE.test(v)) return false;
  return true;
}

const DNI_RE = /^\d{8}$/;
const CE_PASAPORTE_RE = /^[a-zA-Z0-9]{8,12}$/;

// tipoDocumento is optional: when known (paid flow), enforces the exact rule for
// that type. When absent (free flow's single, untyped document field), accepts
// anything that would be valid under either rule.
function isValidDocument(numero, tipoDocumento) {
  const v = (numero || '').trim();
  if (tipoDocumento === 'DNI') return DNI_RE.test(v);
  if (tipoDocumento === 'CE' || tipoDocumento === 'Pasaporte') return CE_PASAPORTE_RE.test(v);
  return DNI_RE.test(v) || CE_PASAPORTE_RE.test(v);
}

module.exports = { isValidNamePart, isValidDocument };
