/**
 * Copies a picked file into memory, so an upload no longer depends on the
 * phone still being able to hand over the original.
 *
 * On Android a file chosen from the gallery is only a handle, read when the
 * form is sent. If it can no longer be read then — a cloud-backed photo, a
 * screenshot the gallery has since touched, the player having gone off to a
 * UPI app to pay — Chrome abandons the request before a byte leaves the phone
 * and `fetch` reports "Failed to fetch". Production showed exactly that: one
 * player failed 30 times over two networks while nginx never saw a single
 * upload. Retrying cannot help, because it sends the same unreadable handle.
 *
 * Reading the bytes when the file is picked moves any failure to that moment,
 * where the player can simply choose the photo again. Throws if unreadable.
 */
export async function readIntoMemory(file: File): Promise<File> {
  const bytes = await file.arrayBuffer();
  return new File([bytes], file.name, {
    type: file.type,
    lastModified: file.lastModified,
  });
}

/**
 * Turn a picked file into one that is safe to send later: images are
 * compressed, and everything ends up as an in-memory copy rather than a handle
 * to the file on the phone (see readIntoMemory for why that matters).
 * Throws if the phone cannot hand the file over.
 */
export async function prepareUpload(file: File): Promise<File> {
  if (file.type.startsWith("image/")) {
    try {
      return await compressImage(file);
    } catch {
      // Not decodable as an image (e.g. HEIC on some phones): send it as is,
      // but still from memory.
    }
  }
  return readIntoMemory(file);
}

/** Whether the bytes of a file can still be read. */
export async function isReadable(file: File): Promise<boolean> {
  try {
    await file.slice(0, 1).arrayBuffer();
    return true;
  } catch {
    return false;
  }
}

/**
 * Compresses an image file using canvas before upload.
 * Resizes to maxWidth/maxHeight while maintaining aspect ratio,
 * and compresses to the target quality (JPEG output).
 */
export async function compressImage(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.7
): Promise<File> {
  // Small enough already: skip compression, but still hand back an in-memory
  // copy rather than the picked file itself — see readIntoMemory.
  if (file.size <= 500 * 1024) {
    return readIntoMemory(file);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Calculate new dimensions maintaining aspect ratio
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        // Draw to canvas
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to create canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Failed to compress image"));
              return;
            }
            // Preserve original filename but change extension to .jpg
            const baseName = file.name.replace(/\.[^.]+$/, "");
            const compressedFile = new File([blob], `${baseName}.jpg`, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => reject(new Error("Failed to load image for compression"));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}
