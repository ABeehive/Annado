import { useState, useRef, KeyboardEvent } from 'react';
import { useTaskStore } from '../stores/taskStore';
import { ModalShell } from './ModalShell';
import { MultiSelectDropdown } from './MultiSelectDropdown';
import { useFocusOnMount } from '../hooks/useFocus';
import { formInputClass, formLabelClass } from '../utils/styles';

interface CreatePersonModalProps {
  onClose: () => void;
  initialName?: string;
}

export function CreatePersonModal({ onClose, initialName }: CreatePersonModalProps) {
  const { createPerson, availableProjects } = useTaskStore();
  const [name, setName] = useState(initialName ?? '');
  const [organisation, setOrganisation] = useState('');
  const [relationship, setRelationship] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [langInput, setLangInput] = useState('');
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useFocusOnMount(nameRef);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await createPerson(name.trim(), {
        organisation: organisation.trim() || undefined,
        relationship: relationship.trim() || undefined,
        languages: languages.length > 0 ? languages : undefined,
        projects: selectedProjects.length > 0 ? selectedProjects : undefined,
      });
      onClose();
    } catch (error) {
      console.error('Failed to create person:', error);
      setIsSubmitting(false);
    }
  };

  const handleLangKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && langInput.trim()) {
      e.preventDefault();
      const val = langInput.trim().replace(/,$/, '');
      if (val && !languages.includes(val)) setLanguages(prev => [...prev, val]);
      setLangInput('');
    } else if (e.key === 'Backspace' && !langInput && languages.length > 0) {
      setLanguages(prev => prev.slice(0, -1));
    }
  };

  const handleLangPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (text.includes(',')) {
      e.preventDefault();
      const parts = text.split(',').map(s => s.trim()).filter(Boolean);
      setLanguages(prev => [...new Set([...prev, ...parts])]);
    }
  };

  const removeLanguage = (lang: string) => setLanguages(prev => prev.filter(l => l !== lang));

  return (
    <ModalShell
      title="New Person"
      submitLabel="Create Person"
      onClose={onClose}
      onSubmit={handleSubmit}
      disabled={!name.trim() || isSubmitting}
    >
      <div>
        <label className={formLabelClass}>Name</label>
        <input
          ref={nameRef}
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
          placeholder="Full name"
          className={formInputClass}
        />
      </div>

      <div>
        <label className={formLabelClass}>Organisation</label>
        <input
          type="text"
          value={organisation}
          onChange={e => setOrganisation(e.target.value)}
          placeholder="Company or organisation"
          className={formInputClass}
        />
      </div>

      <div>
        <label className={formLabelClass}>Relationship</label>
        <input
          type="text"
          value={relationship}
          onChange={e => setRelationship(e.target.value)}
          placeholder="e.g. colleague, client, friend"
          className={formInputClass}
        />
      </div>

      <div>
        <label className={formLabelClass}>Languages</label>
        <div className="flex flex-wrap gap-1.5 items-center px-2.5 py-2 bg-[#F5F5F5] dark:bg-[#333] border border-[#E8E8E8] dark:border-[#3A3A3A] rounded-lg focus-within:border-primary">
          {languages.map(lang => (
            <span key={lang} className="flex items-center gap-1 px-2 py-0.5 text-[12px] bg-[#EEF0FB] dark:bg-[#2D3055] text-primary rounded-full">
              {lang}
              <button type="button" onClick={() => removeLanguage(lang)} className="hover:text-danger transition-colors">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </span>
          ))}
          <input
            type="text"
            value={langInput}
            onChange={e => setLangInput(e.target.value)}
            onKeyDown={handleLangKeyDown}
            onPaste={handleLangPaste}
            placeholder={languages.length === 0 ? 'Type and press Enter…' : ''}
            className="flex-1 min-w-[120px] text-[13px] bg-transparent text-[#1A1A1A] dark:text-[#E0E0E0] placeholder-[#999] focus:outline-none"
          />
        </div>
      </div>

      <MultiSelectDropdown
        label="Related Projects"
        items={availableProjects}
        selected={selectedProjects}
        onChange={setSelectedProjects}
      />
    </ModalShell>
  );
}
