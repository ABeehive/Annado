/** Strip [[wikilinks]] → plain text, e.g. "Task [[Project]]" → "Task Project" */
export function stripWikilinks(text: string): string {
  return text.replace(/\[\[([^\]]+)\]\]/g, '$1');
}
