// electron-builder の afterPack：exe にアイコンとアプリ名を埋め込む。
// electron-builder 自身の埋め込み（signAndEditExecutable）は、Windows の開発者モードがないと
// winCodeSign の展開で失敗するため使わず、rcedit を直接呼ぶ。
const { execFileSync } = require('node:child_process')
const path = require('node:path')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return
  const { productFilename, productName, version } = context.packager.appInfo
  const exe = path.join(context.appOutDir, `${productFilename}.exe`)
  const rcedit = path.join(__dirname, '..', 'node_modules', 'rcedit', 'bin', 'rcedit-x64.exe')
  const icon = path.join(__dirname, '..', 'build', 'icon.ico')
  execFileSync(rcedit, [
    exe,
    '--set-icon', icon,
    '--set-version-string', 'FileDescription', productName,
    '--set-version-string', 'ProductName', productName,
    '--set-file-version', version,
    '--set-product-version', version,
  ])
}
