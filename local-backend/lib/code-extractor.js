import fs from 'fs/promises';
import path from 'path';

export class CodeExtractor {
  /**
   * Extract code blocks from Claude's response and create files
   */
  async extractAndSaveFiles(claudeResponse, workspacePath, originalTask = '') {
    const files = this.extractCodeBlocks(claudeResponse);
    
    // If no code blocks found but task asked for markdown, save the response as markdown
    if (files.length === 0 && 
        (originalTask.toLowerCase().includes('markdown') || 
         originalTask.toLowerCase().includes('.md') ||
         claudeResponse.startsWith('#'))) {
      files.push({
        filename: 'output.md',
        language: 'markdown',
        content: claudeResponse
      });
    }
    
    const savedFiles = [];

    for (const file of files) {
      try {
        const filePath = path.join(workspacePath, file.filename);
        
        // Create directory if needed
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        
        // Write the file
        await fs.writeFile(filePath, file.content);
        
        savedFiles.push({
          filename: file.filename,
          path: filePath,
          language: file.language,
          size: file.content.length
        });
        
        console.log(`[CodeExtractor] Created file: ${filePath}`);
      } catch (error) {
        console.error(`[CodeExtractor] Failed to create ${file.filename}:`, error);
      }
    }

    return savedFiles;
  }

  /**
   * Extract code blocks from markdown response
   */
  extractCodeBlocks(response) {
    const files = [];
    const codeBlockRegex = /```(\w+)(?:\s+filename:([^\n]+))?\n([\s\S]*?)```/g;
    
    let match;
    while ((match = codeBlockRegex.exec(response)) !== null) {
      const [, language, filename, content] = match;
      
      // Try to infer filename from content or comments
      let finalFilename = filename || this.inferFilename(content, language);
      
      if (finalFilename) {
        files.push({
          filename: finalFilename.trim(),
          language,
          content: content.trim()
        });
      }
    }

    // Also look for explicit file indicators
    const fileIndicatorRegex = /(?:(?:File|Create|Write|Save as)[:\s]+)?[`']?([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)[`']?:?\s*\n```(\w+)\n([\s\S]*?)```/g;
    
    response.replace(fileIndicatorRegex, (match, filename, language, content) => {
      // Check if we already captured this file
      if (!files.some(f => f.filename === filename)) {
        files.push({
          filename: filename.trim(),
          language,
          content: content.trim()
        });
      }
      return match;
    });

    return files;
  }

  /**
   * Try to infer filename from code content
   */
  inferFilename(content, language) {
    // Look for common patterns in different languages
    const patterns = {
      javascript: [
        /export\s+(?:default\s+)?(?:class|function)\s+(\w+)/,
        /module\.exports\s*=\s*(\w+)/,
        /const\s+(\w+)\s*=.*export/
      ],
      python: [
        /class\s+(\w+)/,
        /def\s+(\w+)/
      ],
      java: [
        /public\s+class\s+(\w+)/
      ]
    };

    const languagePatterns = patterns[language] || [];
    
    for (const pattern of languagePatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const extension = this.getExtension(language);
        return `${match[1]}.${extension}`;
      }
    }

    return null;
  }

  getExtension(language) {
    const extensions = {
      javascript: 'js',
      typescript: 'ts',
      python: 'py',
      java: 'java',
      html: 'html',
      css: 'css',
      json: 'json',
      yaml: 'yml',
      dockerfile: 'Dockerfile',
      sql: 'sql'
    };

    return extensions[language.toLowerCase()] || language;
  }
}