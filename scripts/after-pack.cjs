const path = require('node:path');
const { rcedit } = require('rcedit');

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') {
    return;
  }

  const executablePath = path.join(context.appOutDir, `${context.packager.appInfo.productName}.exe`);
  const iconPath = path.join(context.packager.projectDir, 'build', 'icon.ico');
  const version = context.packager.appInfo.version;

  await rcedit(executablePath, {
    icon: iconPath,
    'file-version': version,
    'product-version': version,
    'version-string': {
      CompanyName: 'SAT Mobile Team',
      FileDescription: 'SAT Mobile',
      ProductName: 'SAT Mobile'
    }
  });
};
