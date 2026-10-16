const $ = id => document.getElementById(id);
const BUCKET = 'music';
const ICON_PLAY = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
const ICON_LOADING = '<svg class="spin" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/></svg>';

/* Publishable key được thiết kế để công khai. Bảo mật nằm ở RLS + đăng nhập. */
const SUPABASE_URL = 'https://qkzeyhvfokiyxoyjeqij.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LedPdzZbijxM2LuXpfTw9w_KFBh1Qvj';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let user = null, isAdmin = false, songs = [], idx = -1, shuffle = false, repeat = false, activeTab = 'all';
const urlCache = new Map();
const audio = new Audio();
audio.preload = 'auto';
audio.volume = 0.8;
const prefetchAudio = new Audio();
prefetchAudio.preload = 'auto';

function getAudioDuration(file) {
  return new Promise(resolve => {
    const a = new Audio();
    const url = URL.createObjectURL(file);
    a.src = url;
    a.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Math.round(a.duration) || 0);
    };
    a.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
  });
}

const say = t => { $('msg').textContent = t || ''; };
const show = name => ['login', 'app'].forEach(n => $(n).hidden = n !== name);
const fmt = t => isFinite(t) ? Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0') : '0:00';

/* ---------- Khởi động (không tự phát nhạc) ---------- */
async function init() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) { user = session.user; await enterApp(); } else show('login');
}

let realtimeSub = null;

function subscribeSongsRealtime() {
  if (realtimeSub) sb.removeChannel(realtimeSub);
  realtimeSub = sb
    .channel('realtime:songs')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'songs' }, async payload => {
      const curId = idx >= 0 && songs[idx] ? songs[idx].id : null;
      await loadSongs(false);
      if (curId) idx = songs.findIndex(s => s.id === curId);
      render();

      if (payload.eventType === 'INSERT') {
        say('✨ Có bài hát mới vừa được thêm!');
        setTimeout(() => { if ($('msg').textContent.includes('Có bài hát mới')) say(''); }, 4000);
      }
    })
    .subscribe();
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
  if (realtimeSub) { sb.removeChannel(realtimeSub); realtimeSub = null; }
  await sb.auth.signOut();
  user = null; isAdmin = false; songs = []; idx = -1; show('login');
};

/* ---------- Danh sách bài ---------- */
async function enterApp() {
  const { data } = await sb.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
  isAdmin = !!data;
  $('addBox').hidden = !isAdmin;
  $('adminStats').hidden = !isAdmin;
  $('who').textContent = '👤 ' + user.email + (isAdmin ? ' · Admin' : ' · Người nghe');
  show('app');

  if (isAdmin) {
    await loadTodayVisits();
  } else {
    await trackUserVisit();
  }

  await loadSongs();
  subscribeSongsRealtime();
}

async function trackUserVisit() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const key = 'last_visit_' + user.id;
    if (localStorage.getItem(key) === today) return;
    const { error } = await sb.from('user_visits').upsert({ user_id: user.id, visit_date: today }, { onConflict: 'user_id,visit_date' });
    if (!error) localStorage.setItem(key, today);
  } catch (e) {
    console.warn('Lỗi ghi nhận truy cập:', e);
  }
}

async function loadTodayVisits() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { count, error } = await sb.from('user_visits').select('*', { count: 'exact', head: true }).eq('visit_date', today);
    if (!error && count !== null) $('todayVisitors').textContent = count;
  } catch (e) {
    console.warn('Lỗi tải thống kê truy cập:', e);
  }
}

async function loadSongs(shouldSync = true) {
  const { data, error } = await sb.from('songs').select('*').order('created_at', { ascending: true });
  if (error) return say('Không tải được danh sách: ' + error.message);
  songs = data; render();
  if (shouldSync) syncOldSongsDuration();
}

async function syncOldSongsDuration() {
  const pending = songs.filter(s => !s.duration);
  if (!pending.length) return;

  for (const s of pending) {
    try {
      const { data } = await sb.storage.from(BUCKET).createSignedUrl(s.file_path, 300);
      if (!data?.signedUrl) continue;
      const dur = await new Promise(resolve => {
        const temp = new Audio();
        temp.src = data.signedUrl;
        temp.onloadedmetadata = () => resolve(Math.round(temp.duration) || 0);
        temp.onerror = () => resolve(0);
      });
      if (dur > 0) {
        s.duration = dur;
        await sb.from('songs').update({ duration: dur }).eq('id', s.id);
        render();
      }
    } catch (e) {
      console.warn('Lỗi đồng bộ thời lượng bài cũ:', e);
    }
  }
}

function getFilteredSongs() {
  if (activeTab === 'short') return songs.filter(s => (s.duration || 0) > 0 && s.duration < 300);
  if (activeTab === 'long') return songs.filter(s => (s.duration || 0) >= 300);
  return songs;
}

function updateTabCounts() {
  const shortCount = songs.filter(s => (s.duration || 0) > 0 && s.duration < 300).length;
  const longCount = songs.filter(s => (s.duration || 0) >= 300).length;
  if ($('countAll')) $('countAll').textContent = songs.length;
  if ($('countShort')) $('countShort').textContent = shortCount;
  if ($('countLong')) $('countLong').textContent = longCount;
}

