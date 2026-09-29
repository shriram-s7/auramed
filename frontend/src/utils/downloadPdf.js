/**
 * Reliable cross-browser PDF downloader.
 * Ensures proper MIME type, file extension, and avoids revoking the object URL
 * before Chromium browsers finish initiating the download.
 */
export function triggerPdfDownload(blobData, filename) {
  if (!blobData) return

  // Ensure blob has explicit application/pdf MIME type
  const blob =
    blobData instanceof Blob
      ? blobData.type === 'application/pdf'
        ? blobData
        : new Blob([blobData], { type: 'application/pdf' })
      : new Blob([blobData], { type: 'application/pdf' })

  const safeFilename = filename
    ? filename.endsWith('.pdf')
      ? filename
      : `${filename}.pdf`
    : 'AuraMed_Clinical_Report.pdf'

  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.style.display = 'none'
  link.href = url
  link.setAttribute('download', safeFilename)
  link.download = safeFilename
  document.body.appendChild(link)
  link.click()

  // Delay cleanup to allow browser time to read metadata and save the file
  setTimeout(() => {
    try {
      if (document.body.contains(link)) {
        document.body.removeChild(link)
      }
      window.URL.revokeObjectURL(url)
    } catch {}
  }, 2500)
}
