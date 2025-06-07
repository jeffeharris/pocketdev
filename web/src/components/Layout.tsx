import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Users, Settings as SettingsIcon } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center">
              <Users className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">PocketDev</h1>
                <p className="text-sm text-gray-500">AI Engineering Team</p>
              </div>
            </Link>
            
            <div className="flex items-center gap-4">
              {location.pathname === '/' && (
                <Link
                  to="/settings"
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <SettingsIcon className="h-4 w-4" />
                  Settings
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>
      
      {children}
    </div>
  );
}