/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Helpers do chat interno: canonização de dmKey (par ordenado),
 * resolução do channelKey (string usada em TeamChannelState) e validações.
 */

export function canonicalDmKey(userA: string, userB: string): string {
  if (userA === userB) throw new Error("DM consigo mesmo");
  return [userA, userB].sort().join("_");
}

export function channelKeyForGlobal(): string {
  return "global";
}

export function channelKeyForDm(dmKey: string): string {
  return `dm:${dmKey}`;
}

export function parseDmKey(dmKey: string): [string, string] {
  const parts = dmKey.split("_");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error("dmKey inválido");
  }
  return [parts[0], parts[1]];
}

export function isUserInDm(userId: string, dmKey: string): boolean {
  const [a, b] = parseDmKey(dmKey);
  return userId === a || userId === b;
}

export function dmPeerOf(userId: string, dmKey: string): string {
  const [a, b] = parseDmKey(dmKey);
  if (userId === a) return b;
  if (userId === b) return a;
  throw new Error("usuário fora do dmKey");
}

// Sanitização: trim, limita 4000 chars, remove caracteres de controle exceto \n e \t.
export function sanitizeBody(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const cleaned = input
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim()
    .slice(0, 4000);
  return cleaned.length > 0 ? cleaned : null;
}
