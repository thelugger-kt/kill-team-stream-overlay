// Live overlay for the Kill Team Scorecard.
// Pass the scorecard's own query string (game=..., tp=..., leftKill=...), e.g.
//   topbar-a.html?game=match-murlao6g-k8gqu0
// The URL values are shown first; if `game` is present the page joins the scorecard's
// PeerJS room as a read-only client and updates in real time.
// Optional: player1 / player2 (names are not part of the scorecard state), preview=1 (camera mock-up).
const q = new URLSearchParams(location.search);
const $ = s => document.querySelector(s);
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

const KILL_GRADE = {
  5: [1, 2, 3, 4, 5], 6: [1, 2, 4, 5, 6], 7: [1, 3, 4, 6, 7], 8: [2, 3, 5, 6, 8], 9: [2, 4, 5, 7, 9],
  10: [2, 4, 6, 8, 10], 11: [2, 4, 7, 9, 11], 12: [2, 5, 7, 10, 12], 13: [3, 5, 8, 10, 13], 14: [3, 6, 8, 11, 14]
};
const STARTING_OPS = {"Angels of Death":[6],"Battleclade":[10],"Blades of Khaine":[8],"Brood Brothers":[13,11,10,12],"Canoptek Circle":[5],"Celestian Insidiants":[9],"Chaos Cult":[14],"Deathwatch":[5],"Exaction Squad":[11],"Exodite Dragon Masters":[5],"Farstalker Kinband":[12],"Fellgor Ravagers":[10],"Goremongers":[8],"Hand of the Archon":[9],"Hearthkyn Salvagers":[10],"Hernkyn Yaegirs":[10],"Hierotek Circle":[8],"Imperial Navy Breachers":[11,10],"Inquisitorial Agents":[11,10,12],"Kasrkin":[10],"Mandrakes":[9],"Murderwing":[6],"Nemesis Claw":[6],"Plague Marines":[6],"Ratlings":[11],"Raveners":[5],"Sanctifiers":[11],"Scout Squad":[9],"Spectre Squad":[10],"Tempestus Aquilons":[11],"Vespid Stingwings":[10],"Wolf Scouts":[6],"Wrecka Krew":[6],"XV26 Stealth Battlesuits":[5]};

const blankSide = () => ({ team: '', startingOperatives: '', operativesRemaining: 0, scores: { cp: 3, crit: 0, tac: 0 } });
const state = { turningPoint: 0, battleEnded: false, initiative: 'left', left: blankSide(), right: blankSide() };

function fromUrl() {
  state.turningPoint = Math.max(0, Math.min(4, num(q.get('tp'))));
  state.battleEnded = q.get('battleEnded') === 'true' || num(q.get('tp')) >= 5;
  state.initiative = q.get('initiative') === 'right' ? 'right' : 'left';
  ['left', 'right'].forEach(p => {
    const s = state[p];
    s.team = q.get(p + 'Team') || '';
    s.startingOperatives = (STARTING_OPS[s.team] || [''])[0];
    s.operativesRemaining = q.has(p + 'Remaining') ? num(q.get(p + 'Remaining')) : num(s.startingOperatives);
    s.scores.cp = q.has(p + 'Cp') ? num(q.get(p + 'Cp')) : 3;
    s.scores.crit = num(q.get(p + 'Crit'));
    s.scores.tac = num(q.get(p + 'Tac'));
  });
}

const rawKill = p => {
  const o = state[p === 'left' ? 'right' : 'left'];
  const killed = Math.max(0, num(o.startingOperatives) - num(o.operativesRemaining));
  return (KILL_GRADE[num(o.startingOperatives)] || []).reduce((s, t, i) => killed >= t ? i + 1 : s, 0);
};
const killScore = p => {
  const raw = rawKill(p);
  return Math.min(6, raw + (state.battleEnded && raw > rawKill(p === 'left' ? 'right' : 'left') ? 1 : 0));
};

function render() {
  [['left', 1], ['right', 2]].forEach(([p, n]) => {
    const s = state[p];
    const set = (sel, v) => { const el = $(sel); if (el) el.textContent = v; };
    set(`[data-v="crit${n}"]`, s.scores.crit);
    set(`[data-v="kill${n}"]`, killScore(p));
    set(`[data-v="tac${n}"]`, s.scores.tac);
    set(`[data-v="cp${n}"]`, s.scores.cp);
    set(`[data-team="${n}"]`, s.team.toUpperCase());
    set(`[data-player="${n}"]`, q.get('player' + n) || '');
    const img = $(`[data-icon="${n}"]`);
    if (img.dataset.team !== s.team) {
      img.dataset.team = s.team;
      img.style.visibility = s.team ? 'visible' : 'hidden';
      if (s.team) img.src = `assets/icons/${s.team}.png`;
    }
  });
  $('[data-v="tp"]').textContent = state.turningPoint;
  const ini = state.initiative === 'right' ? '2' : '1';
  document.querySelectorAll('[data-init]').forEach(e => e.classList.toggle('on', e.dataset.init === ini));
}
document.querySelectorAll('[data-icon]').forEach(i => { i.onerror = () => { i.style.visibility = 'hidden'; }; });

