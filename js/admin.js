import {
  $,
  sb,
  BUCKET,
  SUPABASE_URL,
  SUPABASE_KEY,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_AUDIO_EXTS,
  state,
  say,
  todayVN,
  getVisitorId
} from './config.js';
import { audio } from './player.js';
import { loadSongs, render, populateGenreFilter } from './library.js';

let currentUploadXhr = null;
let uploadCancelled = false;

export function getAudioDuration(file) {
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

/* ---------- Ghi nhận & Thống kê truy cập + Dashboard ---------- */
export async function trackUserVisit() {
  if (state.isAdmin) return;
  try {
    const today = todayVN();
    const vid = getVisitorId();
    const key = 'last_visit_' + vid;
    if (localStorage.getItem(key) === today) return;
    const { error } = await sb
      .from('user_visits')
      .upsert({ user_id: vid, visit_date: today }, { onConflict: 'user_id,visit_date', ignoreDuplicates: true });
    if (!error) localStorage.setItem(key, today);
  } catch (e) {
    console.warn('Lỗi ghi nhận truy cập:', e);
  }
}

export async function loadTodayVisits() {
  try {
    const today = todayVN();
    const { count, error } = await sb
      .from('user_visits')
      .select('*', { count: 'exact', head: true })
      .eq('visit_date', today);
    if (!error && count !== null && $('todayVisitors')) {
      $('todayVisitors').textContent = count;
    }
  } catch (e) {
    console.warn('Lỗi tải thống kê truy cập:', e);
  }
}

export async function openAdminDashboard() {
  const dlg = $('dashboardDialog');
  if (!dlg) return;
  dlg.showModal();

  // Biểu đồ lượt truy cập 7 ngày gần nhất
  const chartBox = $('visitsChart');
  if (chartBox) {
    chartBox.innerHTML = '<span class="sub">Đang tải dữ liệu...</span>';
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() + 7 * 3600000 - i * 86400000).toISOString().slice(0, 10);
      days.push(d);
    }
    const { data } = await sb
      .from('user_visits')
      .select('visit_date')
      .gte('visit_date', days[0]);

    const counts = {};
    days.forEach(d => (counts[d] = 0));
    (data || []).forEach(r => {
      if (counts[r.visit_date] !== undefined) counts[r.visit_date]++;
    });
    const maxVal = Math.max(1, ...Object.values(counts));
    chartBox.innerHTML = days
      .map(d => {
        const c = counts[d] || 0;
        const h = Math.round((c / maxVal) * 90) + 10;
        return `<div class="chart-col">
          <span class="chart-val">${c}</span>
          <div class="chart-bar" style="height:${h}px"></div>
          <span class="chart-lbl">${d.slice(5)}</span>
        </div>`;
      })
      .join('');
  }

  // Top bài hát nghe nhiều nhất
  const topBox = $('topSongsList');
  if (topBox) {
    const sorted = [...state.songs].sort((a, b) => (b.play_count || 0) - (a.play_count || 0)).slice(0, 8);
    topBox.innerHTML = sorted
      .map((s, i) => `<li><span>#${i + 1} ${s.title}</span><strong>🎧 ${s.play_count || 0}</strong></li>`)
      .join('');
  }
}

/* ---------- Đồng bộ thời lượng bài cũ ---------- */
const triedDur = new Set();
export async function syncOldSongsDuration() {
  if (!state.isAdmin) return;
  const pending = state.songs.filter(s => s.duration == null && !triedDur.has(s.id));
  for (const s of pending) {
    triedDur.add(s.id);
    try {
      const { data } = await sb.storage.from(BUCKET).createSignedUrl(s.file_path, 300);
      if (!data?.signedUrl) continue;
      const dur = await new Promise(resolve => {
        const t = new Audio();
        let finished = false;
        const done = v => {
          if (finished) return;
          finished = true;
          t.removeAttribute('src');
          resolve(v);
        };
        t.preload = 'metadata';
        t.onloadedmetadata = () => done(Math.round(t.duration) || 0);
        t.onerror = () => done(0);
        setTimeout(() => done(0), 8000);
        t.src = data.signedUrl;
      });
      if (dur > 0) {
        s.duration = dur;
        await sb.from('songs').update({ duration: dur }).eq('id', s.id);
        render();
      }
    } catch (_) {}
  }
}

