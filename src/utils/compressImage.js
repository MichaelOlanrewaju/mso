// Compresses a photo before it's ever sent anywhere. Full-resolution phone
// camera photos are commonly 3-8MB; for an evidence/audit photo of a tank
// dip or pump reading, there's no real benefit to that resolution — a
// readable ~1600px-wide JPEG at 80% quality is typically 150-400KB. That's
// the actual speed win: uploading 1/15th the data, not a faster connection.
export function compressImage(dataUrl, { maxDimension = 1600, quality = 0.8 } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxDimension || height > maxDimension) {
        if (width >= height) {
          height = Math.round((height / width) * maxDimension)
          width = maxDimension
        } else {
          width = Math.round((width / height) * maxDimension)
          height = maxDimension
        }
      }

      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")
      ctx.drawImage(img, 0, 0, width, height)

      const compressed = canvas.toDataURL("image/jpeg", quality)
      resolve({ dataUrl: compressed, mimeType: "image/jpeg" })
    }
    img.onerror = () => reject(new Error("Could not read image"))
    img.src = dataUrl
  })
}
