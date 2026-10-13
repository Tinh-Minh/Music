const $ = id => document.getElementById(id);
const BUCKET = 'music';
const ICON_PLAY = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';

/* Publishable key được thiết kế để công khai. Bảo mật nằm ở RLS + đăng nhập. */
const SUPABASE_URL = 'https://qkzeyhvfokiyxoyjeqij.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LedPdzZbijxM2LuXpfTw9w_KFBh1Qvj';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let user = null, isAdmin = false, songs = [], idx = -1, shuffle = false, repeat = false;
const audio = new Audio();
audio.volume = 0.8;

const say = t => { $('msg').textContent = t || ''; };
const show = name => ['login', 'app'].forEach(n => $(n).hidden = n !== name);
const fmt = t => isFinite(t) ? Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0') : '0:00';

/* ---------- Khởi động (không tự phát nhạc) ---------- */
async function init() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) { user = session.user; await enterApp(); } else show('login');
}

/* ---------- Đăng nhập / đăng xuất ---------- */
$('loginForm').onsubmit = async e => {
  e.preventDefault();
  say('Đang đăng nhập...');
  const { data, error } = await sb.auth.signInWithPassword({ email: $('email').value.trim(), password: $('pass').value });
  if (error) return say('Sai email hoặc mật khẩu');
  user = data.user; $('pass').value = ''; say('');
  await enterApp();
};
$('logout').onclick = async () => {
  audio.pause(); audio.removeAttribute('src');
  await sb.auth.signOut();
  user = null; isAdmin = false; songs = []; idx = -1; show('login');
};

/* ---------- Danh sách bài ---------- */
async function enterApp() {
  const { data } = await sb.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
  isAdmin = !!data;
  $('addBox').hidden = !isAdmin;
  $('who').textContent = '👤 ' + user.email + (isAdmin ? ' · Admin' : ' · Người nghe');
  show('app');
  await loadSongs();
}
async function loadSongs() {
  const { data, error } = await sb.from('songs').select('*').order('created_at', { ascending: true });
  if (error) return say('Không tải được danh sách: ' + error.message);
  songs = data; render();
}
function render() {
  $('empty').hidden = songs.length > 0;
  const ul = $('list'); ul.innerHTML = '';
  songs.forEach((s, i) => {
    const li = document.createElement('li');
    if (i === idx) li.className = 'cur';
    li.innerHTML = '<span class="n"></span><span class="t"></span>' + (isAdmin ? '<button title="Xóa">✕</button>' : '');
    li.children[0].textContent = i + 1;
    li.children[1].textContent = s.title;
    li.onclick = () => play(i);
    if (isAdmin) li.children[2].onclick = e => { e.stopPropagation(); removeSong(i); };
    ul.appendChild(li);
  });
  $('now').textContent = idx >= 0 && songs[idx] ? songs[idx].title : 'Chưa chọn bài';
  $('pp').innerHTML = audio.paused ? ICON_PLAY : ICON_PAUSE;
}

/* ---------- Thêm bài ---------- */
$('file').onchange = async e => {
  if (!isAdmin) return;
  const files = [...e.target.files];
  const errors = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    say(`Đang tải ${i + 1}/${files.length}: ${f.name}`);
    const ext = (f.name.split('.').pop() || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const up = await sb.storage.from(BUCKET).upload(path, f, { contentType: f.type || 'audio/mpeg' });
    if (up.error) { errors.push('Tải lên: ' + up.error.message); continue; }
    const title = f.name.replace(/\.[^.]+$/, '');
    const ins = await sb.from('songs').insert({ title, file_path: path });
    if (ins.error) { errors.push('Lưu DB: ' + ins.error.message); await sb.storage.from(BUCKET).remove([path]); }
  }
  e.target.value = '';
  const curId = idx >= 0 ? songs[idx]?.id : null;
  await loadSongs();
  if (curId) idx = songs.findIndex(s => s.id === curId);
  render();
  say(errors.length ? '❌ ' + errors[0] : '✅ Đã tải xong');
};

/* ---------- Xóa bài ---------- */
async function removeSong(i) {
  if (!isAdmin) return;
  const s = songs[i];
  if (!confirm(`Xóa "${s.title}"?`)) return;
  await sb.storage.from(BUCKET).remove([s.file_path]);
  const { error } = await sb.from('songs').delete().eq('id', s.id);
  if (error) return say('Lỗi xóa: ' + error.message);
  if (i === idx) { audio.pause(); audio.removeAttribute('src'); idx = -1; }
  else if (i < idx) idx--;
  songs.splice(i, 1); render();
}

/* ---------- Phát nhạc (link tạm thời, hết hạn sau 1 giờ) ---------- */
async function play(i) {
  if (!songs.length) return;
  idx = (i + songs.length) % songs.length;
  render();
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(songs[idx].file_path, 3600);
  if (error) return say('Không phát được: ' + error.message);
  audio.src = data.signedUrl;
  audio.play().catch(() => {});
}
function nextIdx() {
  if (shuffle && songs.length > 1) { let r; do { r = Math.floor(Math.random() * songs.length); } while (r === idx); return r; }
  return idx + 1;
}

/* ---------- Điều khiển ---------- */
$('pp').onclick = () => { if (idx < 0) return play(0); audio.paused ? audio.play() : audio.pause(); };
$('next').onclick = () => play(nextIdx());
$('prev').onclick = () => { audio.currentTime > 3 ? audio.currentTime = 0 : play(idx - 1); };
$('shuf').onclick = () => { shuffle = !shuffle; $('shuf').classList.toggle('on', shuffle); };
$('rep').onclick = () => { repeat = !repeat; $('rep').classList.toggle('on', repeat); };
$('vol').oninput = e => { audio.volume = e.target.value / 100; e.target.style.setProperty('--p', e.target.value + '%'); };
$('seek').oninput = e => { e.target.style.setProperty('--p', (e.target.value / 10) + '%'); if (audio.duration) audio.currentTime = e.target.value / 1000 * audio.duration; };

audio.ontimeupdate = () => {
  $('cur').textContent = fmt(audio.currentTime);
  $('dur').textContent = fmt(audio.duration);
  if (audio.duration) { $('seek').value = audio.currentTime / audio.duration * 1000; $('seek').style.setProperty('--p', (audio.currentTime / audio.duration * 100) + '%'); }
};
audio.onplay = audio.onpause = () => { $('pp').innerHTML = audio.paused ? ICON_PLAY : ICON_PAUSE; };
audio.onended = () => {
  const n = nextIdx();
  if (n >= songs.length && !repeat) { idx = -1; audio.removeAttribute('src'); return render(); }
  play(n);
};

/* ---------- Phát nền: phím media, thông báo, màn hình khóa ---------- */
if ('mediaSession' in navigator) {
  const ms = navigator.mediaSession;
  ms.setActionHandler('play', () => audio.play());
  ms.setActionHandler('pause', () => audio.pause());
  ms.setActionHandler('previoustrack', () => play(idx - 1));
  ms.setActionHandler('nexttrack', () => play(nextIdx()));
  ms.setActionHandler('seekto', d => { audio.currentTime = d.seekTime; });
}
audio.addEventListener('play', () => {
  if (!('mediaSession' in navigator) || idx < 0 || !songs[idx]) return;
  navigator.mediaSession.metadata = new MediaMetadata({ title: songs[idx].title, artist: 'Nhạc của tôi' });
});

init();
