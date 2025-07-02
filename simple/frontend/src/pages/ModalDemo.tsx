import React, { useState } from 'react';
import { CreateTaskModal } from '../components/task/CreateTaskModal';

export const ModalDemo = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [submittedData, setSubmittedData] = useState<any>(null);

  const handleSubmit = (data: any) => {
    console.log('Form submitted:', data);
    setSubmittedData(data);
    // Keep modal open for easy iteration
    // setIsOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Modal UI Demo</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">CreateTaskModal Demo</h2>
          
          <div className="space-y-4">
            <div>
              <button
                onClick={() => setIsOpen(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Open Modal
              </button>
            </div>

            {submittedData && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Last Submission:</h3>
                <pre className="text-sm text-gray-600 whitespace-pre-wrap">
                  {JSON.stringify(submittedData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>• Modal stays open after submission for easy testing</p>
            <p>• Check console for form submission data</p>
            <p>• Edit CreateTaskModal.tsx and see changes instantly</p>
            <p>• Test different form states and validation</p>
          </div>
        </div>
      </div>

      <CreateTaskModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSubmit={handleSubmit}
        projectId="demo-project-123"
        baseBranch="develop"
        existingBranches={[
          'main',
          'develop',
          'feature/user-auth',
          'feature/api-refactor',
          'fix/memory-leak',
          'chore/update-deps'
        ]}
        occupiedBranches={[
          'feature/user-auth',
          'fix/memory-leak'
        ]}
      />
    </div>
  );
};