-- ============================================================================
-- SUPABASE SETUP & MIGRATIONS - NHẠC CỦA TÔI (ALL 4 PHASES)
-- Cách dùng: Mở Supabase Dashboard -> SQL Editor -> New Query -> Dán vào và bấm RUN
-- (An toàn tuyệt đối cho dữ liệu cũ: không xóa bài hát hay tài khoản đang có)
-- ============================================================================

-- 1. Bảng admins (Danh sách Admin được quyền upload/sửa/xóa nhạc)
CREATE TABLE IF NOT EXISTS public.admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can check admin" ON public.admins;
CREATE POLICY "Anyone authenticated can check admin"
ON public.admins FOR SELECT
TO authenticated
USING (true);

-- 2. Bảng songs & nâng cấp các cột mới (Thời lượng, Nghệ sĩ, Thể loại, Ảnh bìa, Lời, Lượt nghe)
CREATE TABLE IF NOT EXISTS public.songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  file_path text NOT NULL,
  duration integer DEFAULT 0,
  artist text DEFAULT '',
  genre text DEFAULT '',
  cover_url text DEFAULT '',
  lyrics text DEFAULT '',
  play_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS duration integer DEFAULT 0;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS artist text DEFAULT '';
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS genre text DEFAULT '';
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS cover_url text DEFAULT '';
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS lyrics text DEFAULT '';
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS play_count integer DEFAULT 0;

ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read songs" ON public.songs;
CREATE POLICY "Anyone can read songs"
ON public.songs FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Admin can insert songs" ON public.songs;
CREATE POLICY "Admin can insert songs"
ON public.songs FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE admins.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admin can update songs" ON public.songs;
CREATE POLICY "Admin can update songs"
ON public.songs FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.admins WHERE admins.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE admins.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admin can delete songs" ON public.songs;
CREATE POLICY "Admin can delete songs"
ON public.songs FOR DELETE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.admins WHERE admins.user_id = auth.uid()));

-- 3. Bảng user_visits (Đếm lượt truy cập hàng ngày cho cả Khách không đăng nhập & Thành viên)
CREATE TABLE IF NOT EXISTS public.user_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  visit_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

-- Xóa các policy cũ trước khi đổi kiểu dữ liệu cột user_id
DROP POLICY IF EXISTS "User can record their visit" ON public.user_visits;
DROP POLICY IF EXISTS "Anyone can record visit" ON public.user_visits;
DROP POLICY IF EXISTS "Admin can read user visits" ON public.user_visits;

-- Gỡ khóa ngoại cũ (nếu có) và chuyển user_id sang kiểu text để lưu được mã khách (guest_...)
ALTER TABLE public.user_visits DROP CONSTRAINT IF EXISTS user_visits_user_id_fkey;
ALTER TABLE public.user_visits ALTER COLUMN user_id TYPE text USING user_id::text;

-- Xóa các dòng bị trùng lặp trong cùng 1 ngày trước khi tạo ràng buộc UNIQUE
DELETE FROM public.user_visits a
USING public.user_visits b
WHERE a.ctid < b.ctid
  AND a.user_id = b.user_id
  AND a.visit_date = b.visit_date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_visits_unique_per_day'
  ) THEN
    ALTER TABLE public.user_visits ADD CONSTRAINT user_visits_unique_per_day UNIQUE (user_id, visit_date);
  END IF;
END $$;

ALTER TABLE public.user_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record visit"
ON public.user_visits FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admin can read user visits"
ON public.user_visits FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.admins WHERE admins.user_id = auth.uid()));

-- 4. Bảng user_preferences (Đồng bộ Yêu thích & Playlist cá nhân khi đăng nhập thành viên)
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  favorites jsonb NOT NULL DEFAULT '[]'::jsonb,
  playlists jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own preferences" ON public.user_preferences;
CREATE POLICY "Users manage own preferences"
ON public.user_preferences FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. Hàm RPC tăng lượt nghe bài hát (increment_play_count) cho cả khách và thành viên
CREATE OR REPLACE FUNCTION public.increment_play_count(song_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.songs
  SET play_count = COALESCE(play_count, 0) + 1
  WHERE id = song_id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_play_count(uuid) TO anon, authenticated;

-- 6. Phân quyền Storage cho bucket 'music' (Khách được nghe, Admin được tải lên/sửa/xóa)
DROP POLICY IF EXISTS "Anyone can listen to songs in storage" ON storage.objects;
CREATE POLICY "Anyone can listen to songs in storage"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'music');

DROP POLICY IF EXISTS "Admin can upload to music bucket" ON storage.objects;
CREATE POLICY "Admin can upload to music bucket"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'music'
  AND EXISTS (SELECT 1 FROM public.admins WHERE admins.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Admin can update music bucket" ON storage.objects;
CREATE POLICY "Admin can update music bucket"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'music'
  AND EXISTS (SELECT 1 FROM public.admins WHERE admins.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Admin can delete from music bucket" ON storage.objects;
CREATE POLICY "Admin can delete from music bucket"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'music'
  AND EXISTS (SELECT 1 FROM public.admins WHERE admins.user_id = auth.uid())
);
