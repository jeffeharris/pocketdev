import React, { useState, useEffect } from 'react';
import { X, Github, Check, AlertCircle, Loader2 } from 'lucide-react';
import { settingsApi } from '../../services/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GitHubStatus {
  valid: boolean;
  user?: {
    login: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
  error?: string;
}

/**
 * Modal for managing application settings
 * 
 * Features:
 * - GitHub token configuration with validation
 * - Git user configuration (name and email)
 * - Real-time connection status display
 * - Secure token input (password field)
 */
export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose
}) => {
  const [githubToken, setGithubToken] = useState('');
  const [gitUserName, setGitUserName] = useState('');
  const [gitUserEmail, setGitUserEmail] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [githubStatus, setGithubStatus] = useState<GitHubStatus | null>(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [autoFilledFields, setAutoFilledFields] = useState<{name: boolean, email: boolean}>({
    name: false,
    email: false
  });

  // Load settings when modal opens
  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const settings = await settingsApi.getSettings();
      setHasToken(settings.hasGithubToken);
      setGitUserName(settings.gitUserName || '');
      setGitUserEmail(settings.gitUserEmail || '');
      
      // If there's a token, validate it
      if (settings.hasGithubToken) {
        validateGithubToken();
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const validateGithubToken = async () => {
    try {
      const result = await settingsApi.testGithubToken();
      setGithubStatus(result);
      
      // Auto-populate git config from GitHub user info if not already set
      if (result.valid && result.user) {
        if (!gitUserName && result.user.name) {
          setGitUserName(result.user.name);
          setAutoFilledFields(prev => ({ ...prev, name: true }));
        }
        if (!gitUserEmail && result.user.email) {
          setGitUserEmail(result.user.email);
          setAutoFilledFields(prev => ({ ...prev, email: true }));
        }
      }
    } catch (error) {
      setGithubStatus({ valid: false, error: 'Failed to validate token' });
    }
  };

  const handleSave = async () => {
    // Validate inputs
    if (!githubToken && !hasToken) {
      setSaveMessage('GitHub token is required');
      return;
    }

    setIsSaving(true);
    setSaveMessage('');
    
    try {
      await settingsApi.updateSettings({
        githubToken: githubToken || undefined,
        gitUserName,
        gitUserEmail
      });
      
      setSaveMessage('Settings saved successfully');
      setHasToken(true);
      setGithubToken(''); // Clear token from UI for security
      
      // Revalidate connection
      if (githubToken || hasToken) {
        validateGithubToken();
      }
      
      // Clear success message after 3 seconds
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      setSaveMessage('Failed to save settings');
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              {/* GitHub Configuration */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">GitHub Configuration</h3>
                
                {/* Connection Status */}
                {githubStatus && (
                  <div className="mb-4">
                    {githubStatus.valid ? (
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-green-100 text-green-700 border border-green-300">
                        {githubStatus.user?.avatarUrl ? (
                          <img 
                            src={githubStatus.user.avatarUrl} 
                            alt={githubStatus.user.login}
                            className="w-6 h-6 rounded-full"
                          />
                        ) : (
                          <Github className="w-4 h-4" />
                        )}
                        <span>{githubStatus.user?.login}</span>
                        <Check className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-red-100 text-red-700 border border-red-300">
                        <AlertCircle className="w-4 h-4" />
                        <span>{githubStatus.error || 'Invalid token'}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* GitHub Token */}
                <div className="space-y-2">
                  <label htmlFor="github-token" className="block text-sm font-medium text-gray-700">
                    Personal Access Token
                  </label>
                  <input
                    type="password"
                    id="github-token"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder={hasToken ? "Token already configured (leave blank to keep)" : "ghp_xxxxxxxxxxxx"}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <div className="text-xs text-gray-500 space-y-1">
                    <p>
                      <a 
                        href="https://github.com/settings/personal-access-tokens/new" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline"
                      >
                        Generate a Fine-grained Personal Access Token on GitHub
                      </a>
                      <span className="text-gray-400 ml-1">(recommended)</span>
                    </p>
                    <p className="text-xs">
                      Required permissions: <span className="font-medium">Contents</span> (Read/Write), 
                      <span className="font-medium"> Pull requests</span> (Read/Write), 
                      <span className="font-medium"> Metadata</span> (Read)
                    </p>
                  </div>
                </div>
              </div>

              {/* Git Configuration */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Git Configuration</h3>
                
                {/* Git User Name */}
                <div className="space-y-2 mb-4">
                  <label htmlFor="git-name" className="block text-sm font-medium text-gray-700">
                    Name
                  </label>
                  <input
                    type="text"
                    id="git-name"
                    value={gitUserName}
                    onChange={(e) => {
                      setGitUserName(e.target.value);
                      setAutoFilledFields(prev => ({ ...prev, name: false }));
                    }}
                    placeholder="John Doe"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500">
                    Used for git commits (git config user.name)
                    {autoFilledFields.name && (
                      <span className="text-green-600 ml-1">(auto-filled from GitHub)</span>
                    )}
                  </p>
                </div>

                {/* Git User Email */}
                <div className="space-y-2">
                  <label htmlFor="git-email" className="block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <input
                    type="email"
                    id="git-email"
                    value={gitUserEmail}
                    onChange={(e) => {
                      setGitUserEmail(e.target.value);
                      setAutoFilledFields(prev => ({ ...prev, email: false }));
                    }}
                    placeholder="john@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500">
                    Used for git commits (git config user.email)
                    {autoFilledFields.email && (
                      <span className="text-green-600 ml-1">(auto-filled from GitHub)</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Info Message */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <p className="text-sm text-blue-700">
                  These settings will be applied to new terminal sessions. Existing sessions with running processes will continue using their current configuration.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <div>
            {saveMessage && (
              <p className={`text-sm ${saveMessage.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                {saveMessage}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};