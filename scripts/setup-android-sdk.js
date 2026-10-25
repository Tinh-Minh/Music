const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const https = require('https');

const SDK_ROOT = process.env.ANDROID_HOME || path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk');
const JAVA_HOME = process.env.JAVA_HOME || 'C:\\Program Files\\Java\\jdk-21.0.12.1';
const ZIP_URL = 'https://dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip';
const ZIP_PATH = path.join(process.env.TEMP, 'commandlinetools-win.zip');
const SDKMANAGER = path.join(SDK_ROOT, 'cmdline-tools', 'latest', 'bin', 'sdkmanager.bat');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(dest);
        return download(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error('Download failed: HTTP ' + res.statusCode));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

function run(cmd, args, extraEnv) {
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, JAVA_HOME, ANDROID_HOME: SDK_ROOT, ANDROID_SDK_ROOT: SDK_ROOT, ...extraEnv }
  });
  if (r.status !== 0) process.exit(r.status || 1);
}

(async () => {
  fs.mkdirSync(SDK_ROOT, { recursive: true });
  if (!fs.existsSync(SDKMANAGER)) {
    console.log('Downloading Android command-line tools...');
    await download(ZIP_URL, ZIP_PATH);
    const extractDir = path.join(process.env.TEMP, 'cmdline-tools-extract');
    fs.rmSync(extractDir, { recursive: true, force: true });
    fs.mkdirSync(extractDir, { recursive: true });
    run('powershell', ['-NoProfile', '-Command', `Expand-Archive -Force -Path '${ZIP_PATH}' -DestinationPath '${extractDir}'`]);
    const dest = path.join(SDK_ROOT, 'cmdline-tools', 'latest');
    fs.rmSync(dest, { recursive: true, force: true });
    fs.mkdirSync(path.join(SDK_ROOT, 'cmdline-tools'), { recursive: true });
    const nested = path.join(extractDir, 'cmdline-tools');
    fs.renameSync(nested, dest);
    console.log('Command-line tools installed at', dest);
  }

  const packages = ['platforms;android-35', 'build-tools;35.0.0', 'platform-tools'];
  console.log('Installing SDK packages...');
  run('cmd', ['/c', `"${SDKMANAGER}" --sdk_root="${SDK_ROOT}" ${packages.map(p => `"${p}"`).join(' ')} < nul`]);

  console.log('Accepting licenses...');
  run('cmd', ['/c', `(for /L %i in (1,1,80) do @echo y) | "${SDKMANAGER}" --sdk_root="${SDK_ROOT}" --licenses`]);

  const localProps = path.join(__dirname, '..', 'android', 'local.properties');
  const sdkDir = SDK_ROOT.replace(/\\/g, '\\\\');
  fs.writeFileSync(localProps, `sdk.dir=${sdkDir}\n`);
  console.log('Wrote', localProps);
  console.log('ANDROID_HOME=', SDK_ROOT);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
