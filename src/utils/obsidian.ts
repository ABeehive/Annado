export function getObsidianUrl(vaultPath: string, filePath: string): string {
  const vaultName = vaultPath.split('/').pop() || '';
  const relativePath = filePath.replace(vaultPath + '/', '');
  return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(relativePath)}`;
}

/** Open a note by name (Obsidian resolves `file=` by note name, like a wikilink). */
export function getObsidianNoteUrl(vaultPath: string, noteName: string): string {
  const vaultName = vaultPath.split('/').pop() || '';
  return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(noteName)}`;
}
