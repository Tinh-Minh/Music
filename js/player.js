import { $, sb, BUCKET, ICON_PLAY, ICON_PAUSE, state, say, fmt } from './config.js';
import { t } from './i18n.js';

export const audio = new Audio();
audio.volume = Number(localStorage.getItem('nhac_volume') ?? 0.8);

let onRenderCallback = null;
let lastSaveSec = 0;

export function setPlayerRenderCallback(fn) {
  onRenderCallback = fn;
}

function triggerRender() {
  if (typeof onRenderCallback === 'function') onRenderCallback();
}

/* ---------- Đếm lượt nghe chống spam theo phiên ---------- */
const countedPlays = new Set();
async function recordPlayCount(song) {
  if (!song || countedPlays.has(song.id)) return;
  countedPlays.add(song.id);
  song.play_count = (song.play_count || 0) + 1;
  triggerRender();
  try {
    await sb.rpc('increment_play_count', { song_id: song.id });
  } catch (_) {}
}

/* ---------- Phát nhạc ---------- */
export async function play(i, seekToSeconds = 0) {
  if (!state.songs.length) return;
  state.idx = (i + state.songs.length) % state.songs.length;
  const song = state.songs[state.idx];
  triggerRender();
  renderLyrics(song);

  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(song.file_path, 3600);
  if (error || !data?.signedUrl) return say('Không phát được: ' + (error?.message || 'Lỗi link'));

  audio.src = data.signedUrl;
  audio.playbackRate = Number($('speedSelect')?.value || 1);

  if (seekToSeconds > 0) {
    audio.currentTime = seekToSeconds;
  }

  audio.play().then(() => {
    recordPlayCount(song);
    syncAndroidKeepAlive(song.title);
  }).catch(() => {});

  // Lưu bài đang nghe vào localStorage
  localStorage.setItem('nhac_resume', JSON.stringify({ songId: song.id, time: seekToSeconds || 0 }));

  if (!song.duration && state.isAdmin) {
    audio.onloadedmetadata = async () => {
      const dur = Math.round(audio.duration) || 0;
      if (dur > 0 && state.songs[state.idx]) {
        state.songs[state.idx].duration = dur;
        await sb.from('songs').update({ duration: dur }).eq('id', state.songs[state.idx].id);
        triggerRender();
      }
    };
  }
}

export function nextIdx() {
  if (state.queue.length > 0) {
    const nextSongId = state.queue.shift();
    renderQueue();
    const found = state.songs.findIndex(s => s.id === nextSongId);
    if (found >= 0) return found;
  }
  if (state.shuffle && state.songs.length > 1) {
    let r;
    do {
      r = Math.floor(Math.random() * state.songs.length);
    } while (r === state.idx);
    return r;
  }
  return state.idx + 1;
}

export function enqueueSong(songId) {
  const s = state.songs.find(x => x.id === songId);
  if (!s) return;
  state.queue.push(songId);
  renderQueue();
  say(`📜 Đã thêm "${s.title}" vào hàng đợi phát tiếp`);
  setTimeout(() => say(''), 2500);
}

export function renderQueue() {
  const box = $('queueBox');
  const ul = $('queueList');
  if (!box || !ul) return;
  box.hidden = state.queue.length === 0;
  ul.innerHTML = '';
  state.queue.forEach((id, qIdx) => {
    const s = state.songs.find(x => x.id === id);
    if (!s) return;
    const li = document.createElement('li');
    li.className = 'queue-item';
    li.innerHTML = `<span class="q-title"></span><button class="q-rm" title="Bỏ khỏi hàng đợi">✕</button>`;
    li.querySelector('.q-title').textContent = `${qIdx + 1}. ${s.title}`;
    li.querySelector('.q-rm').onclick = e => {
      e.stopPropagation();
      state.queue.splice(qIdx, 1);
      renderQueue();
    };
    li.onclick = () => {
      state.queue.splice(qIdx, 1);
      renderQueue();
      const idx = state.songs.findIndex(x => x.id === id);
      if (idx >= 0) play(idx);
    };
    ul.appendChild(li);
  });
}

