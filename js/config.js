export const $ = id => document.getElementById(id);
export const BUCKET = 'music';
export const AUDIO_CACHE_NAME = 'nhac-audio-v1';
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
export const ALLOWED_AUDIO_EXTS = ['mp3', 'm4a', 'wav', 'ogg', 'flac', 'aac', 'webm', 'mp4'];

export const ICON_PLAY = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
export const ICON_PAUSE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';

export const SUPABASE_URL = 'https://qkzeyhvfokiyxoyjeqij.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_LedPdzZbijxM2LuXpfTw9w_KFBh1Qvj';

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

export const state = {
  user: null,
  isAdmin: false,
  songs: [],
  idx: -1,
  shuffle: false,
  repeat: false,
  activeTab: 'all',
  searchQuery: '',
  selectedGenre: '',
  activePlaylistId: '',
  favorites: new Set(JSON.parse(localStorage.getItem('nhac_favorites') || '[]')),
  playlists: JSON.parse(localStorage.getItem('nhac_playlists') || '[]'),
  queue: [],
  offlineMap: new Set(JSON.parse(localStorage.getItem('nhac_offline_ids') || '[]')),
  selectedBulkIds: new Set(),
  sleepTimerId: null,
  sleepEndAt: 0,
  lang: localStorage.getItem('nhac_lang') || 'vi'
};

export const say = t => {
  const el = $('msg');
  if (el) el.textContent = t || '';
};

export const fmt = t =>
  isFinite(t) && t >= 0
    ? Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0')
    : '0:00';

export function todayVN() {
  const d = new Date();
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  return new Date(utc + 7 * 3600000).toISOString().slice(0, 10);
}

export function getVisitorId() {
  let vid = localStorage.getItem('guest_visitor_id');
  if (!vid) {
    vid = crypto.randomUUID();
    localStorage.setItem('guest_visitor_id', vid);
  }
  return vid;
}

export function saveFavoritesLocal() {
  localStorage.setItem('nhac_favorites', JSON.stringify([...state.favorites]));
}

export function savePlaylistsLocal() {
  localStorage.setItem('nhac_playlists', JSON.stringify(state.playlists));
}

export function saveOfflineLocal() {
  localStorage.setItem('nhac_offline_ids', JSON.stringify([...state.offlineMap]));
}