// Same room-id derivation as the scorecard so we find the same host.
function hostPeerId(game) {
  const slug = game.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 18) || 'main';
  const hash = [...game].reduce((h, c) => ((h * 31) + c.charCodeAt(0)) >>> 0, 7).toString(36);
  return `kill-team-scorecard-${slug}-${hash}`;
}

function startLive(game) {
  const id = hostPeerId(game);
  let peer, timer, poll;
  const retry = () => { clearInterval(poll); clearTimeout(timer); timer = setTimeout(connect, 3000); };
  function connect() {
    try { if (peer) peer.destroy(); } catch (e) {}
    peer = new Peer();
    peer.on('open', () => {
      const c = peer.connect(id, { reliable: true });
      c.on('open', () => { c.send({ type: 'request-state' }); clearInterval(poll); poll = setInterval(() => c.open && c.send({ type: 'request-state' }), 5000); });
      c.on('data', m => {
        if (m.type !== 'state' || !m.state || !m.state.left || !m.state.right) return;
        const st = m.state;
        state.turningPoint = st.turningPoint; state.battleEnded = !!st.battleEnded; state.initiative = st.initiative;
        ['left', 'right'].forEach(p => Object.assign(state[p], st[p], { scores: Object.assign({}, st[p].scores) }));
        render();
      });
      c.on('close', retry);
      c.on('error', retry);
    });
    peer.on('error', retry);
    peer.on('disconnected', retry);
  }
  connect();
}

if (q.get('preview') === '1') {
  const cam = document.createElement('div');
  cam.className = 'cam';
  $('.stage').prepend(cam);
}
fromUrl();
render();
const game = q.get('game');
if (game && window.Peer) startLive(game);

// Prompt for a scorecard URL (or bare game id) plus optional player names; press P to reopen it.
function askForGame() {
  if ($('#gp')) return;
  const box = document.createElement('div');
  box.id = 'gp';
  box.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:1000px;padding:32px;background:#0b0b0b;border:3px solid #e8601c;z-index:9;font:700 24px Arial,sans-serif;color:#fff';
  const field = (id, label) => `<div style="margin:14px 0 6px;letter-spacing:2px">${label}</div><input id="${id}" style="width:100%;box-sizing:border-box;padding:12px;font:22px Arial;background:#151515;color:#fff;border:1px solid #555">`;
  box.innerHTML = field('gp-url', 'SCORECARD URL OR GAME ID') + field('gp-p1', 'LEFT PLAYER NAME (OPTIONAL)') + field('gp-p2', 'RIGHT PLAYER NAME (OPTIONAL)') +
    '<div style="margin-top:14px;font:18px Arial;color:#aaa">Press Enter to connect</div>';
  document.body.appendChild(box);
  const url = box.querySelector('#gp-url'), p1 = box.querySelector('#gp-p1'), p2 = box.querySelector('#gp-p2');
  url.value = localStorage.getItem('ktOverlayUrl') || '';
  p1.value = q.get('player1') ?? localStorage.getItem('ktOverlayP1') ?? '';
  p2.value = q.get('player2') ?? localStorage.getItem('ktOverlayP2') ?? '';
  url.focus(); url.select();
  box.addEventListener('keydown', e => {
    if (e.key === 'Escape' && game) return box.remove();
    if (e.key !== 'Enter') return;
    const raw = url.value.trim();
    if (!raw) return;
    let src;
    try { src = new URL(raw).searchParams; }
    catch (err) { src = raw.includes('=') ? new URLSearchParams(raw.replace(/^\?/, '')) : new URLSearchParams({ game: raw }); }
    if (!src.get('game')) { url.style.borderColor = '#f33'; return; }
    src.delete('player1'); src.delete('player2');
    if (p1.value.trim()) src.set('player1', p1.value.trim());
    if (p2.value.trim()) src.set('player2', p2.value.trim());
    if (q.has('preview')) src.set('preview', q.get('preview'));
    localStorage.setItem('ktOverlayUrl', raw);
    localStorage.setItem('ktOverlayP1', p1.value.trim());
    localStorage.setItem('ktOverlayP2', p2.value.trim());
    location.search = '?' + src.toString();
  });
}
if (!game) askForGame();
document.addEventListener('keydown', e => { if ((e.key === 'p' || e.key === 'P') && e.target.tagName !== 'INPUT') askForGame(); });