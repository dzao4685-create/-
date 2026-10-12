// Keep game storage on the existing service; forward requests from this game's origin.
const GAME_HOST = 'cozy-bear-gomoku.dzao4685.chatgpt.site';
export default {
  async fetch(request) {
    const incoming = new URL(request.url);
    const origin = request.headers.get('Origin');
    if (request.method === 'POST' && origin && origin !== incoming.origin) {
      return Response.json({ error: '请通过游戏页面操作。' }, { status: 403 });
    }
    const target = new URL(request.url);
    target.hostname = GAME_HOST;
    target.protocol = 'https:';
    target.port = '';
    const headers = new Headers(request.headers);
    headers.set('Host', GAME_HOST);
    if (origin === incoming.origin) headers.set('Origin', target.origin);
    headers.delete('Cookie');
    const upstream = await fetch(new Request(target.toString(), {
      method: request.method,
      headers,
      body: request.body,
      redirect: 'follow'
    }));
    const resultHeaders = new Headers(upstream.headers);
    resultHeaders.delete('Set-Cookie');
    if (upstream.headers.get('Content-Type')?.includes('text/html')) {
      const html = (await upstream.text()).replaceAll('https://' + GAME_HOST, incoming.origin);
      resultHeaders.delete('Content-Length');
      resultHeaders.delete('Content-Encoding');
      resultHeaders.set('Cache-Control', 'no-cache');
      return new Response(html, { status: upstream.status, headers: resultHeaders });
    }
    return new Response(upstream.body, { status: upstream.status, headers: resultHeaders });
  }
};
