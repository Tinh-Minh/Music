import { $, state } from './config.js';

const dict = {
  vi: {
    appTitle: '🎧 Nhạc của tôi',
    iosInstall: '🍎 Tải iPhone',
    apkDownload: '🤖 Tải Android',
    loginBtn: '🔐 Đăng nhập',
    logoutBtn: 'Đăng xuất',
    guestLabel: '👤 Khách nghe nhạc',
    memberLabel: '👤 Thành viên: ',
    adminLabel: '👑 Admin: ',
    notSelected: 'Chưa chọn bài',
    tabAll: 'Tất cả',
    tabShort: 'Ngắn <10p',
    tabLong: 'Dài ≥10p',
    tabFav: '❤️ Yêu thích',
    tabOffline: '📥 Đã tải',
    searchPlaceholder: '🔍 Tìm tên bài, nghệ sĩ, thể loại...',
    allGenres: 'Tất cả thể loại',
    allPlaylists: '📁 Playlist cá nhân',
    newPlaylistBtn: '+ Tạo Playlist',
    queueTitle: '📜 Hàng đợi phát tiếp',
    queueEmpty: 'Chưa có bài trong hàng đợi',
    lyricsTitle: '🎤 Lời bài hát (Lyrics)',
    lyricsEmpty: 'Chưa có lời cho bài hát này.',
    sleepOff: '⏰ Hẹn giờ: Tắt',
    addSongBox: '＋ Kéo thả hoặc chọn file nhạc (mp3, m4a, wav... tối đa 50MB)',
    emptyList: 'Chưa có bài hát nào phù hợp.'
  },
  en: {
    appTitle: '🎧 My Music',
    iosInstall: '🍎 iPhone App',
    apkDownload: '🤖 Android App',
    loginBtn: '🔐 Sign In',
    logoutBtn: 'Sign Out',
    guestLabel: '👤 Guest Listener',
    memberLabel: '👤 Member: ',
    adminLabel: '👑 Admin: ',
    notSelected: 'No track selected',
    tabAll: 'All',
    tabShort: 'Short <10m',
    tabLong: 'Long ≥10m',
    tabFav: '❤️ Favorites',
    tabOffline: '📥 Offline',
    searchPlaceholder: '🔍 Search title, artist, genre...',
    allGenres: 'All genres',
    allPlaylists: '📁 Personal Playlists',
    newPlaylistBtn: '+ New Playlist',
    queueTitle: '📜 Up Next Queue',
    queueEmpty: 'Queue is empty',
    lyricsTitle: '🎤 Lyrics',
    lyricsEmpty: 'No lyrics available for this track.',
    sleepOff: '⏰ Sleep: Off',
    addSongBox: '＋ Drag & drop or pick audio files (mp3, m4a, wav... max 50MB)',
    emptyList: 'No matching tracks found.'
  }
};

export function t(key) {
  return (dict[state.lang] && dict[state.lang][key]) || dict.vi[key] || key;
}

export function applyLanguage(onRender) {
  const langBtn = $('langToggle');
  if (langBtn) langBtn.textContent = state.lang === 'vi' ? 'VI' : 'EN';
  const h1 = $('appTitleText');
  if (h1) h1.textContent = t('appTitle');
  const iosBtn = $('iosInstall');
  if (iosBtn) iosBtn.textContent = t('iosInstall');
  const apkBtn = $('apkDownload');
  if (apkBtn) apkBtn.textContent = t('apkDownload');
  const loginBtn = $('adminLoginBtn');
  if (loginBtn) loginBtn.textContent = t('loginBtn');
  const logoutBtn = $('logout');
  if (logoutBtn) logoutBtn.textContent = t('logoutBtn');
  const searchInput = $('searchInput');
  if (searchInput) searchInput.placeholder = t('searchPlaceholder');
  const addText = $('addBoxText');
  if (addText) addText.textContent = t('addSongBox');
  const emptyEl = $('empty');
  if (emptyEl) emptyEl.textContent = t('emptyList');
  const lblAll = $('lblTabAll');
  if (lblAll) lblAll.textContent = t('tabAll');
  const lblShort = $('lblTabShort');
  if (lblShort) lblShort.textContent = t('tabShort');
  const lblLong = $('lblTabLong');
  if (lblLong) lblLong.textContent = t('tabLong');
  const lblFav = $('lblTabFav');
  if (lblFav) lblFav.textContent = t('tabFav');
  const lblOff = $('lblTabOffline');
  if (lblOff) lblOff.textContent = t('tabOffline');
  const newPl = $('newPlaylistBtn');
  if (newPl) newPl.textContent = t('newPlaylistBtn');

  if (typeof onRender === 'function') onRender();
}

export function initLanguage(onRender) {
  const langBtn = $('langToggle');
  if (langBtn) {
    langBtn.onclick = () => {
      state.lang = state.lang === 'vi' ? 'en' : 'vi';
      localStorage.setItem('nhac_lang', state.lang);
      applyLanguage(onRender);
    };
  }
  applyLanguage(onRender);
}
