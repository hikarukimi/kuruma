/* global __dirname */

const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const { getMainApplicationOrThrow } = AndroidConfig.Manifest;

function withCustomNetworkSecurityConfig(config) {
  config = withAndroidManifest(config, (nextConfig) => {
    const mainApplication = getMainApplicationOrThrow(nextConfig.modResults);
    mainApplication.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    mainApplication.$['android:usesCleartextTraffic'] = 'true';
    return nextConfig;
  });

  return withDangerousMod(config, [
    'android',
    async (nextConfig) => {
      const sourcePath = path.join(__dirname, 'network_security_config.xml');
      const targetDir = path.join(
        nextConfig.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml'
      );
      const targetPath = path.join(targetDir, 'network_security_config.xml');

      await fs.promises.mkdir(targetDir, { recursive: true });
      await fs.promises.copyFile(sourcePath, targetPath);

      return nextConfig;
    },
  ]);
}

module.exports = withCustomNetworkSecurityConfig;