/* ---------- Upload có thanh tiến độ, kiểm tra định dạng/50MB, Kéo thả & Hủy giữa chừng ---------- */
function uploadFileWithProgress(path, file, token, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    currentUploadXhr = xhr;
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
      currentUploadXhr = null;
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error('Lỗi tải lên: ' + xhr.statusText));
    };
    xhr.onerror = () => {
      currentUploadXhr = null;
      reject(new Error('Lỗi kết nối tải lên'));
    };
    xhr.onabort = () => {
      currentUploadXhr = null;
      reject(new Error('Đã hủy tải lên'));
    };
    xhr.send(file);
  });
}

export async function handleUploadFiles(fileList) {
  if (!state.isAdmin) return;
  const files = [...fileList];
  if (!files.length) return;

  const { data: { session } } = await sb.auth.getSession();
  const token = session?.access_token;
  if (!token) return say('Phiên đăng nhập hết hạn');

  uploadCancelled = false;
  $('uploadProgress').hidden = false;
  const errors = [];
  let uploadedCount = 0;

  for (let i = 0; i < files.length; i++) {
    if (uploadCancelled) break;
    const f = files[i];
    const ext = (f.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    if (!ALLOWED_AUDIO_EXTS.includes(ext)) {
      errors.push(`${f.name}: Định dạng .${ext} không hỗ trợ`);
      continue;
    }
    if (f.size > MAX_FILE_SIZE_BYTES) {
      errors.push(`${f.name}: Vượt quá giới hạn 50MB`);
      continue;
    }

    $('uploadStatus').innerHTML = `<span>[${i + 1}/${files.length}] ${f.name}</span> <span id="uploadPct">0%</span>`;
    $('uploadBar').style.width = '0%';

    const duration = await getAudioDuration(f);
    const path = `${state.user.id}/${crypto.randomUUID()}.${ext}`;

    try {
      await uploadFileWithProgress(path, f, token, pct => {
        $('uploadBar').style.width = pct + '%';
        const p = $('uploadPct');
        if (p) p.textContent = pct + '%';
      });

      const title = f.name.replace(/\.[^.]+$/, '');
      const ins = await sb.from('songs').insert({ title, file_path: path, duration });
      if (ins.error) {
        errors.push('Lưu DB: ' + ins.error.message);
        await sb.storage.from(BUCKET).remove([path]);
      } else {
        uploadedCount++;
      }
    } catch (err) {
      if (uploadCancelled) break;
      errors.push(err.message || 'Lỗi tải file');
    }
  }

  $('uploadProgress').hidden = true;
  if ($('file')) $('file').value = '';
  const curId = state.idx >= 0 ? state.songs[state.idx]?.id : null;
  await loadSongs();
  if (curId) state.idx = state.songs.findIndex(s => s.id === curId);
  render();

  if (uploadCancelled) {
    say(`⏹️ Đã hủy tải lên (đã lưu ${uploadedCount} bài)`);
  } else {
    say(errors.length ? '❌ ' + errors[0] : `✅ Đã tải xong ${uploadedCount} bài`);
  }
}

/* ---------- Xóa 1 bài & Chọn xóa nhiều bài (Bulk delete) ---------- */
export async function removeSong(i) {
  if (!state.isAdmin) return;
  const s = state.songs[i];
  if (!s || !confirm(`Xóa "${s.title}"?`)) return;
  await sb.storage.from(BUCKET).remove([s.file_path]);
  const { error } = await sb.from('songs').delete().eq('id', s.id);
  if (error) return say('Lỗi xóa: ' + error.message);
  if (i === state.idx) {
    audio.pause();
    audio.removeAttribute('src');
    state.idx = -1;
  } else if (i < state.idx) {
    state.idx--;
  }
  state.songs.splice(i, 1);
  state.selectedBulkIds.delete(s.id);
  updateBulkBar();
  render();
}

export function updateBulkBar() {
  const bar = $('adminBulkBar');
  const cnt = $('bulkSelectedCount');
  if (!bar || !cnt) return;
  bar.hidden = !state.isAdmin || state.selectedBulkIds.size === 0;
  cnt.textContent = state.selectedBulkIds.size;
}

async function deleteSelectedBulk() {
  if (!state.isAdmin || !state.selectedBulkIds.size) return;
  if (!confirm(`Xóa vĩnh viễn ${state.selectedBulkIds.size} bài hát đã chọn?`)) return;
  const ids = [...state.selectedBulkIds];
  const toDelete = state.songs.filter(s => state.selectedBulkIds.has(s.id));
  const paths = toDelete.map(s => s.file_path).filter(Boolean);

  if (paths.length) await sb.storage.from(BUCKET).remove(paths);
  const { error } = await sb.from('songs').delete().in('id', ids);
  if (error) return say('Lỗi xóa hàng loạt: ' + error.message);

  state.selectedBulkIds.clear();
  updateBulkBar();
  await loadSongs();
  say(`✅ Đã xóa ${ids.length} bài hát`);
}

/* ---------- Sửa bài hát (Tên, Nghệ sĩ, Thể loại, Ảnh bìa, Lời bài hát) ---------- */
let editingSong = null;
export function openEditSongModal(song) {
  editingSong = song;
  $('editTitle').value = song.title || '';
  $('editArtist').value = song.artist || '';
  $('editGenre').value = song.genre || '';
  $('editCoverUrl').value = song.cover_url || '';
  $('editLyrics').value = song.lyrics || '';
  if ($('editCoverFile')) $('editCoverFile').value = '';
  $('editSongDialog').showModal();
}

export function initAdminControls() {
  const fileInput = $('file');
  if (fileInput) {
    fileInput.onchange = e => handleUploadFiles(e.target.files);
  }

  const addBox = $('addBox');
  if (addBox) {
    ['dragenter', 'dragover'].forEach(ev =>
      addBox.addEventListener(ev, e => {
        e.preventDefault();
        e.stopPropagation();
        addBox.classList.add('dragover');
      })
    );
    ['dragleave', 'drop'].forEach(ev =>
      addBox.addEventListener(ev, e => {
        e.preventDefault();
        e.stopPropagation();
        addBox.classList.remove('dragover');
      })
    );
    addBox.addEventListener('drop', e => {
      if (e.dataTransfer?.files?.length) {
        handleUploadFiles(e.dataTransfer.files);
      }
    });
  }

  const cancelBtn = $('cancelUploadBtn');
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      uploadCancelled = true;
      if (currentUploadXhr) currentUploadXhr.abort();
    };
  }

  const bulkDelBtn = $('bulkDeleteBtn');
  if (bulkDelBtn) bulkDelBtn.onclick = deleteSelectedBulk;

  const bulkClearBtn = $('bulkClearBtn');
  if (bulkClearBtn) {
    bulkClearBtn.onclick = () => {
      state.selectedBulkIds.clear();
      updateBulkBar();
      render();
    };
  }

  const openDashBtn = $('openDashboardBtn');
  if (openDashBtn) openDashBtn.onclick = openAdminDashboard;
  const closeDashBtn = $('closeDashboard');
  if (closeDashBtn) closeDashBtn.onclick = () => $('dashboardDialog').close();

  const closeEditBtn = $('closeEditSong');
  if (closeEditBtn) closeEditBtn.onclick = () => $('editSongDialog').close();

  const editForm = $('editSongForm');
  if (editForm) {
    editForm.onsubmit = async e => {
      e.preventDefault();
      if (!editingSong || !state.isAdmin) return;
      say('Đang lưu thông tin bài hát...');

      let coverUrl = $('editCoverUrl').value.trim();
      const coverFile = $('editCoverFile')?.files?.[0];
      if (coverFile) {
        const ext = (coverFile.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
        const coverPath = `covers/${editingSong.id}_${Date.now()}.${ext}`;
        const up = await sb.storage.from(BUCKET).upload(coverPath, coverFile, {
          contentType: coverFile.type || 'image/jpeg',
          upsert: true
        });
        if (!up.error) {
          const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(coverPath);
          if (pub?.publicUrl) {
            coverUrl = pub.publicUrl;
          } else {
            const { data: signed } = await sb.storage.from(BUCKET).createSignedUrl(coverPath, 315360000);
            if (signed?.signedUrl) coverUrl = signed.signedUrl;
          }
        }
      }

      const payload = {
        title: $('editTitle').value.trim() || editingSong.title,
        artist: $('editArtist').value.trim(),
        genre: $('editGenre').value.trim(),
        cover_url: coverUrl,
        lyrics: $('editLyrics').value
      };

      const { error } = await sb.from('songs').update(payload).eq('id', editingSong.id);
      if (error) return say('Lỗi cập nhật: ' + error.message);

      Object.assign(editingSong, payload);
      $('editSongDialog').close();
      populateGenreFilter();
      render();
      say('✅ Đã cập nhật thông tin bài hát!');
    };
  }
}
