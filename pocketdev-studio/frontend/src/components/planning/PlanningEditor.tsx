import React, { useState } from 'react';
import { X, Save, Eye, Edit3 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface PlanningEditorProps {
  isOpen: boolean;
  content: string;
  projectName: string;
  onClose: () => void;
  onSave: (content: string) => Promise<void>;
}

export const PlanningEditor: React.FC<PlanningEditorProps> = ({
  isOpen,
  content,
  projectName,
  onClose,
  onSave
}) => {
  const [editContent, setEditContent] = useState(content);
  const [isPreview, setIsPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editContent);
      onClose();
    } catch (error) {
      console.error('Failed to save:', error);
      alert('Failed to save planning document. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      
      <div className="absolute inset-4 sm:inset-8 lg:inset-12 bg-white rounded-lg shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            Edit Planning - {projectName}
          </h2>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsPreview(!isPreview)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {isPreview ? (
                <>
                  <Edit3 className="w-4 h-4" />
                  Edit
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  Preview
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {isPreview ? (
            <div className="h-full overflow-y-auto p-6">
              <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-ul:list-disc prose-li:marker:text-gray-600 prose-strong:text-gray-900">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{editContent}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full h-full p-6 font-mono text-sm text-gray-900 bg-gray-50 border-0 resize-none focus:outline-none focus:ring-0"
              placeholder="# Project Planning"
              spellCheck={false}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t">
          <div className="text-sm text-gray-500">
            {isPreview ? 'Preview mode' : 'Markdown supported'}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};