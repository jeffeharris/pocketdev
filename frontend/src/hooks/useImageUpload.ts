import { useState, useCallback, useEffect } from 'react';
import { useService } from '../services';

interface ImageData {
  filename: string;
  size: number;
  sizeFormatted: string;
  referencePath: string;
  url?: string;
}

export function useImageUpload(projectId: string, taskId: string) {
  const uploadService = useService('upload');
  const [images, setImages] = useState<ImageData[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isLoadingImages, setIsLoadingImages] = useState(false);

  const loadImages = useCallback(async () => {
    if (!projectId || !taskId) return;
    
    setIsLoadingImages(true);
    try {
      const images = await uploadService.getTaskImages(projectId, taskId);
      setImages(images || []);
    } catch (error) {
      console.error('Failed to load images:', error);
      setImages([]);
    } finally {
      setIsLoadingImages(false);
    }
  }, [projectId, taskId]);

  const uploadImage = useCallback(async (file: File): Promise<ImageData> => {
    if (!projectId || !taskId) {
      throw new Error('Project ID and Task ID are required');
    }
    
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // TODO: Add progress tracking if needed
      setUploadProgress(50);
      
      const response = await uploadService.uploadTaskImage(projectId, taskId, formData);
      
      setUploadProgress(100);
      
      // Add the new image to the list
      const newImage: ImageData = {
        filename: response.filename,
        size: response.size,
        sizeFormatted: response.sizeFormatted,
        referencePath: response.referencePath,
        url: response.url
      };
      
      setImages(prev => [...prev, newImage]);
      
      // Reset progress after a short delay
      setTimeout(() => setUploadProgress(0), 500);
      
      return newImage;
    } catch (error) {
      console.error('Failed to upload image:', error);
      throw error;
    } finally {
      setIsUploading(false);
    }
  }, [projectId, taskId]);

  const deleteImage = useCallback(async (filename: string) => {
    if (!projectId || !taskId) return;
    
    try {
      await uploadService.deleteTaskImage(projectId, taskId, filename);
      setImages(prev => prev.filter(img => img.filename !== filename));
    } catch (error) {
      console.error('Failed to delete image:', error);
      throw error;
    }
  }, [projectId, taskId]);

  // Load images when component mounts or IDs change
  useEffect(() => {
    loadImages();
  }, [loadImages]);

  return {
    images,
    isUploading,
    uploadProgress,
    loadImages,
    uploadImage,
    deleteImage,
    isLoadingImages
  };
}