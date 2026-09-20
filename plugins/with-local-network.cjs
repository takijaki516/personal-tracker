const { withAndroidManifest } = require('expo/config-plugins');
module.exports = (config) =>
  withAndroidManifest(config, (result) => {
    // LAN transport is HTTP; every request/response payload is authenticated and encrypted with NaCl.
    result.modResults.manifest.application[0].$['android:usesCleartextTraffic'] = 'true';
    return result;
  });
