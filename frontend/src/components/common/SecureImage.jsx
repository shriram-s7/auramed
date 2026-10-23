import { useEffect, useState } from 'react'
import api from '../../services/api'

// Browser img tags cannot attach bearer credentials. Fetch local patient files
// through the authenticated API, then revoke the temporary object URL on cleanup.
export default function SecureImage({ src, alt = '', ...props }) {
  const [resolved, setResolved] = useState(null)
  const [failed, setFailed] = useState(false)
  let privatePath = null
  if (typeof src === 'string' && !src.startsWith('data:') && !src.startsWith('blob:')) {
    try {
      const url = new URL(src, window.location.origin)
      const backend = new URL(api.defaults.baseURL, window.location.origin)
      if ([window.location.origin, backend.origin].includes(url.origin) && url.pathname.startsWith('/uploads/')) privatePath = url.pathname
    } catch { /* Invalid paths use the ordinary image error state. */ }
  }
  useEffect(() => {
    if (!privatePath) return
    let disposed = false
    let objectUrl
    setResolved(null); setFailed(false)
    const origin = new URL(api.defaults.baseURL, window.location.origin).origin
    api.get(origin + privatePath, { responseType: 'blob' }).then(response => {
      if (disposed) return
      objectUrl = URL.createObjectURL(response.data)
      setResolved({ path: privatePath, url: objectUrl })
    }).catch(() => { if (!disposed) setFailed(true) })
    return () => { disposed = true; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [privatePath])
  if (privatePath && resolved?.path !== privatePath) return <span role="img" aria-label={alt} className={props.className}>{failed ? 'Image unavailable for this account' : 'Loading image…'}</span>
  return <img {...props} alt={alt} src={privatePath ? resolved?.url : src} />
}
