# PocketDev Image Upload Implementation Plan

## Overview
Enable users to easily share images with Claude in the PocketDev task view by uploading files or pasting screenshots directly into the task workspace. Images will be stored in a `.pocketdev/tmp` directory within each task's worktree, making them accessible to Claude via the existing @ reference system.

## Goals
- **Seamless screenshot sharing**: Ctrl+V to paste screenshots directly from clipboard
- **File upload support**: Click or drag-and-drop image files
- **Task isolation**: Each task has its own image storage
- **Claude integration**: Images accessible via @.pocketdev/tmp/images/filename.png
- **Visual feedback**: Preview uploaded images in the task view

## Technical Architecture

### Directory Structure
```
/projects/{projectId}-task-{taskId}/
├── .pocketdev/
│   ├── tmp/
│   │   └── images/
│   │       ├── screenshot-1234567890.png
│   │       ├── uploaded-image.jpg
│   │       └── ...
│   ├── config/
│   │   └── task.json (future: task metadata)
│   └── logs/
│       └── claude-sessions.log (future: session tracking)
└── ... (other project files)
```

### PocketDev Directory Convention
- **`.pocketdev/`**: Root directory for all PocketDev-specific files
- **`.pocketdev/tmp/`**: Temporary files that can be referenced by Claude
- **`.pocketdev/tmp/images/`**: Uploaded images for the current task
- **`.pocketdev/config/`**: Task configuration and metadata (future)
- **`.pocketdev/logs/`**: Activity logs and session history (future)

### Backend Components

#### 1. File Upload Endpoint
- **Route**: `POST /api/projects/:projectId/tasks/:taskId/upload`
- **Middleware**: Multer for multipart/form-data handling
- **Storage**: Direct to task worktree .pocketdev/tmp/images directory
- **Validation**: 
  - File type: images only (png, jpg, jpeg, gif, webp)
  - File size: max 10MB per image
  - Filename sanitization

#### 2. Image Listing Endpoint
- **Route**: `GET /api/projects/:projectId/tasks/:taskId/images`
- **Response**: Array of uploaded images with metadata
- **Purpose**: Display uploaded images in UI

#### 3. Image Serving Endpoint
- **Route**: `GET /api/projects/:projectId/tasks/:taskId/images/:filename`
- **Purpose**: Serve images for preview in UI
- **Security**: Validate task access

### Frontend Components

#### 1. Image Upload Zone
- **Location**: Task details panel (project-page.html)
- **Features**:
  - Paste detection (Ctrl+V)
  - Drag and drop zone
  - Click to browse files
  - Upload progress indicator

#### 2. Image Gallery
- **Location**: Below task actions, above git info
- **Features**:
  - Thumbnail grid of uploaded images
  - Click to view full size
  - Copy @ reference path button
  - Delete image option
  - Collapsible to save space

#### 3. Paste Handler
```javascript
// Global paste listener
document.addEventListener('paste', async (e) => {
  if (!currentTask) return;
  
  const items = e.clipboardData.items;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const blob = item.getAsFile();
      await uploadImage(blob, `screenshot-${Date.now()}.png`);
    }
  }
});
```

## Implementation Steps

### Phase 1: Backend Setup
1. Install multer dependency
2. Create upload endpoint with validation
3. Implement directory creation for .pocketdev/tmp/images
4. Add image listing and serving endpoints
5. Test with curl/Postman

### Phase 2: Basic Upload UI
1. Add upload zone to task view
2. Implement file input and upload function
3. Display upload progress
4. Show success/error messages
5. Test file uploads

### Phase 3: Paste Support
1. Add global paste event listener
2. Extract image from clipboard
3. Convert to blob and upload
4. Show paste indicator when image in clipboard
5. Test screenshot workflow

### Phase 4: Image Gallery
1. Create collapsible image section
2. Fetch and display uploaded images
3. Implement image preview modal
4. Add copy @ reference button
5. Add delete functionality

### Phase 5: Polish & UX
1. Add drag-and-drop visual feedback
2. Implement upload queue for multiple files
3. Add image compression for large files
4. Show file size and dimensions
5. Keyboard shortcuts (Ctrl+V anywhere in task view)

## Security Considerations
- Validate file types on both client and server
- Sanitize filenames to prevent path traversal
- Limit file sizes to prevent DoS
- Ensure images are only accessible within their task context
- Clean up images when task is deleted

## Version Control Considerations
- Add `.pocketdev/tmp/` to `.gitignore` to prevent temporary files from being committed
- Consider adding entire `.pocketdev/` directory to `.gitignore` for cleaner repos
- PocketDev will automatically create `.gitignore` entry when first image is uploaded
- Example `.gitignore` entry:
  ```
  # PocketDev temporary files
  .pocketdev/tmp/
  ```

## User Experience Flow
1. User takes screenshot or has image file
2. In task view, either:
   - Press Ctrl+V to paste screenshot
   - Drag image into upload zone
   - Click upload zone to browse
3. Image uploads with progress indicator
4. Image appears in gallery with @ reference path
5. User can copy path to reference in Claude
6. Claude accesses image via @.pocketdev/tmp/images/filename.png

## Success Metrics
- Upload success rate > 95%
- Paste-to-preview time < 2 seconds
- Support for common image formats
- Intuitive UI requiring no documentation
- Zero impact on existing Claude functionality

## Future Enhancements
- Image annotations before upload
- Automatic OCR for text extraction
- Image optimization/compression
- Batch upload support
- Integration with system screenshot tools
- Mobile app camera integration