import placeholderImg from "@/assets/player-placeholder.jpg";

/**
 * Converts common Google Drive share URLs to embeddable image format
 * Uses lh3.googleusercontent.com which is more reliable for embedding
 * @param url - The Google Drive URL to convert
 * @param size - Optional size parameter (default 1000px for high quality)
 * @returns Embeddable image URL or placeholder image
 */
export const getDriveThumbnail = (url?: string, size: number = 1000): string => {
  if (!url) return placeholderImg;

  try {
    let fileId: string | null = null;

    // Match file ID from /d/ format (e.g., drive.google.com/file/d/FILE_ID/view)
    const driveFileIdMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (driveFileIdMatch && driveFileIdMatch[1]) {
      fileId = driveFileIdMatch[1];
    }

    // Match file ID from ?id= or open?id= format (e.g., drive.google.com/open?id=FILE_ID)
    if (!fileId) {
      const idParamMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (idParamMatch && idParamMatch[1]) {
        fileId = idParamMatch[1];
      }
    }

    if (fileId) {
      // Use drive.google.com/thumbnail with size parameter
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
    }

    // If it's already a direct image or thumbnail URL, return as-is
    return url;
  } catch (e) {
    return placeholderImg;
  }
};
