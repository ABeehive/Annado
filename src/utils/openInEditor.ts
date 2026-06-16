import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { getObsidianUrl, joinVaultPath, normalizePathSeparators } from './obsidian';
import type { EditorType } from '../types/task';

function getVsCodeFileUrl(filePath: string, lineNumber: number): string {
  return `vscode://file/${encodeURI(normalizePathSeparators(filePath))}:${lineNumber}`;
}

export async function openInEditor(
  vaultPath: string,
  filePath: string,
  lineNumber: number,
  isObsidianVault: boolean,
  editorType: EditorType,
  customCommand: string,
): Promise<void> {
  const absolutePath = joinVaultPath(vaultPath, filePath);

  if (isObsidianVault) {
    await openUrl(getObsidianUrl(vaultPath, filePath));
  } else if (editorType === 'vscode') {
    await openUrl(getVsCodeFileUrl(absolutePath, lineNumber));
  } else {
    await invoke('open_file_in_editor', { filePath: absolutePath, lineNumber, editorType, customCommand });
  }
}

export function editorLabel(isObsidianVault: boolean, editorType: EditorType): string {
  if (isObsidianVault) return 'Open in Obsidian';
  const labels: Record<EditorType, string> = {
    vscode: 'Open in VS Code',
    sublime: 'Open in Sublime',
    system: 'Open file',
    custom: 'Open in editor',
  };
  return labels[editorType] ?? 'Open file';
}
