import { $, sb, state, say, saveFavoritesLocal, savePlaylistsLocal } from './config.js';
import { t } from './i18n.js';

export async function syncCloudPreferences(pushToCloud = false) {
  if (!state.user) return;
  try {
    if (pushToCloud) {
      await sb.from('user_preferences').upsert({
        user_id: state.user.id,
        favorites: [...state.favorites],
        playlists: state.playlists,
        updated_at: new Date().toISOString()
      });
      return;
    }

    const { data, error } = await sb
      .from('user_preferences')
      .select('favorites, playlists')
      .eq('user_id', state.user.id)
      .maybeSingle();

    if (error) return;
    if (data) {
      if (Array.isArray(data.favorites)) {
        data.favorites.forEach(id => state.favorites.add(id));
        saveFavoritesLocal();
      }
      if (Array.isArray(data.playlists) && data.playlists.length) {
        const existingIds = new Set(state.playlists.map(p => p.id));
        data.playlists.forEach(pl => {
          if (!existingIds.has(pl.id)) state.playlists.push(pl);
        });
        savePlaylistsLocal();
      }
    } else {
      await sb.from('user_preferences').upsert({
        user_id: state.user.id,
        favorites: [...state.favorites],
        playlists: state.playlists
      });
    }
  } catch (_) {}
}

export function initAuth(onAuthChanged) {
  const loginBtn = $('adminLoginBtn');
  const closeLogin = $('closeLogin');
  const loginForm = $('loginForm');
  const logoutBtn = $('logout');

  if (loginBtn) {
    loginBtn.onclick = () => {
      $('loginDialog').showModal();
    };
  }
  if (closeLogin) closeLogin.onclick = () => $('loginDialog').close();

  if (loginForm) {
    loginForm.onsubmit = async e => {
      e.preventDefault();
      const email = $('email').value.trim();
      const password = $('pass').value;
      say('Đang xác thực...');
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) return say('Sai email hoặc mật khẩu');
      state.user = data.user;
      $('pass').value = '';
      say('');
      $('loginDialog').close();
      await syncCloudPreferences(false);
      if (onAuthChanged) await onAuthChanged();
    };
  }

  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      await sb.auth.signOut();
      state.user = null;
      state.isAdmin = false;
      state.selectedBulkIds.clear();
      if ($('who')) $('who').textContent = t('guestLabel');
      if ($('addBox')) $('addBox').hidden = true;
      if ($('adminStats')) $('adminStats').hidden = true;
      if ($('adminBulkBar')) $('adminBulkBar').hidden = true;
      if ($('logout')) $('logout').hidden = true;
      if ($('adminLoginBtn')) $('adminLoginBtn').hidden = false;
      if (onAuthChanged) await onAuthChanged();
      say('Đã đăng xuất');
      setTimeout(() => say(''), 3000);
    };
  }
}
