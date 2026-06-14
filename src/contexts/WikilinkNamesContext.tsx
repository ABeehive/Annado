import { createContext, useContext } from 'react';

/**
 * Person/project name sets used to render `[[wikilinks]]` in task titles and
 * notes. Computed once per list (from availablePeople/availableProjects) and
 * shared via context so each row doesn't rebuild its own Sets.
 */
export interface WikilinkNames {
  personNames: Set<string>;
  projectNames: Set<string>;
}

const EMPTY: WikilinkNames = { personNames: new Set(), projectNames: new Set() };

const WikilinkNamesContext = createContext<WikilinkNames>(EMPTY);

export const WikilinkNamesProvider = WikilinkNamesContext.Provider;

export function useWikilinkNames(): WikilinkNames {
  return useContext(WikilinkNamesContext);
}
