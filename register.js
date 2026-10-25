import { $, sb, say } from './js/config.js';
import { initTheme } from './js/theme.js';

initTheme();

const form = $('registerForm');
if (form) {
  form.onsubmit = async e => {
    e.preventDefault();
    const email = $('regEmail').value.trim();
    const password = $('regPass').value;
    const confirmPass = $('regPassConfirm').value;

    if (password !== confirmPass) {
      return say('❌ Mật khẩu nhập lại không khớp!');
    }

    const btn = $('regSubmitBtn');
    if (btn) btn.disabled = true;
    say('⏳ Đang tạo tài khoản...');

    const { data, error } = await sb.auth.signUp({ email, password });
    if (btn) btn.disabled = false;

    if (error) {
      return say('❌ Lỗi đăng ký: ' + error.message);
    }

    // Đồng bộ Yêu thích & Playlist hiện có trên máy lên tài khoản vừa tạo
    if (data?.user) {
      try {
        const favs = JSON.parse(localStorage.getItem('nhac_favorites') || '[]');
        const pls = JSON.parse(localStorage.getItem('nhac_playlists') || '[]');
        await sb.from('user_preferences').upsert({
          user_id: data.user.id,
          favorites: favs,
          playlists: pls,
          updated_at: new Date().toISOString()
        });
      } catch (_) {}
    }

    say('✅ Đăng ký thành công! Đang chuyển về trang nghe nhạc...');
    setTimeout(() => {
      location.href = 'index.html';
    }, 1200);
  };
}
