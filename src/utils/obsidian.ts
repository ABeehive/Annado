export function normalizePathSeparators(path: string): string {
  return path.replace(/\\/g, '/');
}

export function getPathBaseName(path: string): string {
  const normalized = normalizePathSeparators(path).replace(/\/+$/, '');
  return normalized.split('/').pop() || '';
}

export function isAbsolutePath(path: string): boolean {
  return /^([a-zA-Z]:[\\/]|\\\\|\/)/.test(path);
}

export function joinVaultPath(vaultPath: string, filePath: string): string {
  if (isAbsolutePath(filePath)) return filePath;
  const separator = vaultPath.includes('\\') && !vaultPath.includes('/') ? '\\' : '/';
  return `${vaultPath.replace(/[\\/]+$/, '')}${separator}${filePath.replace(/[\\/]+/g, separator)}`;
}

function getVaultRelativePath(vaultPath: string, filePath: string): string {
  const normalizedFile = normalizePathSeparators(filePath);
  if (!isAbsolutePath(filePath)) return normalizedFile.replace(/^\/+/, '');

  const normalizedVault = normalizePathSeparators(vaultPath).replace(/\/+$/, '');
  const vaultPrefix = `${normalizedVault}/`;
  if (normalizedFile.toLowerCase().startsWith(vaultPrefix.toLowerCase())) {
    return normalizedFile.slice(vaultPrefix.length);
  }

  return normalizedFile.replace(/^\/+/, '');
}

export function getObsidianUrl(vaultPath: string, filePath: string): string {
  const vaultName = getPathBaseName(vaultPath);
  const relativePath = getVaultRelativePath(vaultPath, filePath);
  return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(relativePath)}`;
}

/** Open a note by name (Obsidian resolves `file=` by note name, like a wikilink). */
export function getObsidianNoteUrl(vaultPath: string, noteName: string): string {
  const vaultName = getPathBaseName(vaultPath);
  return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(noteName)}`;
}
