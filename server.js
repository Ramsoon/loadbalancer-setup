// Learning platform demo for showing how a reverse proxy works.
// Zero dependencies. Run: node server.js   (PORT and HOST are optional env vars)
const http = require('http');
const os = require('os');

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const log = [];

const courses = [
  { id: 1, title: 'How the Web Works', level: 'Beginner', lessons: 12, progress: 100, tag: 'Networking' },
  { id: 2, title: 'HTTP in Depth', level: 'Beginner', lessons: 18, progress: 64, tag: 'Networking' },
  { id: 3, title: 'Reverse Proxies and Load Balancing', level: 'Intermediate', lessons: 15, progress: 30, tag: 'Infrastructure' },
  { id: 4, title: 'TLS and Certificates', level: 'Intermediate', lessons: 10, progress: 0, tag: 'Security' },
  { id: 5, title: 'Node.js Services', level: 'Intermediate', lessons: 22, progress: 45, tag: 'Backend' },
  { id: 6, title: 'Private Networks and VPCs', level: 'Advanced', lessons: 14, progress: 0, tag: 'Infrastructure' },
];

function privateIPs() {
  return Object.values(os.networkInterfaces()).flat()
    .filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
}

function whoami(req) {
  const h = req.headers;
  return {
    answeredBy: os.hostname(),
    backendPrivateIPs: privateIPs(),
    backendPort: PORT,
    time: new Date().toISOString(),
    // The address the backend sees on the TCP connection. Behind a proxy, this is the proxy.
    socketRemoteAddress: (req.socket.remoteAddress || '').replace('::ffff:', ''),
    // Headers a proxy typically adds to tell the backend who the real client was.
    xForwardedFor: h['x-forwarded-for'] || null,
    xRealIp: h['x-real-ip'] || null,
    xForwardedProto: h['x-forwarded-proto'] || null,
    xForwardedHost: h['x-forwarded-host'] || null,
    host: h['host'] || null,
    via: h['via'] || null,
    userAgent: h['user-agent'] || null,
  };
}

function send(res, code, type, body) {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/') return send(res, 200, 'text/html; charset=utf-8', PAGE);
  if (url === '/api/courses') return send(res, 200, 'application/json', JSON.stringify(courses));
  if (url === '/api/whoami') {
    const info = whoami(req);
    log.unshift({ time: info.time, from: info.socketRemoteAddress, forwardedFor: info.xForwardedFor, host: info.host });
    log.length = Math.min(log.length, 8);
    return send(res, 200, 'application/json', JSON.stringify({ ...info, recent: log }));
  }
  send(res, 404, 'application/json', JSON.stringify({ error: 'Not found' }));
}).listen(PORT, HOST, () => console.log(`Learning platform running on http://${HOST}:${PORT}`));

