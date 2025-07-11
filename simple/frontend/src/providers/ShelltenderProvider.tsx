import React, { createContext, useContext, ReactNode } from 'react';

interface ShelltenderConfig {
  websocketUrl?: string;
  apiUrl?: string;
  authKey?: string;
}

const ShelltenderContext = createContext<ShelltenderConfig>({
  websocketUrl: '/shelltender-ws',  // Use proxy path, will be rewritten to ws://shelltender:8080/ws
  apiUrl: '/shelltender-api',        // Use proxy path, will be rewritten to http://shelltender:8080
  authKey: 'pocketdev-monitor-key-2024'
});

export const useShelltenderConfig = () => {
  return useContext(ShelltenderContext);
};

interface ShelltenderProviderProps {
  children: ReactNode;
  config?: Partial<ShelltenderConfig>;
}

export const ShelltenderProvider: React.FC<ShelltenderProviderProps> = ({ 
  children, 
  config = {} 
}) => {
  const defaultConfig: ShelltenderConfig = {
    websocketUrl: '/shelltender-ws',  // Use proxy path
    apiUrl: '/shelltender-api',        // Use proxy path
    authKey: 'pocketdev-monitor-key-2024',
    ...config
  };

  return (
    <ShelltenderContext.Provider value={defaultConfig}>
      {children}
    </ShelltenderContext.Provider>
  );
};