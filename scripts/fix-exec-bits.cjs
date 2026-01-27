const fs = require('fs')
const fsp = require('fs/promises')
const path = require('path')

async function chmodIfExists(filePath, mode) {
  try {
    await fsp.chmod(filePath, mode)
  } catch {
    // ignore
  }
}

async function chmodDirFiles(dirPath, mode) {
  try {
    const entries = await fsp.readdir(dirPath, { withFileTypes: true })
    await Promise.all(
      entries.map(async (e) => {
        const full = path.join(dirPath, e.name)
        if (e.isFile()) return chmodIfExists(full, mode)
        return null
      }),
    )
  } catch {
    // ignore
  }
}

async function chmodGlobbedBin(dir, mode) {
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true })
    await Promise.all(
      entries
        .filter((e) => e.isDirectory())
        .map(async (e) => chmodDirFiles(path.join(dir, e.name, 'bin'), mode)),
    )
  } catch {
    // ignore
  }
}

async function main() {
  if (process.platform === 'win32') return

  const projectRoot = process.cwd()
  const nodeModules = path.join(projectRoot, 'node_modules')
  if (!fs.existsSync(nodeModules)) return

  // Common executables invoked during Vite build
  await chmodDirFiles(path.join(nodeModules, '.bin'), 0o755)
  await chmodDirFiles(path.join(nodeModules, 'esbuild', 'bin'), 0o755)
  await chmodGlobbedBin(path.join(nodeModules, '@esbuild'), 0o755)
}

main()

