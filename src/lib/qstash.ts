import { Client } from '@upstash/qstash';

// QStash is not required for v1 endpoints — only needed when async jobs are added.
// We initialize lazily so missing QSTASH_TOKEN does not crash the server at startup.
let _qstash: Client | null = null;

export function getQStash(): Client {
  if (_qstash) return _qstash;
  if (!process.env.QSTASH_TOKEN) {
    throw new Error('QSTASH_TOKEN is not set');
  }
  _qstash = new Client({ token: process.env.QSTASH_TOKEN });
  return _qstash;
}