/* ---------- Lời bài hát (Lyrics đồng bộ theo dòng thời gian [mm:ss] hoặc văn bản thường) ---------- */
let parsedLrc = [];
export function renderLyrics(song) {
  const box = $('lyricsContent');
  if (!box) return;
  parsedLrc = [];
  if (!song || !song.lyrics || !song.lyrics.trim()) {
    box.innerHTML = `<div class="lyrics-empty">${t('lyricsEmpty')}</div>`;
    return;
  }
  const lines = song.lyrics.split(/\r?\n/);
  const lrcRegex = /^\[(\d{1,2}):(\d{2})(?:\.\d{1,3})?\](.*)$/;
  lines.forEach(line => {
    const m = line.match(lrcRegex);
    if (m) {
      const sec = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
      parsedLrc.push({ time: sec, text: m[3].trim() || '♪' });
    } else {
      parsedLrc.push({ time: -1, text: line });
    }
  });

  box.innerHTML = '';
  parsedLrc.forEach((item, i) => {
    const p = document.createElement('div');
    p.className = 'lyric-line';
    p.dataset.idx = i;
    p.textContent = item.text;
    if (item.time >= 0) {
      p.onclick = () => {
        audio.currentTime = item.time;
      };
    }
    box.appendChild(p);
  });
}

