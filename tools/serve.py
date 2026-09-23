#!/usr/bin/env python3
"""Servidor estático sem cache para desenvolvimento: python3 tools/serve.py [porta]"""
import http.server, socketserver, sys, os

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def log_message(self, *a):
        pass

NoCache.extensions_map.update({'.js': 'text/javascript', '.webmanifest': 'application/manifest+json'})
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
socketserver.ThreadingTCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(('0.0.0.0', port), NoCache) as httpd:
    print(f'Servindo em http://localhost:{port}')
    httpd.serve_forever()
