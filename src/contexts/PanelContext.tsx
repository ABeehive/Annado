import { createContext, useContext } from 'react';

export type PanelId = 'main' | 'sidePanel';

interface PanelContextValue {
  panelId: PanelId;
}

const PanelContext = createContext<PanelContextValue>({ panelId: 'main' });

export const PanelProvider = PanelContext.Provider;

export function usePanelId(): PanelId {
  return useContext(PanelContext).panelId;
}
