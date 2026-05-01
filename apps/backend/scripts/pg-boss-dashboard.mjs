import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const pkgRoot = dirname(require.resolve('@pg-boss/dashboard/package.json'));

process.chdir(pkgRoot);
process.env.HOST = '127.0.0.1';

await import(join(pkgRoot, 'build/server/index.js'));
