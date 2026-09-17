import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEPLOY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'deploy');
const NGINX = readFileSync(join(DEPLOY, 'nginx.conf'), 'utf8');
const HEADERS = readFileSync(join(DEPLOY, 'security-headers.conf'), 'utf8');
const INDEX = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'index.html'),
  'utf8'
);

/**
 * The nginx rule that loses security headers silently.
 *
 * `add_header` is inherited from the enclosing block ONLY IF the current block
 * declares no `add_header` of its own. One `add_header Cache-Control …` inside a
 * location discards every security header set at the server level — no warning,
 * no error, and `nginx -t` passes.
 *
 * That is what happened: `location = /index.html` set Cache-Control, and `/`
 * reaches it through try_files, so the HTML document — the only response a
 * browser applies these to — went out with none of them, while the API
 * responses two lines away had all three. An external scan reported "Header not
 * set" for headers that were plainly in the config.
 *
 * There is nothing in nginx that catches this, so the check lives here.
 */

/** Each `location … { … }` block, with its body. Brace-matched, not regexed. */
function locationBlocks(conf) {
  const out = [];
  for (const m of conf.matchAll(/location\s+([^{]+)\{/g)) {
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < conf.length && depth > 0) {
      if (conf[i] === '{') depth += 1;
      else if (conf[i] === '}') depth -= 1;
      i += 1;
    }
    out.push({ name: m[1].trim(), body: conf.slice(m.index + m[0].length, i - 1) });
  }
  return out;
}

const SNIPPET = 'include /etc/nginx/security-headers.conf;';

describe('nginx security headers', () => {
  const blocks = locationBlocks(NGINX);

  it('found the location blocks, so a reformat cannot empty this test', () => {
    expect(blocks.length).toBeGreaterThan(4);
  });

  it.each(blocks.map((b) => [b.name, b]))(
    'location %s does not silently drop the inherited headers',
    (_name, block) => {
      // A block with its own add_header inherits NOTHING, so it has to include
      // the snippet. A block with none inherits the server-level include.
      const setsItsOwn = /^\s*add_header/m.test(block.body);
      if (!setsItsOwn) return;

      expect(
        block.body.includes(SNIPPET),
        'this block sets add_header, so nginx discards every header inherited '
          + 'from the server level — include security-headers.conf here too'
      ).toBe(true);
    }
  );

  it('sets the headers an external scan looks for', () => {
    for (const header of [
      'Strict-Transport-Security',
      'Content-Security-Policy',
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Referrer-Policy',
    ]) {
      expect(HEADERS).toContain(header);
    }
    // Not a header: it stops nginx putting its exact version in every response.
    expect(NGINX).toContain('server_tokens off');
  });

  /**
   * The CSP has to permit what the app genuinely loads, or the site breaks in a
   * way no test here would catch — the page renders and the images do not.
   */
  it('allows the two image hosts the app actually uses', () => {
    const csp = HEADERS.match(/Content-Security-Policy "([^"]+)"/)[1];
    const imgSrc = csp.match(/img-src ([^;]+)/)[1];

    expect(imgSrc).toContain('flagcdn.com');               // country flags
    expect(imgSrc).toContain('cdn.nvimmigrationpvtltd.com'); // R2: logos, thumbnails
    expect(imgSrc).toContain('data:');                      // inline SVG icons

    // The app has 277 inline style={{…}} props, so this is required until those
    // are gone. Inline SCRIPT is not, and must never be.
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).not.toMatch(/script-src[^;]*unsafe-eval/);
  });
});

/**
 * Google truncates the link at roughly 60 characters and the description at
 * roughly 160, and what it cuts is the END — so anything past the limit does not
 * merely go unread, it leaves the visible part trailing off mid-phrase.
 */
describe('search result lengths', () => {
  it('keeps the title inside what Google shows', () => {
    const title = INDEX.match(/<title>([^<]+)<\/title>/)[1];
    expect(title.length).toBeLessThanOrEqual(60);
    // Still leads with the brand, which is the term people search.
    expect(title).toMatch(/^NV Immigration/);
  });

  it('keeps the description inside what Google shows', () => {
    const desc = INDEX.match(/<meta name="description" content="([^"]+)"/)[1];
    expect(desc.length).toBeLessThanOrEqual(160);
    // The phone number is the conversion, so it has to survive the cut.
    expect(desc).toContain('9925913764');
  });
});
