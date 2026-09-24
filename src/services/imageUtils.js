// Client-Side Image Compression Utility
// Downsamples high-resolution mobile/desktop photos to lightweight, crystal-clear web images (~40KB - 120KB)
// Prevents browser localStorage quota crashes, Firestore 1MB limits, and WebRTC data channel packet drops.

export const compressImage = (fileOrBlob, maxWidth = 640, maxHeight = 640, quality = 0.6) => {
  return new Promise((resolve, reject) => {
    if (!fileOrBlob) {
      return reject(new Error('No file provided for compression'));
    }

    // If already SVG or tiny file, read directly
    if (fileOrBlob.type === 'image/svg+xml' || (fileOrBlob.size && fileOrBlob.size < 25 * 1024)) {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(fileOrBlob);
      return;
    }

    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => {
        // Fallback to raw data url if canvas loading fails
        resolve(event.target.result);
      };
      img.onload = () => {
        try {
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          if (!width || !height) {
            return resolve(event.target.result);
          }

          // Scale down if exceeding maximum dimensions while preserving aspect ratio
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return resolve(event.target.result);
          }

          // High quality image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // White background for transparent PNGs converted to JPEG
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);

          ctx.drawImage(img, 0, 0, width, height);

          // Export compressed JPEG
          let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

          // If still > 50KB base64, re-encode with lower quality to stay within 64KB WebRTC & MQTT limit
          if (compressedDataUrl.length > 50000) {
            compressedDataUrl = canvas.toDataURL('image/jpeg', 0.45);
          }

          resolve(compressedDataUrl);
        } catch (err) {
          console.warn('Canvas compression fallback:', err);
          resolve(event.target.result);
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(fileOrBlob);
  });
};

export const compressAvatar = (fileOrBlob, size = 300, quality = 0.8) => {
  return compressImage(fileOrBlob, size, size, quality);
};
