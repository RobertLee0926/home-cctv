// KV store in memory (Vercel Edge에서는 각 요청이 독립적이므로 polling 방식 사용)
// 영상 프레임을 임시 저장하는 글로벌 store
const store = global._cctvStore || (global._cctvStore = {
  frames: {},      // roomId -> { frame, ts }
  rooms: {}        // roomId -> { created }
});

export default function handler(req, res) {
  const { method, query } = req;
  const room = (query.room || '').toUpperCase().slice(0, 6);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (method === 'OPTIONS') { res.status(200).end(); return; }

  // POST /api/signal?room=ABC123&action=push — 노트북이 프레임 올림
  if (method === 'POST' && query.action === 'push') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      store.frames[room] = { frame: body, ts: Date.now() };
      res.status(200).json({ ok: true });
    });
    return;
  }

  // GET /api/signal?room=ABC123&action=pull — 휴대폰이 프레임 가져감
  if (method === 'GET' && query.action === 'pull') {
    const data = store.frames[room];
    if (!data || Date.now() - data.ts > 5000) {
      res.status(204).end(); // No content
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({ frame: data.frame, ts: data.ts });
    return;
  }

  // GET /api/signal?room=ABC123&action=check — 방 존재 확인
  if (method === 'GET' && query.action === 'check') {
    const data = store.frames[room];
    const alive = data && Date.now() - data.ts < 5000;
    res.status(200).json({ alive: !!alive });
    return;
  }

  res.status(400).json({ error: 'Invalid request' });
}
