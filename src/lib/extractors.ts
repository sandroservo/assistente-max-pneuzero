/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Extratores de dados estruturados a partir de mensagens do lead.
 * Roda automaticamente no webhook antes da IA, sem custo de tool-call.
 */

const PLACA_REGEX = /\b([A-Z]{3})[\s-]?(\d)([A-Z\d])(\d{2})\b/gi;
const MEDIDA_REGEX = /\b(\d{3})\/(\d{2})\s?R?(\d{2})\b/gi;
const KM_REGEX = /\b(\d{1,3}(?:[.,]\d{3})*|\d+)\s?(?:km|quil[oô]metros?|quil[oô]metragem)\b/gi;
const ANO_REGEX = /\b(19\d{2}|20[0-3]\d)\b/g;

export function extractPlaca(text: string): string | null {
  PLACA_REGEX.lastIndex = 0;
  const m = PLACA_REGEX.exec(text);
  if (!m) return null;
  return `${m[1].toUpperCase()}${m[2]}${m[3].toUpperCase()}${m[4]}`;
}

export function extractMedidaPneu(text: string): string | null {
  MEDIDA_REGEX.lastIndex = 0;
  const m = MEDIDA_REGEX.exec(text);
  if (!m) return null;
  return `${m[1]}/${m[2]}R${m[3]}`;
}

export function extractKm(text: string): number | null {
  KM_REGEX.lastIndex = 0;
  const m = KM_REGEX.exec(text);
  if (!m) return null;
  const raw = m[1].replace(/[.,]/g, "");
  const km = parseInt(raw, 10);
  if (Number.isNaN(km) || km < 0 || km > 9_999_999) return null;
  return km;
}

export function extractAno(text: string): number | null {
  ANO_REGEX.lastIndex = 0;
  const now = new Date().getFullYear();
  const matches = Array.from(text.matchAll(ANO_REGEX));
  for (const m of matches) {
    const ano = parseInt(m[1], 10);
    if (ano >= 1960 && ano <= now + 1) return ano;
  }
  return null;
}

export interface ExtractedVehicleData {
  placa?: string;
  medidaPneu?: string;
  kmAtual?: number;
  ano?: number;
}

export function extractVehicleData(text: string): ExtractedVehicleData {
  const out: ExtractedVehicleData = {};
  const placa = extractPlaca(text);
  if (placa) out.placa = placa;
  const medida = extractMedidaPneu(text);
  if (medida) out.medidaPneu = medida;
  const km = extractKm(text);
  if (km !== null) out.kmAtual = km;
  const ano = extractAno(text);
  if (ano !== null) out.ano = ano;
  return out;
}
