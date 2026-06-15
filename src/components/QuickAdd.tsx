import { useState, useEffect, useRef, useMemo } from 'react';
import { useFocusWhen } from '../hooks/useFocus';
import { useTaskStore } from '../stores/taskStore';
import { WhenValue, ViewType } from '../types/task';
import { getTagColor, filterTagSuggestions } from '../utils/projectColors';
import { tagsInclude, resolveTagToAdd } from '../utils/tags';
import { WhenButton } from './WhenDatePicker';
import { DeadlineButton } from './DeadlinePicker';
import { ProjectSelector } from './ProjectSelector';
import { PrioritySelector } from './PrioritySelector';
import { DurationPicker } from './DurationPicker';
import { useSubtaskAdder, SubtaskInputRow, SubtaskToolbarButton } from './SubtaskAdder';
import { TagSuggestions } from './TagSuggestions';
import { WikilinkSuggestions } from './WikilinkSuggestions';
import { useWikilinkSuggest, applyWikilink, buildWikilinkKeyHandler } from '../hooks/useWikilinkSuggest';
import { TagIcon } from '../utils/viewIcons';
import { modalShadow } from '../utils/styles';
import { detectDateHint } from '../utils/detectDateHints';
import { DateHintBanner } from './DateHintBanner';

// Maps view types to default When values (all are string-based WhenValues)
const viewToWhen: Record<ViewType, WhenValue> = {
  inbox: 'inbox',
  today: 'today',
  upcoming: 'tomorrow',
  anytime: 'anytime',
  someday: 'someday',
  logbook: 'inbox',
  recurring: 'inbox',
  wrapped: 'inbox',
  agenda: 'inbox',
  'added-today': 'inbox',
  'smart-list': 'inbox',
  review: 'inbox',
};

