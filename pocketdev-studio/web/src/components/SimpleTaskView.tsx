import { useState } from 'react';
import { Send, MessageSquare, CheckCircle, XCircle, Loader2 } from 'lucide-react';

export function SimpleTaskView() {
  const [task, setTask] = useState('');
  const [currentTask, setCurrentTask] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [followUp, setFollowUp] = useState('');
  const [messages, setMessages] = useState<Array<{type: 'user' | 'claude', content: string}>>([]);

  const submitTask = async () => {
    if (!task.trim()) return;
    
    setLoading(true);
    setMessages([{ type: 'user', content: task }]);
    
    try {
      const response = await fetch('http://localhost:3001/api/worktree/submit-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task })
      });
      
      const result = await response.json();
      setCurrentTask(result);
      setMessages(prev => [...prev, { type: 'claude', content: result.result || 'Task completed' }]);
      setTask('');
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { type: 'claude', content: 'Error: Failed to submit task' }]);
    } finally {
      setLoading(false);
    }
  };

  const sendFollowUp = async () => {
    if (!followUp.trim() || !currentTask) return;
    
    setLoading(true);
    setMessages(prev => [...prev, { type: 'user', content: followUp }]);
    
    try {
      const response = await fetch('http://localhost:3001/api/worktree/follow-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          taskId: currentTask.taskId,
          followUpPrompt: followUp 
        })
      });
      
      const result = await response.json();
      setMessages(prev => [...prev, { type: 'claude', content: result.result }]);
      setFollowUp('');
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { type: 'claude', content: 'Error: Failed to send follow-up' }]);
    } finally {
      setLoading(false);
    }
  };

  const acceptChanges = async () => {
    if (!currentTask) return;
    
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/worktree/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: currentTask.taskId })
      });
      
      const result = await response.json();
      if (result.success) {
        setMessages(prev => [...prev, { 
          type: 'claude', 
          content: `✅ Changes accepted! ${result.prInfo.prUrl ? `PR: ${result.prInfo.prUrl}` : `Branch: ${result.prInfo.branch}`}` 
        }]);
        // Reset for new task
        setCurrentTask(null);
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { type: 'claude', content: 'Error: Failed to accept changes' }]);
    } finally {
      setLoading(false);
    }
  };

  const rejectChanges = () => {
    setCurrentTask(null);
    setMessages([]);
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="bg-white rounded-lg shadow-lg">
        {/* Header */}
        <div className="border-b px-6 py-4">
          <h1 className="text-xl font-semibold">PocketDev</h1>
          <p className="text-sm text-gray-600">Manage Claude Code from anywhere</p>
        </div>

        {/* Messages */}
        <div className="h-96 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-8">
              <MessageSquare className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>Submit a task to get started</p>
              <p className="text-sm mt-2">Example: "Fix the typo in README.md"</p>
            </div>
          )}
          
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
                msg.type === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                <pre className="whitespace-pre-wrap font-sans text-sm">{msg.content}</pre>
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg px-4 py-2">
                <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t px-6 py-4">
          {!currentTask ? (
            // Initial task input
            <div className="flex gap-2">
              <input
                type="text"
                value={task}
                onChange={(e) => setTask(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && submitTask()}
                placeholder="Describe what you need done..."
                className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
              <button
                onClick={submitTask}
                disabled={loading || !task.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          ) : (
            // Follow-up and actions
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendFollowUp()}
                  placeholder="Ask a follow-up question or request changes..."
                  className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
                <button
                  onClick={sendFollowUp}
                  disabled={loading || !followUp.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
              
              <div className="flex gap-2 justify-center">
                <button
                  onClick={acceptChanges}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircle className="h-5 w-5" />
                  Accept & Create PR
                </button>
                <button
                  onClick={rejectChanges}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                >
                  <XCircle className="h-5 w-5" />
                  Start Over
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}