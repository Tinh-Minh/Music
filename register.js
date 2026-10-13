const $ = id => document.getElementById(id);
const SUPABASE_URL = 'https://qkzeyhvfokiyxoyjeqij.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LedPdzZbijxM2LuXpfTw9w_KFBh1Qvj';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const say = t => { $('msg').textContent = t || ''; };
const home = location.origin + location.pathname.replace(/register\.html$/, '');

$('regForm').onsubmit = async e => {
  e.preventDefault();
  const email = $('email').value.trim();
  const password = $('pass').value;
  if (password.length < 6) return say('Mật khẩu tối thiểu 6 ký tự');
  if (password !== $('pass2').value) return say('Hai mật khẩu không khớp');

  $('btn').disabled = true;
  say('Đang đăng ký...');
  const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: home } });
  $('btn').disabled = false;

  if (error) return say('Lỗi đăng ký: ' + error.message);
  // Email đã tồn tại: Supabase trả về user nhưng không có identities
  if (data.user && data.user.identities && data.user.identities.length === 0) return say('Email này đã được đăng ký. Hãy quay lại đăng nhập.');
  // Không cần xác nhận email: vào app luôn
  if (data.session) { location.href = home; return; }
  $('regForm').hidden = true;
  say('✅ Đã đăng ký. Kiểm tra email và bấm link xác nhận, rồi quay lại đăng nhập.');
};
