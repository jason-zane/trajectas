"""Private compute endpoint. Only authenticated, signed server requests execute."""
from http.server import BaseHTTPRequestHandler
import hashlib
import hmac
import json
import os
import time
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

MAX_BYTES = 4_000_000


def verify(body, timestamp, signature):
    secret = os.environ.get('CRON_SECRET')
    if not secret or not timestamp or not signature:
        return False
    try:
        if abs(time.time() - int(timestamp)) > 300:
            return False
    except ValueError:
        return False
    expected = hmac.new(secret.encode(), b'outcomes-v1:' + timestamp.encode() + b':' + body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            size = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            size = 0
        if not 0 < size <= MAX_BYTES:
            return self.respond(413, {'error': 'Analysis payload is outside the supported size.'})
        body = self.rfile.read(size)
        if not verify(body, self.headers.get('X-Outcomes-Timestamp'), self.headers.get('X-Outcomes-Signature')):
            return self.respond(403, {'error': 'Forbidden'})
        try:
            from services.outcomes_worker.engine import analyze
            result = analyze(json.loads(body))
            self.respond(200, result)
        except (ValueError, KeyError, TypeError) as error:
            self.respond(422, {'error': str(error)[:400]})
        except Exception:
            # Never log participant-level data or a raw numerical exception.
            self.respond(500, {'error': 'Statistical computation failed. Review the study inputs and retry.'})

    def respond(self, status, value):
        body = json.dumps(value, allow_nan=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    from http.server import HTTPServer
    HTTPServer(('127.0.0.1', 8874), handler).serve_forever()
