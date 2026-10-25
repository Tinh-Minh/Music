import { $, sb, state, say } from './js/config.js';
import { t, initLanguage } from './js/i18n.js';
import { initTheme } from './js/theme.js';
import { initAuth, syncCloudPreferences } from './js/auth.js';
import {
  setPlayerRenderCallback,
  initPlayerControls,
  restorePlaybackOrDeepLink
} from './js/player.js';
import {
  setLibraryAdminCallbacks,
  loadSongs,
  render,
  initLibraryControls
} from './js/library.js';
import {
  trackUserVisit,
  loadTodayVisits,
  syncOldSongsDuration,
  removeSong,
  openEditSongModal,
  updateBulkBar,
  initAdminControls
} from './js/admin.js';

let realtimeSub = null;

function subscribeSongsRealtime() {
  if (realtimeSub) sb.removeChannel(realtimeSub);
  realtimeSub = sb
    .channel('realtime:songs')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'songs' }, async payload => {
      if (payload.eventType === 'UPDATE') return;
      const curId = state.idx >= 0 && state.songs[state.idx] ? state.songs[state.idx].id : null;
      await loadSongs();
      if (curId) state.idx = state.songs.findIndex(s => s.id === curId);
      render();

      if (payload.eventType === 'INSERT') {
        const msgText = '✨ Có bài hát mới vừa được thêm!';
        say(msgText);
        setTimeout(() => {
          if ($('msg')?.textContent.includes('Có bài hát mới')) say('');
        }, 4000);

        if ('Notification' in window && Notification.permission === 'granted') {
          const title = payload.new?.title ? `🎵 Bài mới: ${payload.new.title}` : '🎧 Nhạc của tôi';
          new Notification(title, { body: msgText, icon: 'icons/icon-192.png' });
        }
      }
    })
    .subscribe();
}

function initPushNotifications() {
  const notifyBtn = $('notifyToggle');
  if (!notifyBtn || !('Notification' in window)) {
    if (notifyBtn) notifyBtn.hidden = true;
    return;
  }
  const updateIcon = () => {
    notifyBtn.classList.toggle('on', Notification.permission === 'granted');
    notifyBtn.title =
      Notification.permission === 'granted'
        ? 'Đã bật thông báo bài hát mới'
        : 'Bật thông báo khi có bài mới';
  };
  updateIcon();

  notifyBtn.onclick = async () => {
    const perm = await Notification.requestPermission();
    updateIcon();
    if (perm === 'granted') {
      say('🔔 Đã bật thông báo khi có bài hát mới!');
    } else {
      say('🔕 Bạn đã tắt quyền thông báo trên trình duyệt');
    }
  };
}

async function enterApp() {
  let adminCheck = null;
  if (state.user) {
    const { data } = await sb.from('admins').select('user_id').eq('user_id', state.user.id).maybeSingle();
    adminCheck = data;
  }
  state.isAdmin = !!adminCheck;

  if ($('addBox')) $('addBox').hidden = !state.isAdmin;
  if ($('adminStats')) $('adminStats').hidden = !state.isAdmin;
  if ($('logout')) $('logout').hidden = !state.user;
  if ($('adminLoginBtn')) $('adminLoginBtn').hidden = !!state.user;

  if (state.isAdmin) {
    $('who').textContent = t('adminLabel') + state.user.email;
    loadTodayVisits();
    setTimeout(syncOldSongsDuration, 5000);
  } else if (state.user) {
    $('who').textContent = t('memberLabel') + state.user.email + ' (☁️ Đã đồng bộ)';
    trackUserVisit();
  } else {
    $('who').textContent = t('guestLabel');
    trackUserVisit();
  }

  await loadSongs();
  restorePlaybackOrDeepLink();
  subscribeSongsRealtime();
}

async function init() {
  initTheme();
  setPlayerRenderCallback(render);
  setLibraryAdminCallbacks({
    onEdit: openEditSongModal,
    onRemove: removeSong,
    onBulkChange: updateBulkBar
  });

  initLanguage(render);
  initPlayerControls();
  initLibraryControls();
  initAdminControls();
  initAuth(enterApp);
  initPushNotifications();

  const isIOS =
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone =
    window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

  if (window.Capacitor || isIOS || isStandalone) {
    const apkBtn = $('apkDownload');
    if (apkBtn) apkBtn.hidden = true;
  }
  if (isIOS && !isStandalone && !window.Capacitor) {
    if ($('iosInstall')) $('iosInstall').hidden = false;
  }
  if ($('iosInstall')) $('iosInstall').onclick = () => $('iosDialog').showModal();
  if ($('closeIos')) $('closeIos').onclick = () => $('iosDialog').close();

  if ('serviceWorker' in navigator && !window.Capacitor && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  const { data: { session } } = await sb.auth.getSession();
  state.user = session?.user || null;
  if (state.user) await syncCloudPreferences(false);
  await enterApp();
}

init();
