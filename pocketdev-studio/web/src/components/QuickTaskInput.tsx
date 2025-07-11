import React, { useState } from 'react';
import { Send, Mic, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  onTaskSubmit: (task: QuickTask) => void;
  isProcessing?: boolean;
}

interface QuickTask {
  description: string;
  type: 'feature' | 'bug' | 'refactor' | 'test';
  urgency: 'normal' | 'urgent';
}

export function QuickTaskInput({ onTaskSubmit, isProcessing = false }: Props) {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);

  // Example prompts for inspiration
  const examples = [
    "Add a dark mode toggle to settings",
    "Fix the login button not working on mobile",
    "Add loading spinner to data fetch",
    "Create tests for the user profile component"
  ];

  const detectTaskType = (description: string): QuickTask['type'] => {
    const lower = description.toLowerCase();
    if (lower.includes('fix') || lower.includes('bug') || lower.includes('broken')) return 'bug';
    if (lower.includes('test') || lower.includes('spec')) return 'test';
    if (lower.includes('refactor') || lower.includes('clean')) return 'refactor';
    return 'feature';
  };

  const detectUrgency = (description: string): QuickTask['urgency'] => {
    const lower = description.toLowerCase();
    if (lower.includes('urgent') || lower.includes('asap') || lower.includes('critical')) return 'urgent';
    return 'normal';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const task: QuickTask = {
      description: input.trim(),
      type: detectTaskType(input),
      urgency: detectUrgency(input)
    };

    onTaskSubmit(task);
    setInput('');
  };

  const handleVoiceInput = async () => {
    if (!('webkitSpeechRecognition' in window)) {
      toast.error('Voice input not supported in this browser');
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
    };

    recognition.onerror = () => {
      toast.error('Voice recognition failed');
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const handleExampleClick = (example: string) => {
    setInput(example);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          What do you want to build?
        </h2>
        <p className="text-sm text-gray-600">
          Just describe what you need. I'll figure out the details.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add a dark mode toggle to the settings page..."
            className="w-full px-4 py-3 pr-24 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
            disabled={isProcessing || isListening}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-2">
            <button
              type="button"
              onClick={handleVoiceInput}
              disabled={isProcessing || isListening}
              className={`p-2 rounded-full transition-colors ${
                isListening 
                  ? 'bg-red-500 text-white animate-pulse' 
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
              title="Voice input"
            >
              <Mic className="h-5 w-5" />
            </button>
            <button
              type="submit"
              disabled={!input.trim() || isProcessing}
              className={`p-2 rounded-full transition-colors ${
                input.trim() && !isProcessing
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Example tasks for inspiration */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-gray-500">Try:</span>
          {examples.map((example, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleExampleClick(example)}
              className="text-xs px-3 py-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
            >
              {example}
            </button>
          ))}
        </div>
      </form>

      {/* Task type indicator */}
      {input && (
        <div className="mt-4 flex items-center gap-4 text-sm">
          <span className="text-gray-500">Detected:</span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            detectTaskType(input) === 'bug' ? 'bg-red-100 text-red-700' :
            detectTaskType(input) === 'test' ? 'bg-purple-100 text-purple-700' :
            detectTaskType(input) === 'refactor' ? 'bg-yellow-100 text-yellow-700' :
            'bg-blue-100 text-blue-700'
          }`}>
            {detectTaskType(input)}
          </span>
          {detectUrgency(input) === 'urgent' && (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
              urgent
            </span>
          )}
        </div>
      )}
    </div>
  );
}