import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { openInEditor } from './openInEditor';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => Promise.resolve()),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn(() => Promise.resolve()),
}));

describe('openInEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds encoded VS Code URLs for Windows paths with spaces', async () => {
    await openInEditor(
      String.raw`C:\Users\demo\Vault`,
      'Daily Notes/Task File.md',
      12,
      false,
      'vscode',
      ''
    );

    expect(openUrl).toHaveBeenCalledWith(
      'vscode://file/C:/Users/demo/Vault/Daily%20Notes/Task%20File.md:12'
    );
  });

  it('passes absolute Windows paths to native editor commands', async () => {
    await openInEditor(
      String.raw`C:\Users\demo\Vault`,
      'Daily Notes/Task File.md',
      5,
      false,
      'system',
      ''
    );

    expect(invoke).toHaveBeenCalledWith('open_file_in_editor', {
      filePath: String.raw`C:\Users\demo\Vault\Daily Notes\Task File.md`,
      lineNumber: 5,
      editorType: 'system',
      customCommand: '',
    });
  });
});
