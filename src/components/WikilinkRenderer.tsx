import { useState } from 'react';
import { ProjectInfo } from '../types/task';
import { RenderTitleWithLinks } from '../utils/RenderTitleWithLinks';
import { ContextMenu } from './ContextMenu';
import { CreatePersonModal } from './CreatePersonModal';
import { CreateProjectModal } from './CreateProjectModal';

interface WikilinkRendererProps {
  title: string;
  personNames: Set<string>;
  projectNames: Set<string>;
  onPersonClick: (name: string) => void;
  onProjectClick: (name: string) => void;
  onRemoveLink?: (rawWikitext: string) => void;
  projectColors: Record<string, string>;
  availableProjects: ProjectInfo[];
  className?: string;
  isObsidianVault?: boolean;
  /** Also render bare https?:// URLs as clickable links (notes contexts) */
  autolinkUrls?: boolean;
  /** Unknown [[wikilinks]] open the note in Obsidian; create menu moves to right-click */
  openUnknownWikilinks?: boolean;
}

export function WikilinkRenderer(props: WikilinkRendererProps) {
  const [contextMenu, setContextMenu] = useState<{ name: string; x: number; y: number } | null>(null);
  const [creating, setCreating] = useState<'person' | 'project' | null>(null);
  const [pendingName, setPendingName] = useState('');

  const handleUnknownLinkClick = (name: string, x: number, y: number) => {
    setContextMenu({ name, x, y });
  };

  const handleCreate = (type: 'person' | 'project') => {
    setPendingName(contextMenu!.name);
    setCreating(type);
    setContextMenu(null);
  };

  return (
    <>
      <RenderTitleWithLinks
        {...props}
        onUnknownLinkClick={handleUnknownLinkClick}
        onRemoveLink={props.onRemoveLink}
      />

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            { label: 'Create Person', onClick: () => handleCreate('person') },
            { label: 'Create Project', onClick: () => handleCreate('project') },
          ]}
        />
      )}

      {creating === 'person' && (
        <CreatePersonModal
          initialName={pendingName}
          onClose={() => setCreating(null)}
        />
      )}

      {creating === 'project' && (
        <CreateProjectModal
          initialName={pendingName}
          parentFolder={null}
          onClose={() => setCreating(null)}
        />
      )}
    </>
  );
}