export function QuickAdd() {
  const { createTask, currentView, selectedProject, updateTask, tagColors, availableTags, quickAddOpen: isOpen, quickAddPrefill: prefill, closeQuickAdd: onClose } = useTaskStore();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [when, setWhen] = useState<WhenValue>('inbox');
  const [project, setProject] = useState<string>('');
  const [deadline, setDeadline] = useState<string | null>(null);
  const [priority, setPriority] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [tagHighlightedIndex, setTagHighlightedIndex] = useState(-1);
  const [duration, setDuration] = useState<number | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const [titleCursor, setTitleCursor] = useState(0);
  const [notesCursor, setNotesCursor] = useState(0);
  const [titleWikiHighlight, setTitleWikiHighlight] = useState(-1);
  const [notesWikiHighlight, setNotesWikiHighlight] = useState(-1);
  const titleWiki = useWikilinkSuggest(title, titleCursor);
  const notesWiki = useWikilinkSuggest(notes, notesCursor);
  const wasOpenRef = useRef(false);
  const {
    isAddingSubtask, subtaskDraft, setSubtaskDraft, subtaskInputRef,
    openSubtaskInput, commit: commitSubtask, closeSubtaskInput, resetSubtaskAdder,
  } = useSubtaskAdder(notes, (newNotes) => setNotes(newNotes));

  const tagSuggestions = useMemo(() => filterTagSuggestions(tagInput, availableTags, tags), [tagInput, availableTags, tags]);
  const hint = useMemo(() => detectDateHint(title), [title]);
  const [dismissedPhrase, setDismissedPhrase] = useState<string | null>(null);
  const showHint = hint !== null
    && hint.matchedPhrase !== dismissedPhrase
    && (hint.type === 'when' ? when === 'inbox' : !deadline);

  // Handle initialization when opening
  useEffect(() => {
    // Only run when transitioning from closed to open
    if (isOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;

      if (prefill) {
        let initialTitle = prefill.title || '';
        if (prefill.person) {
          initialTitle = `[[${prefill.person}]] ${initialTitle}`.trim();
        }
        setTitle(initialTitle);
        setNotes(prefill.notes || '');
        setWhen((prefill.when as WhenValue) || viewToWhen[currentView]);
        setProject(prefill.project || selectedProject || '');
        setDeadline(prefill.deadline || null);
        setShowNotes(!!prefill.notes);
      } else {
        setTitle('');
        setNotes('');
        setWhen(viewToWhen[currentView]);
        setProject(selectedProject || '');
        setDeadline(null);
        setPriority(null);
        setTags([]);
        setTagInput('');
        setDuration(null);
        setShowNotes(false);
      }
    } else if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen, currentView, selectedProject, prefill]);

  useFocusWhen(inputRef, isOpen);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      // Build title with priority if set
      let finalTitle = title.trim();
      if (priority) {
        finalTitle = `${finalTitle} !(${priority})`;
      }

      const newTask = await createTask({
        title: finalTitle,
        when: when,
      });

      // Update with project, notes, deadline, duration, and/or tags if provided
      if (project || notes.trim() || deadline || tags.length > 0 || duration) {
        await updateTask({
          id: newTask.id,
          ...(project && { projects: [project] }),
          ...(notes.trim() && { notes: notes.trim() }),
          ...(deadline && { deadline }),
          ...(tags.length > 0 && { tags }),
          ...(duration && { durationMinutes: duration }),
        });
      }

      setTitle('');
      setNotes('');
      setPriority(null);
      setTags([]);
      setTagInput('');
      setShowNotes(false);
      resetSubtaskAdder();
      onClose();
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 dark:bg-black/40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={`task-expanded relative w-full max-w-2xl mx-4 overflow-x-clip bg-white dark:bg-[#2A2A2A] rounded-xl ${modalShadow} flex flex-col max-h-[80vh]`}>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          {/* Title input */}
          <div className="flex items-start gap-4 px-5 py-4 flex-shrink-0">
            {/* Checkbox placeholder */}
            <div className="mt-1 w-[20px] h-[20px] rounded-full border-[1.5px] border-[#C4C4C4] dark:border-[#555] flex-shrink-0" />

            {/* Title with wikilink autocomplete */}
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setTitleCursor(e.target.selectionStart ?? 0); setTitleWikiHighlight(-1); }}
                onClick={(e) => setTitleCursor((e.target as HTMLInputElement).selectionStart ?? 0)}
                onKeyUp={(e) => setTitleCursor((e.target as HTMLInputElement).selectionStart ?? 0)}
                onKeyDown={buildWikilinkKeyHandler(titleWiki.suggestions, titleWikiHighlight, title, titleCursor, inputRef, setTitleWikiHighlight, setTitle, setTitleCursor, handleKeyDown)}
                placeholder="New To-Do"
                className="task-input w-full text-[15px] bg-transparent text-[#1A1A1A] dark:text-[#E8E8E8] placeholder-[#A0A0A0] dark:placeholder-[#666] focus:outline-none font-normal"
              />
              <WikilinkSuggestions
                suggestions={titleWiki.suggestions}
                highlightedIndex={titleWikiHighlight}
                onSelect={(name) => {
                  const { newValue, newCursorPos } = applyWikilink(title, titleCursor, name);
                  setTitle(newValue);
                  setTitleCursor(newCursorPos);
                  setTitleWikiHighlight(-1);
                  setTimeout(() => { if (inputRef.current) { inputRef.current.selectionStart = inputRef.current.selectionEnd = newCursorPos; inputRef.current.focus(); } }, 0);
                }}
              />
            </div>
          </div>

          {/* Date hint banner */}
          {showHint && (
            <DateHintBanner
              hint={hint!}
              onAccept={() => {
                if (hint!.type === 'when') setWhen(hint!.whenValue);
                else setDeadline(hint!.dateString);
                setTitle(hint!.cleanTitle);
                setDismissedPhrase(hint!.matchedPhrase);
              }}
              onDismiss={() => setDismissedPhrase(hint!.matchedPhrase)}
            />
          )}

          {/* Notes with wikilink autocomplete — outside overflow container so popup isn't clipped */}
          <div className="px-5 pb-4 pl-14 relative">
            <textarea
              ref={notesRef}
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setNotesCursor(e.target.selectionStart ?? 0); setNotesWikiHighlight(-1); }}
              onClick={(e) => setNotesCursor((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
              onKeyUp={(e) => setNotesCursor((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
              onKeyDown={buildWikilinkKeyHandler(notesWiki.suggestions, notesWikiHighlight, notes, notesCursor, notesRef, setNotesWikiHighlight, setNotes, setNotesCursor, handleKeyDown)}
              onFocus={() => setShowNotes(true)}
              rows={showNotes ? 3 : 1}
              placeholder="Notes"
              className="task-input w-full text-[14px] text-[#555] dark:text-[#999] bg-transparent focus:outline-none resize-none placeholder-[#AAA] dark:placeholder-[#666] leading-relaxed"
            />
            <WikilinkSuggestions
              suggestions={notesWiki.suggestions}
              highlightedIndex={notesWikiHighlight}
              onSelect={(name) => {
                const { newValue, newCursorPos } = applyWikilink(notes, notesCursor, name);
                setNotes(newValue);
                setNotesCursor(newCursorPos);
                setNotesWikiHighlight(-1);
                setTimeout(() => { if (notesRef.current) { notesRef.current.selectionStart = notesRef.current.selectionEnd = newCursorPos; notesRef.current.focus(); } }, 0);
              }}
            />
          </div>

          {/* Scrollable content area */}
          <div className="overflow-y-auto flex-1 min-h-0">

          {/* Inline subtask input */}
          {isAddingSubtask && (
            <SubtaskInputRow
              draft={subtaskDraft}
              setDraft={setSubtaskDraft}
              inputRef={subtaskInputRef}
              onCommit={commitSubtask}
              onClose={closeSubtaskInput}
              className="px-5 pb-3 pl-14"
            />
          )}

          </div>{/* end scrollable content */}

          {/* Bottom toolbar */}
          <div className="flex flex-wrap items-center gap-2 px-5 py-3 bg-[#FAFAFA] dark:bg-[#252525] rounded-b-xl flex-shrink-0">
            {/* When date picker */}
            <WhenButton value={when} onChange={setWhen} />

            {/* Deadline picker */}
            <DeadlineButton value={deadline} onChange={setDeadline} />

            {/* Project selector */}
            <ProjectSelector value={project} onChange={setProject} />

            {/* Priority selector */}
            <PrioritySelector value={priority} onChange={setPriority} />

            {/* Duration picker */}
            <DurationPicker value={duration} onChange={setDuration} />

            {/* Subtask button */}
            <SubtaskToolbarButton count={0} onClick={openSubtaskInput} />

            {/* Tag input */}
            <div className="flex items-center gap-1.5">
              <TagIcon className="w-4 h-4 text-primary flex-shrink-0" circleFill="currentColor" />
              {tags.map((tag) => {
                const color = getTagColor(tag, tagColors);
                return (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: `${color}20`, color }}
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => setTags(tags.filter((t) => t !== tag))}
                      className="hover:text-danger transition-colors"
                    >
                      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                );
              })}
              <div className="relative">
                <input
                  ref={tagInputRef}
                  type="text"
                  value={tagInput}
                  onChange={(e) => { setTagInput(e.target.value); setTagHighlightedIndex(-1); }}
                  onKeyDown={(e) => {
                    if (tagSuggestions.length > 0) {
                      if (e.key === 'ArrowDown') { e.preventDefault(); setTagHighlightedIndex(i => Math.min(i + 1, tagSuggestions.length - 1)); return; }
                      if (e.key === 'ArrowUp') { e.preventDefault(); setTagHighlightedIndex(i => Math.max(i - 1, -1)); return; }
                    }
                    if (e.key === 'Enter' || e.key === 'Tab' || e.key === ',') {
                      const name = resolveTagToAdd(tagInput, tagSuggestions, tagHighlightedIndex, availableTags);
                      if (name) {
                        e.preventDefault();
                        if (!tagsInclude(tags, name)) setTags([...tags, name]);
                        setTagInput('');
                        setTagHighlightedIndex(-1);
                      }
                      return;
                    }
                    if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
                      setTags(tags.slice(0, -1));
                    }
                    if (e.key === 'Escape') { setTagInput(''); setTagHighlightedIndex(-1); }
                  }}
                  placeholder={tags.length === 0 ? 'Tags' : ''}
                  className="task-input text-[12px] bg-transparent text-[#1A1A1A] dark:text-[#E0E0E0] placeholder-[#AAA] dark:placeholder-[#666] focus:outline-none w-16"
                />
                <TagSuggestions
                  suggestions={tagSuggestions}
                  highlightedIndex={tagHighlightedIndex}
                  onSelect={(name) => {
                    if (!tagsInclude(tags, name)) setTags([...tags, name]);
                    setTagInput('');
                    setTagHighlightedIndex(-1);
                    tagInputRef.current?.focus();
                  }}
                  tagColors={tagColors}
                  anchorRef={tagInputRef}
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-[12px] text-[#888] dark:text-[#666] hover:text-[#1A1A1A] dark:hover:text-[#E0E0E0] transition-colors rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title.trim()}
                className="px-4 py-1.5 text-[12px] bg-primary text-white rounded-lg hover:bg-[#4A5AAF] disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
