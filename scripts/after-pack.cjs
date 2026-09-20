const { execFileSync } = require('node:child_process');
const { join } = require('node:path');

module.exports = async ({ electronPlatformName, appOutDir, packager }) => {
  if (electronPlatformName !== 'darwin') {
    return;
  }
  // electron-builder 26 writes NFD helper names but an NFC CFBundleName for Korean names.
  // Electron resolves helpers from CFBundleName, so both must have identical Unicode bytes.
  // Upstream fix (builder 27): https://github.com/electron-userland/electron-builder/pull/9962
  const filename = packager.appInfo.productFilename;
  const plist = join(appOutDir, `${filename}.app`, 'Contents', 'Info.plist');
  execFileSync('/usr/libexec/PlistBuddy', ['-c', `Set :CFBundleName ${filename}`, plist]);
};
