import {
  $,
  sb,
  BUCKET,
  AUDIO_CACHE_NAME,
  ICON_PLAY,
  ICON_PAUSE,
  state,
  say,
  fmt,
  saveFavoritesLocal,
  savePlaylistsLocal,
  saveOfflineLocal
} from './config.js';
import { t } from './i18n.js';
import { audio, play, enqueueSong } from './player.js';
import { syncCloudPreferences } from './auth.js';

let onEditSongCallback = null;
let onRemoveSongCallback = null;
let onUpdateBulkBarCallback = null;
let currentPage = 1;
const PAGE_SIZE = 100;

export function setLibraryAdminCallbacks({ onEdit, onRemove, onBulkChange }) {
  onEditSongCallback = onEdit;
  onRemoveSongCallback = onRemove;
  onUpdateBulkBarCallback = onBulkChange;
}

export async function loadSongs() {
  const { data, error } = await sb.from('songs').select('*').order('created_at', { ascending: true });
  if (error) return say('Không tải được danh sách: ' + error.message);
  state.songs = data || [];
  populateGenreFilter();
  populatePlaylistSelect();
  render();
}

export function populateGenreFilter() {
  const sel = $('genreFilter');
  if (!sel) return;
  const current = state.selectedGenre;
  const genres = [...new Set(state.songs.map(s => (s.genre || '').trim()).filter(Boolean))].sort();
  sel.innerHTML = `<option value="">${t('allGenres')}</option>`;
  genres.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g;
    opt.textContent = g;
    if (g === current) opt.selected = true;
    sel.appendChild(opt);
  });
}

export function populatePlaylistSelect() {
  const sel = $('playlistSelect');
  if (!sel) return;
  const cur = state.activePlaylistId;
  sel.innerHTML = `<option value="">${t('allPlaylists')}</option>`;
  state.playlists.forEach(pl => {
    const opt = document.createElement('option');
    opt.value = pl.id;
    opt.textContent = `📁 ${pl.name} (${pl.songIds?.length || 0})`;
    if (pl.id === cur) opt.selected = true;
    sel.appendChild(opt);
  });
  const delPlBtn = $('deletePlaylistBtn');
  if (delPlBtn) delPlBtn.hidden = !state.activePlaylistId;
}

export function getFilteredSongs() {
  let list = state.songs;

  if (state.activeTab === 'short') {
    list = list.filter(s => (s.duration || 0) > 0 && s.duration < 600);
  } else if (state.activeTab === 'long') {
    list = list.filter(s => (s.duration || 0) >= 600);
  } else if (state.activeTab === 'fav') {
    list = list.filter(s => state.favorites.has(s.id));
  } else if (state.activeTab === 'offline') {
    list = list.filter(s => state.offlineMap.has(s.id));
  }

  if (state.activePlaylistId) {
    const pl = state.playlists.find(p => p.id === state.activePlaylistId);
    if (pl) {
      const set = new Set(pl.songIds || []);
      list = list.filter(s => set.has(s.id));
    }
  }

  if (state.selectedGenre) {
    list = list.filter(s => (s.genre || '').trim() === state.selectedGenre);
  }

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    list = list.filter(
      s =>
        (s.title || '').toLowerCase().includes(q) ||
        (s.artist || '').toLowerCase().includes(q) ||
        (s.genre || '').toLowerCase().includes(q)
    );
  }

  return list;
}

export function updateTabCounts() {
  const shortCount = state.songs.filter(s => (s.duration || 0) > 0 && s.duration < 600).length;
  const longCount = state.songs.filter(s => (s.duration || 0) >= 600).length;
  const favCount = state.songs.filter(s => state.favorites.has(s.id)).length;
  const offCount = state.songs.filter(s => state.offlineMap.has(s.id)).length;

  if ($('countAll')) $('countAll').textContent = state.songs.length;
  if ($('countShort')) $('countShort').textContent = shortCount;
  if ($('countLong')) $('countLong').textContent = longCount;
  if ($('countFav')) $('countFav').textContent = favCount;
  if ($('countOffline')) $('countOffline').textContent = offCount;
}

async function toggleOfflineSong(song) {
  if (!('caches' in window)) return say('Trình duyệt không hỗ trợ lưu offline');
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(song.file_path, 3600);
    if (error || !data?.signedUrl) return say('Không tạo được link tải offline');
    const urlObj = new URL(data.signedUrl);
    const cleanKey = urlObj.origin + urlObj.pathname;

    if (state.offlineMap.has(song.id)) {
      await cache.delete(cleanKey);
      state.offlineMap.delete(song.id);
      saveOfflineLocal();
      render();
      say(`🗑️ Đã xóa bản lưu offline của "${song.title}"`);
    } else {
      say(`📥 Đang tải "${song.title}" để nghe offline...`);
      const res = await fetch(data.signedUrl);
      if (!res.ok) throw new Error('Tải thất bại');
      await cache.put(cleanKey, res.clone());
      state.offlineMap.add(song.id);
      saveOfflineLocal();
      render();
      say(`✅ Đã lưu "${song.title}" nghe offline!`);
    }
  } catch (e) {
    say('Lỗi lưu offline: ' + (e.message || e));
  }
}

