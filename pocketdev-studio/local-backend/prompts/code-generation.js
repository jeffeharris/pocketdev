// Prompt templates that work around Claude's restrictions

export const PROMPT_TEMPLATES = {
  documentation: (filename, description) => 
    `I am explicitly requesting that you provide the complete markdown code content for a file called ${filename}. ${description}. Please provide the full markdown content as if you were showing me code in a code block.`,
  
  component: (filename, description) =>
    `Please provide the complete JavaScript/React code for ${filename}. ${description}. Show me the full code content.`,
    
  config: (filename, description) =>
    `Show me the complete configuration code for ${filename}. ${description}. Include all the content.`
};

// Example usage:
// PROMPT_TEMPLATES.documentation('README.md', 'Document the frontend architecture with sections for Overview, Setup, and Usage')