function render() {
  updateTabCounts();
  const filtered = getFilteredSongs();
  $('empty').hidden = filtered.length > 0;
  const ul = $('list'); ul.innerHTML = '';

  filtered.forEach(s => {
    const origIndex = songs.findIndex(item => item.id === s.id);
    const li = document.createElement('li');
    if (origIndex === idx) li.className = 'cur';

    const durLabel = s.duration ? fmt(s.duration) : '';
    li.innerHTML = '<span class="n"></span><span class="t"></span>' +
      (durLabel ? `<span class="dur-tag">${durLabel}</span>` : '') +
      (isAdmin ? '<button title="Xóa">✕</button>' : '');

    li.children[0].textContent = origIndex + 1;
    li.children[1].textContent = s.title;
    li.onclick = () => play(origIndex);

    const delBtn = li.querySelector('button');
    if (delBtn) {
      delBtn.onclick = e => { e.stopPropagation(); removeSong(origIndex); };
    }

    ul.appendChild(li);
  });

  $('now').textContent = idx >= 0 && songs[idx] ? songs[idx].title : 'Chưa chọn bài';
  $('pp').innerHTML = audio.paused ? ICON_PLAY : ICON_PAUSE;
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeTab = btn.dataset.tab;
    render();
  };
});

function uploadFileWithProgress(path, file, token, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`);
    xhr.setRequestHeader('apikey', SUPABASE_KEY);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', file.type || 'audio/mpeg');

    xhr.upload.onprogress = e => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error('Lỗi tải lên: ' + xhr.statusText));
    };
    xhr.onerror = () => reject(new Error('Lỗi kết nối tải lên'));
    xhr.send(file);
  });
}

/* ---------- Thêm bài ---------- */
$('file').onchange = async e => {
  if (!isAdmin) return;
  const files = [...e.target.files];
  if (!files.length) return;

  const { data: { session } } = await sb.auth.getSession();
  const token = session?.access_token;
  if (!token) return say('Phiên đăng nhập hết hạn');

  $('uploadProgress').hidden = false;
  const errors = [];

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    $('uploadStatus').innerHTML = `<span>[${i + 1}/${files.length}] ${f.name}</span> <span id="uploadPct">0%</span>`;
    $('uploadBar').style.width = '0%';

    const duration = await getAudioDuration(f);
    const ext = (f.name.split('.').pop() || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

    try {
      await uploadFileWithProgress(path, f, token, pct => {
        $('uploadBar').style.width = pct + '%';
        const p = $('uploadPct'); if (p) p.textContent = pct + '%';
      });

      const title = f.name.replace(/\.[^.]+$/, '');
      const ins = await sb.from('songs').insert({ title, file_path: path, duration });
      if (ins.error) {
        errors.push('Lưu DB: ' + ins.error.message);
        await sb.storage.from(BUCKET).remove([path]);
      }
    } catch (err) {
      errors.push(err.message || 'Lỗi tải file');
    }
  }

  $('uploadProgress').hidden = true;
  e.target.value = '';
  const curId = idx >= 0 ? songs[idx]?.id : null;
  await loadSongs();
  if (curId) idx = songs.findIndex(s => s.id === curId);
  render();
  say(errors.length ? '❌ ' + errors[0] : '✅ Đã tải xong ' + files.length + ' bài');
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

/* ---------- Phát nhạc (có cache URL & prefetch bài tiếp) ---------- */
async function getSongUrl(song) {
  if (!song) return null;
  const now = Date.now();
  const cached = urlCache.get(song.id);
  if (cached && cached.expiresAt > now + 60000) return cached.url;

  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(song.file_path, 3600);
  if (error || !data?.signedUrl) return null;
  urlCache.set(song.id, { url: data.signedUrl, expiresAt: now + 3500 * 1000 });
  return data.signedUrl;
}

function prefetchNextSong() {
  const next = nextIdx();
  if (next < songs.length && songs[next]) {
    getSongUrl(songs[next]).then(url => {
      if (url && prefetchAudio.src !== url) prefetchAudio.src = url;
    });
  }
}

async function play(i) {
  if (!songs.length) return;
  idx = (i + songs.length) % songs.length;
  render();

  $('pp').innerHTML = ICON_LOADING;
  say('⏳ Đang tải bài...');

  const currentSong = songs[idx];
  const url = await getSongUrl(currentSong);
  if (!url) {
    say('Không lấy được link phát nhạc');
    $('pp').innerHTML = ICON_PLAY;
    return;
  }

  if (audio.src !== url) {
    audio.src = url;
  }
  audio.play().then(() => {
    say('');
    prefetchNextSong();
  }).catch(() => {
    say('');
  });

  if (!currentSong.duration) {
    audio.onloadedmetadata = async () => {
      const dur = Math.round(audio.duration) || 0;
      if (dur > 0 && songs[idx] && songs[idx].id === currentSong.id) {
        songs[idx].duration = dur;
        await sb.from('songs').update({ duration: dur }).eq('id', currentSong.id);
        render();
      }
    };
  }
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

audio.onwaiting = () => { $('pp').innerHTML = ICON_LOADING; };
audio.onplaying = () => { $('pp').innerHTML = ICON_PAUSE; };
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
