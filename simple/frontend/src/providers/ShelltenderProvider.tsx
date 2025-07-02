import React, { createContext, useContext, ReactNode } from 'react';

interface ShelltenderConfig {
  websocketUrl?: string;
  apiUrl?: string;
  authKey?: string;
}

const ShelltenderContext = createContext<ShelltenderConfig>({
  websocketUrl: 'ws://localhost:8080',
  apiUrl: 'http://localhost:8081',
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
    websocketUrl: 'ws://localhost:8080',
    apiUrl: 'http://localhost:8081',
    authKey: 'pocketdev-monitor-key-2024',
    ...config
  };

  return (
    <ShelltenderContext.Provider value={defaultConfig}>
      {children}
    </ShelltenderContext.Provider>
  );
};