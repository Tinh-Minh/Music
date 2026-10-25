const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const args = process.argv.slice(2);
const isRelease = args.includes('--release');
const isBundle = args.includes('--bundle');

function detectJavaHome() {
  if (process.env.JAVA_HOME && fs.existsSync(process.env.JAVA_HOME)) return process.env.JAVA_HOME;
  const javaBase = 'C:\\Program Files\\Java';
  if (fs.existsSync(javaBase)) {
    const dirs = fs.readdirSync(javaBase).filter(d => d.startsWith('jdk')).sort().reverse();
    if (dirs.length) return path.join(javaBase, dirs[0]);
  }
  return '';
}

const javaHome = detectJavaHome();
const androidHome = process.env.ANDROID_HOME || (process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk') : '');
const isWin = process.platform === 'win32';
const gradle = path.join(root, 'android', isWin ? 'gradlew.bat' : 'gradlew');

const env = { ...process.env };
if (javaHome) env.JAVA_HOME = javaHome;
if (androidHome) {
  env.ANDROID_HOME = androidHome;
  env.ANDROID_SDK_ROOT = androidHome;
}

const task = isBundle ? 'bundleRelease' : (isRelease ? 'assembleRelease' : 'assembleDebug');

const r = spawnSync(gradle, [task], {
  cwd: path.join(root, 'android'),
  stdio: 'inherit',
  shell: isWin,
  env
});

if (r.status !== 0) process.exit(r.status || 1);

const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });

if (isBundle) {
  const src = path.join(root, 'android', 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');
  const dest = path.join(dist, 'NhacCuaToi.aab');
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log('AAB ready:', dest);
  }
} else {
  const sub = isRelease ? ['release', 'app-release.apk'] : ['debug', 'app-debug.apk'];
  const src = path.join(root, 'android', 'app', 'build', 'outputs', 'apk', ...sub);
  const dest = path.join(dist, 'NhacCuaToi.apk');
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    const downloads = path.join(root, 'downloads');
    if (fs.existsSync(downloads)) {
      fs.copyFileSync(src, path.join(downloads, 'NhacCuaToi.apk'));
    }
    console.log('APK ready:', dest);
  }
}