function toggleFavorite(songId) {
  if (state.favorites.has(songId)) {
    state.favorites.delete(songId);
  } else {
    state.favorites.add(songId);
  }
  saveFavoritesLocal();
  syncCloudPreferences(true);
  render();
}

function shareSongLink(song) {
  const shareUrl = `${location.origin}${location.pathname}?song=${encodeURIComponent(song.id)}`;
  if (navigator.share) {
    navigator.share({ title: song.title, text: `🎧 Nghe "${song.title}"`, url: shareUrl }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(shareUrl);
    say(`🔗 Đã sao chép link chia sẻ bài "${song.title}"!`);
    setTimeout(() => say(''), 3000);
  } else {
    prompt('Sao chép link bài hát:', shareUrl);
  }
}

function addSongToPlaylistPrompt(song) {
  if (!state.playlists.length) {
    const name = prompt('Bạn chưa có playlist nào. Nhập tên để tạo playlist mới:');
    if (!name || !name.trim()) return;
    const pl = { id: crypto.randomUUID(), name: name.trim(), songIds: [song.id] };
    state.playlists.push(pl);
    savePlaylistsLocal();
    syncCloudPreferences(true);
    populatePlaylistSelect();
    say(`📁 Đã tạo playlist "${pl.name}" và thêm bài hát!`);
    return;
  }

  const listStr = state.playlists.map((p, idx) => `${idx + 1}. ${p.name}`).join('\n');
  const choice = prompt(`Chọn số thứ tự Playlist để thêm "${song.title}":\n${listStr}`);
  const num = parseInt(choice, 10);
  if (!num || num < 1 || num > state.playlists.length) return;
  const pl = state.playlists[num - 1];
  if (!Array.isArray(pl.songIds)) pl.songIds = [];
  if (!pl.songIds.includes(song.id)) {
    pl.songIds.push(song.id);
    savePlaylistsLocal();
    syncCloudPreferences(true);
    populatePlaylistSelect();
    say(`📁 Đã thêm vào playlist "${pl.name}"`);
  } else {
    say(`Bài hát đã có sẵn trong "${pl.name}"`);
  }
}

export function render() {
  updateTabCounts();
  const filtered = getFilteredSongs();
  $('empty').hidden = filtered.length > 0;
  const ul = $('list');
  ul.innerHTML = '';

  const maxItems = currentPage * PAGE_SIZE;
  const visible = filtered.slice(0, maxItems);

  visible.forEach(s => {
    const origIndex = state.songs.findIndex(item => item.id === s.id);
    const li = document.createElement('li');
    if (origIndex === state.idx) li.className = 'cur';

    const isFav = state.favorites.has(s.id);
    const isOff = state.offlineMap.has(s.id);
    const durLabel = s.duration ? fmt(s.duration) : '';
    const subMeta = [s.artist, s.genre].filter(Boolean).join(' · ');
    const playsLabel = s.play_count ? `🎧 ${s.play_count}` : '';

    let html = '';
    if (state.isAdmin) {
      const checked = state.selectedBulkIds.has(s.id) ? 'checked' : '';
      html += `<input type="checkbox" class="bulk-chk" data-id="${s.id}" ${checked} title="Chọn xóa nhiều">`;
    }
    html += `<span class="n">${origIndex + 1}</span>`;
    if (s.cover_url) {
      html += `<img class="song-thumb" src="${s.cover_url}" alt="">`;
    }
    html += `<div class="song-info"><span class="t"></span>${subMeta ? `<span class="song-sub"></span>` : ''}</div>`;
    if (playsLabel) html += `<span class="dur-tag play-tag" title="Lượt nghe">${playsLabel}</span>`;
    if (durLabel) html += `<span class="dur-tag">${durLabel}</span>`;

    html += `<div class="song-actions">
      <button class="act-btn fav-btn ${isFav ? 'on' : ''}" title="Yêu thích">${isFav ? '❤️' : '🤍'}</button>
      <button class="act-btn q-btn" title="Thêm vào hàng đợi phát tiếp">📜</button>
      <button class="act-btn pl-btn" title="Thêm vào Playlist">📁</button>
      <button class="act-btn off-btn ${isOff ? 'on' : ''}" title="Lưu nghe Offline">${isOff ? '✅' : '📥'}</button>
      <button class="act-btn share-btn" title="Chia sẻ link bài hát">🔗</button>
      ${state.isAdmin ? `<button class="act-btn edit-btn" title="Sửa thông tin / Lời / Ảnh bìa">✏️</button><button class="act-btn del-btn" title="Xóa">✕</button>` : ''}
    </div>`;

    li.innerHTML = html;
    li.querySelector('.t').textContent = s.title;
    if (subMeta) li.querySelector('.song-sub').textContent = subMeta;

    li.onclick = () => play(origIndex);

    const chk = li.querySelector('.bulk-chk');
    if (chk) {
      chk.onclick = e => {
        e.stopPropagation();
        if (chk.checked) state.selectedBulkIds.add(s.id);
        else state.selectedBulkIds.delete(s.id);
        if (onUpdateBulkBarCallback) onUpdateBulkBarCallback();
      };
    }

    li.querySelector('.fav-btn').onclick = e => {
      e.stopPropagation();
      toggleFavorite(s.id);
    };
    li.querySelector('.q-btn').onclick = e => {
      e.stopPropagation();
      enqueueSong(s.id);
    };
    li.querySelector('.pl-btn').onclick = e => {
      e.stopPropagation();
      addSongToPlaylistPrompt(s);
    };
    li.querySelector('.off-btn').onclick = e => {
      e.stopPropagation();
      toggleOfflineSong(s);
    };
    li.querySelector('.share-btn').onclick = e => {
      e.stopPropagation();
      shareSongLink(s);
    };

    const editBtn = li.querySelector('.edit-btn');
    if (editBtn && onEditSongCallback) {
      editBtn.onclick = e => {
        e.stopPropagation();
        onEditSongCallback(s);
      };
    }
    const delBtn = li.querySelector('.del-btn');
    if (delBtn && onRemoveSongCallback) {
      delBtn.onclick = e => {
        e.stopPropagation();
        onRemoveSongCallback(origIndex);
      };
    }

    ul.appendChild(li);
  });

  const loadMoreBtn = $('loadMoreBtn');
  if (loadMoreBtn) {
    loadMoreBtn.hidden = filtered.length <= maxItems;
    loadMoreBtn.textContent = `Xem thêm (${filtered.length - maxItems} bài nữa)`;
  }

  const curSong = state.idx >= 0 && state.songs[state.idx] ? state.songs[state.idx] : null;
  if ($('now')) {
    $('now').textContent = curSong
      ? curSong.title + (curSong.artist ? ` — ${curSong.artist}` : '')
      : t('notSelected');
  }
  if ($('playerCover')) {
    if (curSong?.cover_url) {
      $('playerCover').src = curSong.cover_url;
      $('playerCover').hidden = false;
    } else {
      $('playerCover').hidden = true;
    }
  }
  if ($('pp')) $('pp').innerHTML = audio.paused ? ICON_PLAY : ICON_PAUSE;
}

export function initLibraryControls() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeTab = btn.dataset.tab;
      currentPage = 1;
      render();
    };
  });

  const searchInput = $('searchInput');
  if (searchInput) {
    searchInput.oninput = e => {
      state.searchQuery = e.target.value.trim();
      currentPage = 1;
      render();
    };
  }

  const genreSel = $('genreFilter');
  if (genreSel) {
    genreSel.onchange = e => {
      state.selectedGenre = e.target.value;
      currentPage = 1;
      render();
    };
  }

  const plSel = $('playlistSelect');
  if (plSel) {
    plSel.onchange = e => {
      state.activePlaylistId = e.target.value;
      currentPage = 1;
      populatePlaylistSelect();
      render();
    };
  }

  const newPlBtn = $('newPlaylistBtn');
  if (newPlBtn) {
    newPlBtn.onclick = () => {
      const name = prompt('Nhập tên Playlist mới:');
      if (!name || !name.trim()) return;
      const pl = { id: crypto.randomUUID(), name: name.trim(), songIds: [] };
      state.playlists.push(pl);
      state.activePlaylistId = pl.id;
      savePlaylistsLocal();
      syncCloudPreferences(true);
      populatePlaylistSelect();
      render();
    };
  }

  const delPlBtn = $('deletePlaylistBtn');
  if (delPlBtn) {
    delPlBtn.onclick = () => {
      if (!state.activePlaylistId) return;
      const pl = state.playlists.find(p => p.id === state.activePlaylistId);
      if (!pl || !confirm(`Xóa playlist "${pl.name}"?`)) return;
      state.playlists = state.playlists.filter(p => p.id !== state.activePlaylistId);
      state.activePlaylistId = '';
      savePlaylistsLocal();
      syncCloudPreferences(true);
      populatePlaylistSelect();
      render();
    };
  }

  const loadMoreBtn = $('loadMoreBtn');
  if (loadMoreBtn) {
    loadMoreBtn.onclick = () => {
      currentPage++;
      render();
    };
  }
}
