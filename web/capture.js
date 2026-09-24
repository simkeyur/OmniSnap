/**
 * OmniSnap Image Capture and Preprocessing
 * - Downscales to max 768px
 * - Strips EXIF metadata via canvas re-encoding (JPEG q=0.85)
 * - Returns clean Blob and base64 preview
 */

export async function processImageFile(file, maxDim = 768, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(blob => {
          if (!blob) {
            reject(new Error('Canvas toBlob failed'));
            return;
          }
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve({
            blob,
            dataUrl,
            width,
            height,
            sizeBytes: blob.size
          });
        }, 'image/jpeg', quality);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export class CameraStream {
  constructor(videoElement) {
    this.video = videoElement;
    this.stream = null;
  }

  async start(facingMode = 'environment') {
    if (this.stream) this.stop();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      if (this.video) {
        this.video.srcObject = this.stream;
        await this.video.play();
      }
      return true;
    } catch (err) {
      console.warn('getUserMedia failed or denied:', err);
      return false;
    }
  }

  captureFrame(maxDim = 768, quality = 0.85) {
    if (!this.video || !this.stream) return null;
    let width = this.video.videoWidth || 640;
    let height = this.video.videoHeight || 480;

    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(this.video, 0, 0, width, height);

    return new Promise(resolve => {
      canvas.toBlob(blob => {
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve({ blob, dataUrl, width, height });
      }, 'image/jpeg', quality);
    });
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
  }
}
