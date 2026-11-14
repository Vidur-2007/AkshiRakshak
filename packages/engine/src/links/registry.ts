/**
 * Link registry (SPEC_A_ENGINE.md §6.1).
 * P1: shorteners and risky TLDs. P2 adds the verified official-domain / brand table and homoglyphs.
 */

export const SHORTENERS: ReadonlySet<string> = new Set([
  'bit.ly',
  'bitly.com',
  'tinyurl.com',
  't.co',
  'cutt.ly',
  'rb.gy',
  'is.gd',
  'v.gd',
  'shorturl.at',
  'tiny.cc',
  'ow.ly',
  's.id',
  'rebrand.ly',
  't.ly',
  'shrtco.de',
  'goo.su',
  'shorturl.asia',
  'tinyurl.is',
  'u.to',
  'clck.ru',
  'bl.ink',
  'short.gy',
  'qr.ae',
]);

/** Weight only, never decisive. */
export const RISKY_TLDS: ReadonlySet<string> = new Set([
  'xyz',
  'top',
  'icu',
  'click',
  'cfd',
  'sbs',
  'buzz',
  'online',
  'site',
  'live',
  'rest',
  'monster',
  'quest',
  'lol',
  'mom',
  'cyou',
  'bond',
  'info',
  'support',
  'help',
  'tk',
  'ml',
  'ga',
  'cf',
  'gq',
]);
