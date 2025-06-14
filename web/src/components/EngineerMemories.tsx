import React, { useState, useEffect } from 'react';
import { Brain, TrendingUp, AlertCircle, Lightbulb, Clock, ChevronDown, ChevronRight } from 'lucide-react';

interface Memory {
  learned: string;
  finding?: string;
  attempted?: string;
  result?: string;
  pattern?: string;
  confidence?: string;
  applied_to?: string;
  solution?: string;
  example?: string;
}

interface MemorySection {
  performance: Memory[];
  failures: Memory[];
  patterns: Memory[];
}

interface EngineerMemoriesProps {
  engineerRole: string;
  projectId: string;
}

export function EngineerMemories({ engineerRole, projectId }: EngineerMemoriesProps) {
  const [memories, setMemories] = useState<MemorySection | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['performance']));

  useEffect(() => {
    fetchMemories();
  }, [engineerRole, projectId]);

  const fetchMemories = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/engineers/${engineerRole}/memories`);
      if (response.ok) {
        const data = await response.json();
        setMemories(data);
      }
    } catch (error) {
      console.error('Failed to fetch memories:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const getConfidenceColor = (confidence: string = 'medium') => {
    switch (confidence) {
      case 'high': return 'text-green-600 bg-green-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!memories) {
    return (
      <div className="text-center p-8 text-gray-500">
        No memories found for this engineer
      </div>
    );
  }

  const sections = [
    {
      key: 'performance',
      title: 'Performance Optimizations',
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      memories: memories.performance || []
    },
    {
      key: 'failures',
      title: 'Failed Approaches',
      icon: AlertCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      memories: memories.failures || []
    },
    {
      key: 'patterns',
      title: 'Successful Patterns',
      icon: Lightbulb,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      memories: memories.patterns || []
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="h-5 w-5 text-indigo-600" />
        <h3 className="text-lg font-semibold">
          {engineerRole.charAt(0).toUpperCase() + engineerRole.slice(1)} Engineer Memories
        </h3>
      </div>

      {sections.map(section => (
        <div key={section.key} className="border rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection(section.key)}
            className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
          >
            <div className="flex items-center gap-3">
              <section.icon className={`h-5 w-5 ${section.color}`} />
              <span className="font-medium">{section.title}</span>
              <span className={`px-2 py-1 text-xs rounded-full ${section.bgColor} ${section.color}`}>
                {section.memories.length}
              </span>
            </div>
            {expandedSections.has(section.key) ? (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
          </button>

          {expandedSections.has(section.key) && section.memories.length > 0 && (
            <div className="divide-y">
              {section.memories.map((memory, index) => (
                <div key={index} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-500">
                        {formatDate(memory.learned)}
                      </span>
                      {memory.confidence && (
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getConfidenceColor(memory.confidence)}`}>
                          {memory.confidence} confidence
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Performance optimization */}
                  {memory.finding && (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-800">{memory.finding}</p>
                      {memory.applied_to && (
                        <p className="text-xs text-gray-500">
                          Applied to: <span className="font-mono">{memory.applied_to}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Failed approach */}
                  {memory.attempted && (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-800">
                        <span className="font-medium">Attempted:</span> {memory.attempted}
                      </p>
                      {memory.result && (
                        <p className="text-sm text-red-600">
                          <span className="font-medium">Result:</span> {memory.result}
                        </p>
                      )}
                      {memory.solution && (
                        <p className="text-sm text-green-600">
                          <span className="font-medium">Solution:</span> {memory.solution}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Pattern */}
                  {memory.pattern && (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-800">{memory.pattern}</p>
                      {memory.example && (
                        <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                          <code>{memory.example}</code>
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {expandedSections.has(section.key) && section.memories.length === 0 && (
            <div className="p-4 text-center text-gray-500 text-sm">
              No {section.title.toLowerCase()} recorded yet
            </div>
          )}
        </div>
      ))}

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <div className="flex items-start gap-3">
          <Brain className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">How memories work:</p>
            <ul className="space-y-1 text-xs">
              <li>• Memories are automatically extracted from completed tasks</li>
              <li>• Each engineer maintains their own set of learnings</li>
              <li>• Future tasks will use these memories to work more efficiently</li>
              <li>• Memories persist across sessions and grow over time</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}