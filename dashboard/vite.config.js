import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { spawn } from 'node:child_process';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..');

// Dev-only endpoint: reveal a mission folder in the OS file manager.
// The browser can't do this itself, but the Vite dev server (Node) can.
// Requests are constrained to paths inside the repo — no traversal out.
function openInExplorer() {
  return {
    name: 'open-in-explorer',
    configureServer(server) {
      server.middlewares.use('/__open', (req, res) => {
        const url = new URL(req.url, 'http://localhost');
        const rel = url.searchParams.get('path') || '';
        const target = path.resolve(REPO_ROOT, rel);

        if (target !== REPO_ROOT && !target.startsWith(REPO_ROOT + path.sep)) {
          res.statusCode = 400;
          res.end('outside repo');
          return;
        }

        // Windows: explorer. macOS: open. Linux: xdg-open.
        const cmd =
          process.platform === 'win32' ? 'explorer' : process.platform === 'darwin' ? 'open' : 'xdg-open';
        // explorer.exe returns exit code 1 even on success — detach and don't wait.
        spawn(cmd, [target], { detached: true, stdio: 'ignore' }).unref();

        res.statusCode = 200;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ ok: true, path: target }));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), openInExplorer()],
  server: {
    fs: {
      // The dashboard imports markdown from the repo root, one level up.
      allow: ['..'],
    },
  },
});