function syncLyricsHighlight(currentTime) {
  if (!parsedLrc.length) return;
  let activeIdx = -1;
  for (let i = 0; i < parsedLrc.length; i++) {
    if (parsedLrc[i].time >= 0 && currentTime >= parsedLrc[i].time) {
      activeIdx = i;
    }
  }
  if (activeIdx < 0) return;
  const container = $('lyricsContent');
  if (!container) return;
  container.querySelectorAll('.lyric-line').forEach((el, idx) => {
    const isAct = idx === activeIdx;
    el.classList.toggle('active', isAct);
    if (isAct && !$('lyricsPanel')?.hidden) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

/* ---------- Khôi phục vị trí nghe dở & Deep Link ?song=<id> ---------- */
export function restorePlaybackOrDeepLink() {
  const params = new URLSearchParams(location.search);
  const sharedSongId = params.get('song');
  if (sharedSongId) {
    const foundIdx = state.songs.findIndex(s => s.id === sharedSongId);
    if (foundIdx >= 0) {
      state.idx = foundIdx;
      triggerRender();
      renderLyrics(state.songs[foundIdx]);
      say(`🔗 Đã mở bài được chia sẻ: "${state.songs[foundIdx].title}" (Bấm Play để phát)`);
      return;
    }
  }

  try {
    const saved = JSON.parse(localStorage.getItem('nhac_resume') || 'null');
    if (!saved || !saved.songId) return;
    const foundIdx = state.songs.findIndex(s => s.id === saved.songId);
    if (foundIdx >= 0) {
      state.idx = foundIdx;
      const s = state.songs[foundIdx];
      triggerRender();
      renderLyrics(s);
      if (saved.time > 0) {
        $('cur').textContent = fmt(saved.time);
        if (s.duration) {
          $('dur').textContent = fmt(s.duration);
          const pct = Math.min(100, (saved.time / s.duration) * 100);
          $('seek').value = pct * 10;
          $('seek').style.setProperty('--p', pct + '%');
        }
      }
    }
  } catch (_) {}
}

/* ---------- Hẹn giờ tắt nhạc & Tốc độ phát ---------- */
function setupSleepTimerAndSpeed() {
  const speedSel = $('speedSelect');
  if (speedSel) {
    speedSel.onchange = e => {
      audio.playbackRate = Number(e.target.value) || 1;
    };
  }

  const sleepSel = $('sleepSelect');
  const sleepBadge = $('sleepCountdown');
  if (sleepSel) {
    sleepSel.onchange = e => {
      if (state.sleepTimerId) {
        clearInterval(state.sleepTimerId);
        state.sleepTimerId = null;
      }
      const mins = Number(e.target.value);
      if (!mins) {
        if (sleepBadge) sleepBadge.hidden = true;
        return;
      }
      state.sleepEndAt = Date.now() + mins * 60000;
      if (sleepBadge) sleepBadge.hidden = false;
      state.sleepTimerId = setInterval(() => {
        const remain = Math.max(0, Math.round((state.sleepEndAt - Date.now()) / 1000));
        if (sleepBadge) sleepBadge.textContent = '⏳ ' + fmt(remain);
        if (remain <= 0) {
          clearInterval(state.sleepTimerId);
          state.sleepTimerId = null;
          audio.pause();
          sleepSel.value = '0';
          if (sleepBadge) sleepBadge.hidden = true;
          say('😴 Đã tự động tạm dừng nhạc theo hẹn giờ');
        }
      }, 1000);
    };
  }
}

/* ---------- Phím tắt bàn phím (Space, Mũi tên) ---------- */
function setupHotkeys() {
  window.addEventListener('keydown', e => {
    const tag = (e.target?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) return;

    if (e.code === 'Space') {
      e.preventDefault();
      $('pp')?.click();
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      if (audio.duration) audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      if (audio.duration) audio.currentTime = Math.max(0, audio.currentTime - 5);
    } else if (e.code === 'ArrowUp') {
      e.preventDefault();
      const v = Math.min(1, +(audio.volume + 0.05).toFixed(2));
      audio.volume = v;
      if ($('vol')) {
        $('vol').value = Math.round(v * 100);
        $('vol').style.setProperty('--p', Math.round(v * 100) + '%');
      }
      localStorage.setItem('nhac_volume', v);
    } else if (e.code === 'ArrowDown') {
      e.preventDefault();
      const v = Math.max(0, +(audio.volume - 0.05).toFixed(2));
      audio.volume = v;
      if ($('vol')) {
        $('vol').value = Math.round(v * 100);
        $('vol').style.setProperty('--p', Math.round(v * 100) + '%');
      }
      localStorage.setItem('nhac_volume', v);
    }
  });
}

/* ---------- Khởi tạo điều khiển Player & MediaSession ---------- */
export function initPlayerControls() {
  if ($('vol')) {
    const initVol = Math.round(audio.volume * 100);
    $('vol').value = initVol;
    $('vol').style.setProperty('--p', initVol + '%');
  }

  $('pp').onclick = () => {
    if (state.idx < 0) return play(0);
    if (!audio.src) {
      let resumeSec = 0;
      try {
        const saved = JSON.parse(localStorage.getItem('nhac_resume') || 'null');
        if (saved && saved.songId === state.songs[state.idx]?.id) resumeSec = saved.time || 0;
      } catch (_) {}
      return play(state.idx, resumeSec);
    }
    audio.paused ? audio.play() : audio.pause();
  };

  $('next').onclick = () => play(nextIdx());
  $('prev').onclick = () => {
    audio.currentTime > 3 ? (audio.currentTime = 0) : play(state.idx - 1);
  };
  $('shuf').onclick = () => {
    state.shuffle = !state.shuffle;
    $('shuf').classList.toggle('on', state.shuffle);
  };
  $('rep').onclick = () => {
    state.repeat = !state.repeat;
    $('rep').classList.toggle('on', state.repeat);
  };
  $('vol').oninput = e => {
    audio.volume = e.target.value / 100;
    e.target.style.setProperty('--p', e.target.value + '%');
    localStorage.setItem('nhac_volume', audio.volume);
  };
  $('seek').oninput = e => {
    e.target.style.setProperty('--p', e.target.value / 10 + '%');
    if (audio.duration) audio.currentTime = (e.target.value / 1000) * audio.duration;
  };

  const lyricsBtn = $('toggleLyricsBtn');
  if (lyricsBtn) {
    lyricsBtn.onclick = () => {
      const panel = $('lyricsPanel');
      if (panel) {
        panel.hidden = !panel.hidden;
        lyricsBtn.classList.toggle('on', !panel.hidden);
      }
    };
  }

  audio.ontimeupdate = () => {
    $('cur').textContent = fmt(audio.currentTime);
    $('dur').textContent = fmt(audio.duration);
    if (audio.duration) {
      $('seek').value = (audio.currentTime / audio.duration) * 1000;
      $('seek').style.setProperty('--p', (audio.currentTime / audio.duration) * 100 + '%');
    }
    syncLyricsHighlight(audio.currentTime);

    // Lưu vị trí đang phát mỗi 3 giây
    const nowSec = Math.floor(audio.currentTime);
    if (nowSec !== lastSaveSec && nowSec % 3 === 0 && state.idx >= 0 && state.songs[state.idx]) {
      lastSaveSec = nowSec;
      localStorage.setItem('nhac_resume', JSON.stringify({
        songId: state.songs[state.idx].id,
        time: nowSec
      }));
    }
  };

  audio.onplay = audio.onpause = () => {
    $('pp').innerHTML = audio.paused ? ICON_PLAY : ICON_PAUSE;
  };

  audio.onended = () => {
    const n = nextIdx();
    if (n >= state.songs.length && !state.repeat && state.queue.length === 0) {
      state.idx = -1;
      audio.removeAttribute('src');
      return triggerRender();
    }
    play(n);
  };

  if ('mediaSession' in navigator) {
    const ms = navigator.mediaSession;
    ms.setActionHandler('play', () => audio.play());
    ms.setActionHandler('pause', () => audio.pause());
    ms.setActionHandler('previoustrack', () => play(state.idx - 1));
    ms.setActionHandler('nexttrack', () => play(nextIdx()));
    ms.setActionHandler('seekto', d => {
      audio.currentTime = d.seekTime;
    });
  }

  audio.addEventListener('play', () => {
    if (!('mediaSession' in navigator) || state.idx < 0 || !state.songs[state.idx]) return;
    const s = state.songs[state.idx];
    const artworkUrl = s.cover_url || new URL('icons/icon-512.png', location.href).href;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: s.title,
      artist: s.artist || 'Nhạc của tôi',
      album: s.genre || 'Nhạc của tôi',
      artwork: [
        { src: artworkUrl, sizes: '192x192', type: 'image/png' },
        { src: artworkUrl, sizes: '512x512', type: 'image/png' }
      ]
    });
  });

  setupSleepTimerAndSpeed();
  setupHotkeys();
  setupAndroidKeepAliveToggle();
}

/* ---------- Bật / Tắt chế độ giữ nhạc phát nền khi vuốt xóa đa nhiệm (Android App) ---------- */
let bgKeepAliveOn = localStorage.getItem('nhac_bg_keep_alive') === '1';

function syncAndroidKeepAlive(titleText) {
  if (window.AndroidBgBridge && typeof window.AndroidBgBridge.setKeepAliveMode === 'function') {
    const curTitle = titleText || (state.idx >= 0 && state.songs[state.idx] ? state.songs[state.idx].title : 'Đang phát nhạc nền');
    window.AndroidBgBridge.setKeepAliveMode(bgKeepAliveOn, curTitle);
  }
}

function setupAndroidKeepAliveToggle() {
  const btn = $('bgKeepAliveBtn');
  if (!btn) return;
  const updateBtnUI = () => {
    btn.classList.toggle('on', bgKeepAliveOn);
    btn.textContent = bgKeepAliveOn ? '🔒 Giữ nền: Bật' : '🔒 Giữ nền: Tắt';
  };
  updateBtnUI();
  syncAndroidKeepAlive();

  btn.onclick = () => {
    bgKeepAliveOn = !bgKeepAliveOn;
    localStorage.setItem('nhac_bg_keep_alive', bgKeepAliveOn ? '1' : '0');
    updateBtnUI();
    syncAndroidKeepAlive();
    say(
      bgKeepAliveOn
        ? '🔒 Đã BẬT giữ phát nền (Nhạc vẫn chạy kể cả khi vuốt xóa đa nhiệm trên App Android)'
        : '🔓 Đã TẮT giữ phát nền (Vuốt đóng tab/app sẽ tắt nhạc ngay)'
    );
  };
}