const PAGE = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DevOpsHub: learn how the internet fits together</title>
<style>
  :root {
    --paper:#F6F8FB; --ink:#1B2540; --muted:#5C6784; --line:#DDE3EE;
    --teal:#0E8F7E; --teal-soft:#DDF3EF; --amber:#E9A62B; --white:#fff;
    --font: "Avenir Next", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  }
  * { box-sizing:border-box; }
  body { margin:0; font-family:var(--font); background:var(--paper); color:var(--ink); line-height:1.5; }
  a { color:inherit; }
  :focus-visible { outline:3px solid var(--amber); outline-offset:2px; }
  .shell { display:grid; grid-template-columns:230px 1fr; min-height:100vh; }
  aside { background:var(--ink); color:#E8ECF6; padding:28px 22px; position:sticky; top:0; height:100vh; }
  .brand { font-size:21px; font-weight:700; letter-spacing:.2px; margin-bottom:34px; display:flex; gap:10px; align-items:center; }
  .brand i { width:14px; height:22px; border-radius:6px 6px 4px 4px; background:var(--amber); display:inline-block; box-shadow:0 0 14px rgba(233,166,43,.7); }
  nav a { display:block; padding:10px 12px; border-radius:8px; text-decoration:none; color:#B9C2DA; margin-bottom:2px; }
  nav a.on, nav a:hover { background:rgba(255,255,255,.09); color:#fff; }
  main { padding:36px clamp(20px,4vw,56px) 64px; max-width:1100px; }
  h1 { font-size:clamp(28px,3.4vw,40px); line-height:1.15; margin:0 0 6px; letter-spacing:-.5px; }
  .sub { color:var(--muted); margin:0 0 30px; max-width:60ch; }

  /* The one memorable thing: a live request path */
  .path { background:var(--white); border:1px solid var(--line); border-radius:14px; padding:22px; margin-bottom:36px; }
  .path-head { display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap; margin-bottom:18px; }
  .path-head h2 { margin:0; font-size:18px; }
  button { font:inherit; background:var(--teal); color:#fff; border:0; padding:10px 16px; border-radius:8px; font-weight:600; cursor:pointer; }
  button:hover { background:#0B7A6B; }
  .hops { display:grid; grid-template-columns:1fr 36px 1fr 36px 1fr; align-items:stretch; gap:0; }
  .hop { border:1.5px solid var(--line); border-radius:10px; padding:14px; background:var(--paper); min-width:0; }
  .hop.proxy { border-color:var(--teal); background:var(--teal-soft); }
  .hop h3 { margin:0 0 8px; font-size:15px; }
  .hop p { margin:0; font-size:13px; color:var(--muted); }
  .hop dl { margin:10px 0 0; font-size:13px; }
  .hop dt { color:var(--muted); font-size:12px; margin-top:6px; }
  .hop dd { margin:0; font-weight:600; word-break:break-all; font-variant-numeric:tabular-nums; }
  .arrow { display:flex; align-items:center; justify-content:center; color:var(--teal); font-size:22px; }
  .verdict { margin:16px 0 0; padding:12px 14px; border-radius:8px; background:var(--paper); font-size:14px; }
  .verdict.ok { background:var(--teal-soft); }
  .recent { margin-top:16px; font-size:13px; border-top:1px solid var(--line); padding-top:12px; }
  .recent table { width:100%; border-collapse:collapse; }
  .recent th, .recent td { text-align:left; padding:5px 8px 5px 0; }
  .recent th { color:var(--muted); font-weight:600; }

  .section-title { display:flex; justify-content:space-between; align-items:baseline; margin:0 0 14px; }
  .section-title h2 { margin:0; font-size:20px; }
  .filters { display:flex; gap:8px; flex-wrap:wrap; }
  .chip { background:var(--white); color:var(--ink); border:1px solid var(--line); padding:6px 12px; font-weight:500; font-size:14px; border-radius:999px; }
  .chip:hover { background:var(--teal-soft); }
  .chip[aria-pressed="true"] { background:var(--ink); color:#fff; border-color:var(--ink); }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(250px,1fr)); gap:16px; }
  .course { background:var(--white); border:1px solid var(--line); border-radius:12px; padding:18px; display:flex; flex-direction:column; gap:10px; }
  .course h3 { margin:0; font-size:17px; line-height:1.3; }
  .meta { color:var(--muted); font-size:13px; }
  .bar { height:7px; border-radius:99px; background:var(--line); overflow:hidden; }
  .bar span { display:block; height:100%; background:var(--amber); border-radius:99px; }
  .course .go { margin-top:auto; align-self:flex-start; background:transparent; color:var(--teal); border:1.5px solid var(--teal); padding:7px 14px; }
  .course .go:hover { background:var(--teal); color:#fff; }

  @media (max-width:860px) {
    .shell { grid-template-columns:1fr; }
    aside { position:static; height:auto; padding:16px 20px; }
    .brand { margin-bottom:10px; } nav { display:flex; gap:4px; flex-wrap:wrap; }
    .hops { grid-template-columns:1fr; } .arrow { transform:rotate(90deg); padding:6px 0; }
  }
  @media (prefers-reduced-motion:no-preference) { button { transition:background .15s; } }
</style>
</head>
<body>
<div class="shell">
  <aside>
    <div class="brand"><i></i>DevOpsHub</div>
    <nav aria-label="Main">
      <a class="on" href="#">My courses</a><a href="#">Catalog</a><a href="#">Practice labs</a><a href="#">Certificates</a><a href="#">Settings</a>
    </nav>
  </aside>
  <main>
    <h1>Welcome back, Sadiq</h1>
    <p class="sub">You are 3 lessons from finishing HTTP in Depth. Pick up where you left off.</p>

    <section class="path" aria-labelledby="pt">
      <div class="path-head">
        <h2 id="pt">Where did this page come from?</h2>
        <button id="trace">Trace this request</button>
      </div>
      <div class="hops">
        <div class="hop"><h3>Your browser</h3><p>Sent the request to the public address in the URL bar.</p>
          <dl><dt>You typed</dt><dd id="b-host">-</dd></dl></div>
        <div class="arrow" aria-hidden="true">&rarr;</div>
        <div class="hop proxy"><h3>Proxy server</h3><p>Has the public IP. Forwards your request inward.</p>
          <dl><dt>Backend saw it connect from</dt><dd id="p-ip">-</dd><dt>Told backend your IP is</dt><dd id="p-xff">-</dd></dl></div>
        <div class="arrow" aria-hidden="true">&rarr;</div>
        <div class="hop"><h3>Backend server</h3><p>Has no public IP. Only the proxy can reach it.</p>
          <dl><dt>Hostname</dt><dd id="s-name">-</dd><dt>Private IP</dt><dd id="s-ip">-</dd></dl></div>
      </div>
      <p class="verdict" id="verdict">Select Trace this request to see what each server saw.</p>
      <div class="recent" id="recent" hidden>
        <strong>Last requests the backend received</strong>
        <table><thead><tr><th>Time</th><th>Connected from</th><th>Forwarded for</th></tr></thead><tbody id="rows"></tbody></table>
      </div>
    </section>

    <div class="section-title"><h2>Courses</h2>
      <div class="filters" id="filters" role="group" aria-label="Filter by topic"></div></div>
    <div class="grid" id="grid" aria-live="polite"></div>
  </main>
</div>
<script>
  const $ = id => document.getElementById(id);
  let courses = [], tag = 'All';

  function renderCourses() {
    $('grid').innerHTML = courses.filter(c => tag === 'All' || c.tag === tag).map(c => \`
      <article class="course">
        <span class="meta">\${c.tag} &middot; \${c.level}</span>
        <h3>\${c.title}</h3>
        <span class="meta">\${c.lessons} lessons</span>
        <div class="bar" role="img" aria-label="\${c.progress}% complete"><span style="width:\${c.progress}%"></span></div>
        <button class="go">\${c.progress === 0 ? 'Start course' : c.progress === 100 ? 'Review course' : 'Continue course'}</button>
      </article>\`).join('');
  }
  function renderFilters() {
    const tags = ['All', ...new Set(courses.map(c => c.tag))];
    $('filters').innerHTML = tags.map(t => \`<button class="chip" aria-pressed="\${t === tag}" data-t="\${t}">\${t}</button>\`).join('');
    document.querySelectorAll('.chip').forEach(b => b.onclick = () => { tag = b.dataset.t; renderFilters(); renderCourses(); });
  }

  async function trace() {
    const r = await fetch('/api/whoami'); const d = await r.json();
    $('b-host').textContent = location.host;
    $('p-ip').textContent = d.socketRemoteAddress;
    $('p-xff').textContent = d.xForwardedFor || 'not provided';
    $('s-name').textContent = d.answeredBy;
    $('s-ip').textContent = d.backendPrivateIPs.join(', ') || 'unknown';
    const v = $('verdict');
    if (d.xForwardedFor) {
      v.className = 'verdict ok';
      v.textContent = 'A proxy is in the middle. The backend sees the proxy as the caller (' + d.socketRemoteAddress + ') and learns your real IP (' + d.xForwardedFor.split(',')[0] + ') only from the X-Forwarded-For header.';
    } else {
      v.className = 'verdict';
      v.textContent = 'No proxy headers found. This request reached the backend directly, so the caller is ' + d.socketRemoteAddress + '.';
    }
    $('recent').hidden = false;
    $('rows').innerHTML = d.recent.map(e => '<tr><td>' + new Date(e.time).toLocaleTimeString() + '</td><td>' + e.from + '</td><td>' + (e.forwardedFor || '-') + '</td></tr>').join('');
  }

  $('trace').onclick = trace;
  fetch('/api/courses').then(r => r.json()).then(d => { courses = d; renderFilters(); renderCourses(); });
</script>
</body>
</html>`;
