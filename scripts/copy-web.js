const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const www = path.join(root, 'www');
const downloads = path.join(root, 'downloads');

fs.mkdirSync(www, { recursive: true });
fs.mkdirSync(downloads, { recursive: true });

// Tạo file cài đặt trực tiếp cho iPhone/iPad (NhacCuaToi.mobileconfig)
const iconPath = path.join(root, 'icons', 'apple-touch-icon.png');
if (fs.existsSync(iconPath)) {
  const iconB64 = fs.readFileSync(iconPath).toString('base64');
  const mobileconfig = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>FullScreen</key>
      <true/>
      <key>Icon</key>
      <data>${iconB64}</data>
      <key>IgnoreManifestScope</key>
      <true/>
      <key>IsRemovable</key>
      <true/>
      <key>Label</key>
      <string>Nhạc của tôi</string>
      <key>PayloadDescription</key>
      <string>Cài đặt ứng dụng Nhạc của tôi lên màn hình chính iPhone/iPad</string>
      <key>PayloadDisplayName</key>
      <string>Nhạc của tôi WebClip</string>
      <key>PayloadIdentifier</key>
      <string>com.nhaccuatoi.music.webclip</string>
      <key>PayloadType</key>
      <string>com.apple.webClip.managed</string>
      <key>PayloadUUID</key>
      <string>9A4E2180-5B3E-4A9D-82F3-7C8A9F01D234</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>Precomposed</key>
      <true/>
      <key>URL</key>
      <string>https://tinh-minh.github.io/Music/</string>
    </dict>
  </array>
  <key>PayloadDescription</key>
  <string>Cài đặt trực tiếp ứng dụng Nhạc của tôi (Full-screen App) lên màn hình chính iOS.</string>
  <key>PayloadDisplayName</key>
  <string>Nhạc của tôi (iOS App)</string>
  <key>PayloadIdentifier</key>
  <string>com.nhaccuatoi.music.profile</string>
  <key>PayloadOrganization</key>
  <string>Nhạc của tôi</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>1F8B9C12-3D4E-4F5A-9B8C-6E7F8A9B0C1D</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>
`;
  fs.writeFileSync(path.join(downloads, 'NhacCuaToi.mobileconfig'), mobileconfig, 'utf8');
}

for (const file of ['index.html', 'register.html', 'app.js', 'register.js', 'style.css', 'manifest.json', 'sw.js']) {
  const src = path.join(root, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(www, file));
  }
}

for (const dir of ['icons', 'js']) {
  const srcDir = path.join(root, dir);
  if (fs.existsSync(srcDir)) {
    fs.cpSync(srcDir, path.join(www, dir), { recursive: true });
  }
}

console.log('Copied web assets, icons, js modules, and generated iOS installer profile.');
