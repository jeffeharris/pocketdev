import React, { useState, useRef, useEffect } from 'react';
import type { DragEvent } from 'react';
import { Upload, X, Copy, Trash2, Check, FileText, Archive, File, FileCode, FileType } from 'lucide-react';
import { useService } from '../../services';

interface UploadedImage {
  filename: string;
  size: number;
  sizeFormatted: string;
  referencePath: string;
  url?: string;
}

interface ImageUploadProps {
  projectId: string;
  taskId: string;
  images?: UploadedImage[];
  onUpload?: (file: File) => Promise<UploadedImage>;
  onDelete?: (filename: string) => void;
  isUploading?: boolean;
  uploadProgress?: number;
  compact?: boolean;
  onImageUploaded?: (image: UploadedImage) => void;
  onReferencesCopied?: (path: string) => void;
  className?: string;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  projectId,
  taskId,
  images: externalImages,
  onUpload: externalOnUpload,
  onDelete: externalOnDelete,
  isUploading: externalIsUploading,
  uploadProgress: externalUploadProgress,
  compact = false,
  onImageUploaded,
  onReferencesCopied,
  className = ''
}) => {
  const uploadService = useService('upload');
  // Use external state if provided, otherwise use internal state
  const [internalImages, setInternalImages] = useState<UploadedImage[]>([]);
  const [internalIsUploading, setInternalIsUploading] = useState(false);
  const [internalUploadProgress, setInternalUploadProgress] = useState(0);
  
  const images = externalImages || internalImages;
  const isUploading = externalIsUploading !== undefined ? externalIsUploading : internalIsUploading;
  const uploadProgress = externalUploadProgress !== undefined ? externalUploadProgress : internalUploadProgress;
  const [isDragging, setIsDragging] = useState(false);
  const [hasClipboardImage, setHasClipboardImage] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Load existing images on mount
  useEffect(() => {
    loadImages();
  }, [projectId, taskId]);

  // Set up clipboard monitoring
  useEffect(() => {
    const checkClipboard = async () => {
      try {
        const items = await navigator.clipboard.read();
        const hasImage = items.some(item => 
          item.types.some(type => type.startsWith('image/'))
        );
        setHasClipboardImage(hasImage);
      } catch (error) {
        // Clipboard API might not be available or permission denied
        setHasClipboardImage(false);
      }
    };

    // Check initially and periodically
    checkClipboard();
    const interval = setInterval(checkClipboard, 1000);

    // Paste handler
    const handlePaste = async (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      
      const items = Array.from(e.clipboardData.items);
      const imageItem = items.find(item => item.type.startsWith('image/'));
      
      if (imageItem) {
        e.preventDefault();
        const blob = imageItem.getAsFile();
        if (blob) {
          // Check file size limit (10MB)
          const maxSize = 10 * 1024 * 1024; // 10MB in bytes
          if (blob.size > maxSize) {
            alert('Image size must be less than 10MB');
            return;
          }
          const filename = `screenshot-${Date.now()}.png`;
          await uploadImage(blob, filename);
        }
      }
    };

    document.addEventListener('paste', handlePaste);

    return () => {
      clearInterval(interval);
      document.removeEventListener('paste', handlePaste);
    };
  }, [projectId, taskId]);

  const loadImages = async () => {
    if (externalImages) return; // Don't load if using external images
    
    try {
      const images = await uploadService.getTaskImages(projectId, taskId);
      setInternalImages(images || []);
    } catch (error) {
      console.error('Failed to load images:', error);
    }
  };

  const uploadImage = async (file: File, filename?: string) => {
    // Check total files limit (50 per task)
    if (images.length >= 50) {
      alert('Maximum 50 files allowed per task');
      return;
    }
    // Use external upload handler if provided
    if (externalOnUpload) {
      try {
        const result = await externalOnUpload(file);
        onImageUploaded?.(result);
        // Auto-copy reference
        copyReference(result.referencePath, true);
      } catch (error) {
        console.error('Upload failed:', error);
        alert('Failed to upload image');
      }
      return;
    }
    
    // Otherwise use internal upload logic
    setInternalIsUploading(true);
    setInternalUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file, filename || file.name);

    try {
      // Simulate progress (real progress would come from XMLHttpRequest or similar)
      const progressInterval = setInterval(() => {
        setInternalUploadProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      const response = await uploadService.uploadTaskImage(projectId, taskId, formData);
      
      clearInterval(progressInterval);
      setInternalUploadProgress(100);

      if (response.success) {
        await loadImages();
        onImageUploaded?.(response);
        
        // Auto-copy reference
        copyReference(response.referencePath, true);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload image');
    } finally {
      setInternalIsUploading(false);
      setTimeout(() => setInternalUploadProgress(0), 500);
    }
  };

  const deleteImage = async (filename: string) => {
    if (!confirm(`Delete ${filename}?`)) return;
    
    // Use external delete handler if provided
    if (externalOnDelete) {
      externalOnDelete(filename);
      return;
    }

    try {
      await uploadService.deleteTaskImage(projectId, taskId, filename);
      await loadImages();
    } catch (error) {
      console.error('Failed to delete image:', error);
      alert('Failed to delete image');
    }
  };

  const copyReference = async (path: string, silent = false) => {
    try {
      await navigator.clipboard.writeText(path);
      if (!silent) {
        onReferencesCopied?.(path);
        // Show feedback
        setCopiedPath(path);
        setTimeout(() => setCopiedPath(null), 2000);
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      alert('Failed to copy reference path');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size limit (10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > maxSize) {
        alert('File size must be less than 10MB');
        return;
      }
      uploadImage(file);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    // Accept the first file - multer will validate the type
    const validFile = files[0];
    
    if (validFile) {
      // Check file size limit (10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      if (validFile.size > maxSize) {
        alert('File size must be less than 10MB');
        return;
      }
      uploadImage(validFile);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
    return Math.round(bytes / 1048576) + ' MB';
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const iconClass = "w-full h-full text-gray-400";
    
    // Code files
    const codeExtensions = ['py', 'js', 'ts', 'tsx', 'jsx', 'java', 'c', 'cpp', 'cc', 'h', 'hpp', 'cs', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'scala', 'r', 'sh', 'bash', 'zsh', 'ps1', 'bat', 'sql', 'html', 'css', 'scss', 'vue', 'svelte'];
    
    // Config files
    const configExtensions = ['yaml', 'yml', 'json', 'toml', 'ini', 'cfg', 'conf', 'env', 'dockerfile', 'gitignore', 'editorconfig'];
    
    // Check by extension
    switch (ext) {
      case 'pdf':
        return <FileText className={iconClass} />;
      case 'zip':
      case 'tar':
      case 'gz':
        return <Archive className={iconClass} />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
      case 'svg':
        return null; // Show actual image
      default:
        if (codeExtensions.includes(ext || '')) {
          return <FileCode className={iconClass} />;
        } else if (configExtensions.includes(ext || '')) {
          return <FileType className={iconClass} />;
        }
        return <File className={iconClass} />;
    }
  };

  const isImageFile = (filename: string): boolean => {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '');
  };

  return (
    <div className={`image-upload-container ${className}`}>
      {/* Upload Zone */}
      <div
        ref={dropZoneRef}
        className={`
          upload-zone border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
          transition-all duration-200 hover:border-blue-400 hover:bg-blue-50/5
          ${isDragging ? 'border-blue-500 bg-blue-50/10' : 'border-gray-600'}
          ${hasClipboardImage ? 'border-purple-500' : ''}
          ${isUploading ? 'pointer-events-none opacity-50' : ''}
        `}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.txt,.md,.json,.csv,.xml,.yaml,.yml,.zip,.tar,.gz,.py,.js,.ts,.tsx,.jsx,.java,.c,.cpp,.h,.hpp,.cs,.go,.rs,.rb,.php,.sh,.sql,.html,.css,.vue,.svelte"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex items-center justify-center gap-3">
          <Upload className="w-8 h-8 text-gray-400" />
          <div className="text-left">
            <div className="font-medium text-sm text-gray-300">
              Drop file or click to browse
            </div>
            <div className="text-xs text-gray-500">
              {hasClipboardImage ? (
                <span className="text-purple-400">📋 Ctrl+V to paste from clipboard</span>
              ) : (
                <span>.pocketdev/attachments/</span>
              )}
            </div>
          </div>
        </div>

        {/* Upload Progress */}
        {isUploading && (
          <div className="mt-4 w-full bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}
      </div>

      {/* Image List - Horizontal layout for narrow spaces */}
      {images.length > 0 && (
        <div className={`mt-4 ${compact ? 'space-y-2' : 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3'}`}>
          {images.map((image) => {
            // Compact mode: horizontal list layout
            if (compact) {
              return (
                <div
                  key={image.filename}
                  className="group bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-gray-600 transition-colors flex items-center p-2 gap-2"
                >
                  {/* Thumbnail */}
                  <div
                    className="w-10 h-10 rounded cursor-pointer hover:opacity-90 transition-opacity flex-shrink-0 bg-gray-700 flex items-center justify-center overflow-hidden"
                    onClick={() => isImageFile(image.filename) && setExpandedImage(image.filename)}
                  >
                    {isImageFile(image.filename) ? (
                      <img
                        src={`/api/projects/${projectId}/tasks/${taskId}/images/${image.filename}`}
                        alt={image.filename}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6">
                        {getFileIcon(image.filename)}
                      </div>
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-300 truncate" title={image.filename}>
                      {image.filename}
                    </div>
                    <div className="text-xs text-gray-500">
                      {image.sizeFormatted || formatFileSize(image.size)}
                    </div>
                  </div>

                  {/* Actions - Always visible in compact mode */}
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyReference(image.referencePath);
                      }}
                      className={`p-1 rounded transition-all duration-200 cursor-pointer ${
                        copiedPath === image.referencePath
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white hover:scale-110'
                      }`}
                      title={copiedPath === image.referencePath ? 'Copied!' : 'Copy reference'}
                    >
                      {copiedPath === image.referencePath ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteImage(image.filename);
                      }}
                      className="p-1 bg-red-600 hover:bg-red-500 rounded text-white transition-all duration-200 hover:scale-110 cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            }
            
            // Regular mode: grid layout
            return (
              <div
                key={image.filename}
                className="group relative bg-gray-800 rounded-lg overflow-hidden"
              >
                <div
                  className="w-full h-32 bg-gray-700 flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => isImageFile(image.filename) && setExpandedImage(image.filename)}
                >
                  {isImageFile(image.filename) ? (
                    <img
                      src={`/api/projects/${projectId}/tasks/${taskId}/images/${image.filename}`}
                      alt={image.filename}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16">
                      {getFileIcon(image.filename)}
                    </div>
                  )}
                </div>
                
                <div className="p-2">
                  <div className="text-xs text-gray-300 truncate" title={image.filename}>
                    {image.filename}
                  </div>
                  <div className="text-xs text-gray-500">
                    {image.sizeFormatted || formatFileSize(image.size)}
                  </div>
                </div>

                {/* Actions */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyReference(image.referencePath);
                    }}
                    className={`p-1 rounded transition-all duration-200 ${
                      copiedPath === image.referencePath
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700/80 hover:bg-gray-600 text-gray-300 hover:text-white hover:scale-110'
                    }`}
                    title={copiedPath === image.referencePath ? 'Copied!' : 'Copy reference'}
                  >
                    {copiedPath === image.referencePath ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteImage(image.filename);
                    }}
                    className="p-1 bg-red-600/80 hover:bg-red-500 rounded text-white transition-all duration-200 hover:scale-110"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Expanded Image Modal */}
      {expandedImage && isImageFile(expandedImage) && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setExpandedImage(null)}
        >
          <img
            src={`/api/projects/${projectId}/tasks/${taskId}/images/${expandedImage}`}
            alt={expandedImage}
            className="max-w-full max-h-full object-contain"
          />
          <button
            className="absolute top-4 right-4 p-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
            onClick={() => setExpandedImage(null)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};