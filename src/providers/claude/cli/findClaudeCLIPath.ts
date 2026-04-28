import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { parsePathEntries, resolveNvmDefaultBin } from '../../../utils/path';

function getEnvValue(name: string): string | undefined {
  return process.env[name];
}

function dedupePaths(entries: string[]): string[] {
  const seen = new Set<string>();
  return entries.filter(entry => {
    const key = process.platform === 'win32' ? entry.toLowerCase() : entry;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findFirstExistingPath(entries: string[], candidates: string[], isWindows = process.platform === 'win32'): string | null {
  const pathApi = isWindows ? path.win32 : path.posix;
  for (const dir of entries) {
    if (!dir) continue;
    for (const candidate of candidates) {
      const fullPath = pathApi.join(dir, candidate);
      if (isExistingFile(fullPath)) {
        return fullPath;
      }
    }
  }
  return null;
}

function isExistingFile(filePath: string): boolean {
  try {
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      return stat.isFile();
    }
  } catch {
    // Inaccessible path
  }
  return false;
}

function resolveCliJsNearPathEntry(entry: string, isWindows: boolean): string | null {
  const pathApi = isWindows ? path.win32 : path.posix;
  const directCandidate = pathApi.join(entry, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
  if (isExistingFile(directCandidate)) {
    return directCandidate;
  }

  const baseName = pathApi.basename(entry).toLowerCase();
  if (baseName === 'bin') {
    const prefix = pathApi.dirname(entry);
    const candidate = isWindows
      ? pathApi.join(prefix, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')
      : pathApi.join(prefix, 'lib', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
    if (isExistingFile(candidate)) {
      return candidate;
    }
  }

  return null;
}

function resolveCliJsFromPathEntries(entries: string[], isWindows: boolean): string | null {
  for (const entry of entries) {
    const candidate = resolveCliJsNearPathEntry(entry, isWindows);
    if (candidate) {
      return candidate;
    }
  }
  return null;
}

function resolveClaudeFromPathEntries(
  entries: string[],
  isWindows: boolean
): string | null {
  if (entries.length === 0) {
    return null;
  }

  if (!isWindows) {
    const unixCandidate = findFirstExistingPath(entries, ['claude'], isWindows);
    return unixCandidate;
  }

  const exeCandidate = findFirstExistingPath(entries, ['claude.exe', 'claude'], isWindows);
  if (exeCandidate) {
    return exeCandidate;
  }

  const cliJsCandidate = resolveCliJsFromPathEntries(entries, isWindows);
  if (cliJsCandidate) {
    return cliJsCandidate;
  }

  return null;
}

function getNpmGlobalPrefix(): string | null {
  if (process.env.npm_config_prefix) {
    return process.env.npm_config_prefix;
  }

  if (process.platform === 'win32') {
    const appDataNpm = process.env.APPDATA
      ? path.join(process.env.APPDATA, 'npm')
      : null;
    if (appDataNpm && fs.existsSync(appDataNpm)) {
      return appDataNpm;
    }
  }

  return null;
}

function getNpmCliJsPaths(): string[] {
  const homeDir = os.homedir();
  const isWindows = process.platform === 'win32';
  const pathApi = isWindows ? path.win32 : path.posix;
  const cliJsPaths: string[] = [];

  if (isWindows) {
    cliJsPaths.push(
      pathApi.join(homeDir, 'AppData', 'Roaming', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')
    );

    const npmPrefix = getNpmGlobalPrefix();
    if (npmPrefix) {
      cliJsPaths.push(
        pathApi.join(npmPrefix, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')
      );
    }

    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

    cliJsPaths.push(
      pathApi.join(programFiles, 'nodejs', 'node_global', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js'),
      pathApi.join(programFilesX86, 'nodejs', 'node_global', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')
    );

    cliJsPaths.push(
      pathApi.join('D:', 'Program Files', 'nodejs', 'node_global', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')
    );
  } else {
    cliJsPaths.push(
      pathApi.join(homeDir, '.npm-global', 'lib', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js'),
      '/usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js',
      '/usr/lib/node_modules/@anthropic-ai/claude-code/cli.js'
    );

    if (process.env.npm_config_prefix) {
      cliJsPaths.push(
        pathApi.join(process.env.npm_config_prefix, 'lib', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')
      );
    }
  }

  return cliJsPaths;
}

export function findClaudeCLIPath(pathValue?: string): string | null {
  const homeDir = os.homedir();
  const isWindows = process.platform === 'win32';
  const pathApi = isWindows ? path.win32 : path.posix;

  const customEntries = dedupePaths(parsePathEntries(pathValue));

  if (customEntries.length > 0) {
    const customResolution = resolveClaudeFromPathEntries(customEntries, isWindows);
    if (customResolution) {
      return customResolution;
    }
  }

  // On Windows, prefer native .exe, then cli.js. Avoid .cmd fallback
  // because it requires shell: true and breaks SDK stdio streaming.
  if (isWindows) {
    const exePaths: string[] = [
      pathApi.join(homeDir, '.claude', 'local', 'claude.exe'),
      pathApi.join(homeDir, 'AppData', 'Local', 'Claude', 'claude.exe'),
      pathApi.join(process.env.ProgramFiles || 'C:\\Program Files', 'Claude', 'claude.exe'),
      pathApi.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Claude', 'claude.exe'),
      pathApi.join(homeDir, '.local', 'bin', 'claude.exe'),
    ];

    for (const p of exePaths) {
      if (isExistingFile(p)) {
        return p;
      }
    }

    const cliJsPaths = getNpmCliJsPaths();
    for (const p of cliJsPaths) {
      if (isExistingFile(p)) {
        return p;
      }
    }

  }

  const commonPaths: string[] = [
    pathApi.join(homeDir, '.claude', 'local', 'claude'),
    pathApi.join(homeDir, '.local', 'bin', 'claude'),
    pathApi.join(homeDir, '.volta', 'bin', 'claude'),
    pathApi.join(homeDir, '.asdf', 'shims', 'claude'),
    pathApi.join(homeDir, '.asdf', 'bin', 'claude'),
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
    pathApi.join(homeDir, 'bin', 'claude'),
    pathApi.join(homeDir, '.npm-global', 'bin', 'claude'),
  ];

  const npmPrefix = getNpmGlobalPrefix();
  if (npmPrefix) {
    commonPaths.push(pathApi.join(npmPrefix, 'bin', 'claude'));
  }

  // NVM: resolve default version bin when NVM_BIN env var is not available (GUI apps)
  const nvmBin = resolveNvmDefaultBin(homeDir);
  if (nvmBin) {
    commonPaths.push(pathApi.join(nvmBin, 'claude'));
  }

  for (const p of commonPaths) {
    if (isExistingFile(p)) {
      return p;
    }
  }

  if (!isWindows) {
    const cliJsPaths = getNpmCliJsPaths();
    for (const p of cliJsPaths) {
      if (isExistingFile(p)) {
        return p;
      }
    }
  }

  const envEntries = dedupePaths(parsePathEntries(getEnvValue('PATH')));
  if (envEntries.length > 0) {
    const envResolution = resolveClaudeFromPathEntries(envEntries, isWindows);
    if (envResolution) {
      return envResolution;
    }
  }

  return null;
}
