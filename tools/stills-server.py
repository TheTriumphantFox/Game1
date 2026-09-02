#!/usr/bin/env python3
"""Dev server for stills-shot.html.

Serves the game root exactly like `python3 -m http.server` does, and adds one
route the plain server has not got: POST /__save/<name> writes the request body
to .codex-tmp/stills/<name>. The harness renders ~130 sprites and hands each one
back as PNG bytes; without an upload route every image would have to come back
through the page as a base64 string, and the whole set is several megabytes.

Not part of the game. .codex-tmp/ is gitignored, so the output never enters the
repo.
"""
import http.server, os, re, socketserver, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, '.codex-tmp', 'stills')
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8767
SAFE = re.compile(r'^[A-Za-z0-9._-]+$')


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def do_POST(self):
        if not self.path.startswith('/__save/'):
            self.send_error(404)
            return
        name = self.path[len('/__save/'):]
        # The name comes from a page this server itself serves, but it lands in
        # a filesystem path, so it is checked rather than trusted.
        if not SAFE.match(name) or not name.endswith('.png'):
            self.send_error(400, 'bad name')
            return
        n = int(self.headers.get('Content-Length', 0))
        os.makedirs(OUT, exist_ok=True)
        with open(os.path.join(OUT, name), 'wb') as f:
            f.write(self.rfile.read(n))
        self.send_response(204)
        self.send_header('Content-Length', '0')
        self.end_headers()

    def log_message(self, fmt, *args):
        if self.command == 'POST':
            super().log_message(fmt, *args)


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == '__main__':
    print(f'stills server on {PORT}, writing to {OUT}', flush=True)
    Server(('127.0.0.1', PORT), Handler).serve_forever()
