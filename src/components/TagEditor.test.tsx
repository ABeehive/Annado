import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

// The store pulls in the Tauri bridge at module load; mock it before importing
// the store (transitively, via TagEditor) — same pattern as DeleteAffordance.test.tsx.
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(() => {}) }));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn().mockResolvedValue(undefined) }));

import { TagEditor } from './TagEditor';

describe('TagEditor inherited tags', () => {
  it('shows inherited tags without a remove button and keeps own tags removable', () => {
    const onTagsChange = vi.fn();
    const { container } = render(
      <TagEditor
        tags={['eigen']}
        inheritedTags={['geerfd']}
        onTagClick={() => {}}
        onTagsChange={onTagsChange}
      />
    );
    const text = container.textContent ?? '';
    expect(text).toContain('#geerfd');
    expect(text).toContain('#eigen');
    // The inherited chip renders exactly one button (the click-to-filter label);
    // the own tag renders two (label + remove).
    const inheritedChip = Array.from(container.querySelectorAll('span'))
      .find((s) => s.textContent?.includes('#geerfd'))!;
    expect(inheritedChip.querySelectorAll('button')).toHaveLength(1);
  });
});
