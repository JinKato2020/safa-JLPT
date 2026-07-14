// tools/content/rebuild.ts — content/ を正本として _manifest.json と bundled.generated.ts を再生成する恒常ツール。
// 移行後の運用: content/**.json を手編集 → node --import tsx tools/content/rebuild.ts → git push(deploy-pagesが公開)。
// (build_content.ts は旧バンクから content/ を作る一度きりの移行ツール。旧バンク削除後は本ツールを使う。)
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildManifest } from './manifest.ts';

const OUT = 'content';
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) { const p = join(dir, e); if (statSync(p).isDirectory()) out.push(...walk(p)); else out.push(p); }
  return out;
}
function main() {
  const files: Record<string, { text: string; count: number }> = {};
  for (const abs of walk(OUT)) {
    const rel = abs.slice(OUT.length + 1).split('\\').join('/');
    if (rel === '_manifest.json') continue;
    const text = readFileSync(abs, 'utf8');
    let count = 0;
    if (rel.endsWith('.json')) { const j = JSON.parse(text); count = Array.isArray(j.items) ? j.items.length : (j.items ? Object.keys(j.items).length : 0); }
    files[rel] = { text, count };
  }
  const jsonPaths = Object.keys(files).filter((p) => p.endsWith('.json')).sort();
  const barrel = '// 自動生成(rebuild.ts / build_content.ts)。手で編集しない。content/ の全JSONを静的importする。\n'
    + jsonPaths.map((p, i) => `import f${i} from '../../../content/${p}';`).join('\n')
    + '\nexport const BUNDLED: Record<string, unknown> = {\n'
    + jsonPaths.map((p, i) => `  '${p}': f${i},`).join('\n') + '\n};\n';
  mkdirSync('src/data/content', { recursive: true });
  writeFileSync('src/data/content/bundled.generated.ts', barrel, 'utf8');
  writeFileSync(join(OUT, '_manifest.json'), JSON.stringify(buildManifest(files, process.env.CONTENT_VERSION ?? 'unset')), 'utf8');
  console.log('REBUILT manifest + barrel from', OUT, '(', jsonPaths.length, 'files )');
}
main();
