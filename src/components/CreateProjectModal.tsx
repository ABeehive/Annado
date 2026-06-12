import { useState, useRef } from 'react';
import { useTaskStore } from '../stores/taskStore';
import { ModalShell } from './ModalShell';
import { MultiSelectDropdown } from './MultiSelectDropdown';
import { useFocusOnMount } from '../hooks/useFocus';
import { formInputClass, formLabelClass } from '../utils/styles';

interface MilestoneRow {
  id: number;
  name: string;
  end: string | null;
}

interface CreateProjectModalProps {
  parentFolder: string | null;
  onClose: () => void;
  initialName?: string;
}

export function CreateProjectModal({ parentFolder, onClose, initialName }: CreateProjectModalProps) {
  const { createProject, availablePeople } = useTaskStore();
  const [name, setName] = useState(initialName ?? '');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState<string | null>(null);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [nextMilestoneId, setNextMilestoneId] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useFocusOnMount(nameRef);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await createProject(name.trim(), parentFolder, {
        description: description.trim() || undefined,
        deadline: deadline || undefined,
        persons: selectedPeople,
        milestones: milestones
          .filter(m => m.name.trim())
          .map(m => ({ name: m.name.trim(), end: m.end || undefined })),
      });
      onClose();
    } catch (error) {
      console.error('Failed to create project:', error);
      setIsSubmitting(false);
    }
  };

  const addMilestone = () => {
    setMilestones(prev => [...prev, { id: nextMilestoneId, name: '', end: null }]);
    setNextMilestoneId(n => n + 1);
  };

  const updateMilestone = (id: number, changes: Partial<MilestoneRow>) => {
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, ...changes } : m));
  };

  const removeMilestone = (id: number) => {
    setMilestones(prev => prev.filter(m => m.id !== id));
  };

  return (
    <ModalShell
      title={parentFolder ? 'New Subproject' : 'New Project'}
      submitLabel="Create Project"
      onClose={onClose}
      onSubmit={handleSubmit}
      disabled={!name.trim() || isSubmitting}
    >
      {parentFolder && (
        <div className="flex items-center gap-1.5 text-[12px] text-[#888]">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5" /></svg>
          Under: <span className="text-[#555] dark:text-[#AAA] font-medium">{parentFolder}</span>
        </div>
      )}

      <div>
        <label className={formLabelClass}>Name</label>
        <input
          ref={nameRef}
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
          placeholder="Project name"
          className={formInputClass}
        />
      </div>

      <div>
        <label className={formLabelClass}>Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What is this project about?"
          rows={2}
          className={formInputClass + ' resize-none'}
        />
      </div>

      <div>
        <label className={formLabelClass}>Deadline</label>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={deadline ?? ''}
            onChange={e => setDeadline(e.target.value || null)}
            className={formInputClass}
          />
          {deadline && (
            <button type="button" onClick={() => setDeadline(null)}
              className="text-[#BBB] hover:text-danger transition-colors flex-shrink-0">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      <MultiSelectDropdown
        label="People"
        items={availablePeople}
        selected={selectedPeople}
        onChange={setSelectedPeople}
      />

      <div>
        <label className={formLabelClass}>Milestones</label>
        <div className="space-y-2">
          {milestones.map(m => (
            <div key={m.id} className="flex items-center gap-2">
              <input
                type="text"
                value={m.name}
                onChange={e => updateMilestone(m.id, { name: e.target.value })}
                placeholder="Milestone name"
                className="flex-1 text-[13px] bg-[#F5F5F5] dark:bg-[#333] border border-[#E8E8E8] dark:border-[#3A3A3A] rounded-lg px-2.5 py-1.5 text-[#1A1A1A] dark:text-[#E0E0E0] placeholder-[#999] focus:outline-none focus:border-primary"
              />
              <input
                type="date"
                value={m.end ?? ''}
                onChange={e => updateMilestone(m.id, { end: e.target.value || null })}
                className="text-[13px] bg-[#F5F5F5] dark:bg-[#333] border border-[#E8E8E8] dark:border-[#3A3A3A] rounded-lg px-2.5 py-1.5 text-[#1A1A1A] dark:text-[#E0E0E0] focus:outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => removeMilestone(m.id)}
                className="text-[#BBB] hover:text-danger transition-colors flex-shrink-0"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
          <button type="button" onClick={addMilestone} className="text-[12px] text-primary hover:underline transition-colors">
            + Add milestone
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
