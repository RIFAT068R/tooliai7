import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Download, ExternalLink } from 'lucide-react'

interface ImageLightboxProps {
  url: string
  onClose: () => void
}

export function ImageLightbox({ url, onClose }: ImageLightboxProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleDownload = async () => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const ext = url.split('.').pop()?.split('?')[0] || 'png'
      const filename = `ai-image-${Date.now()}.${ext}`
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)
    } catch {
      window.open(url, '_blank')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-4xl max-h-[90vh] w-full"
      >
        {/* Controls */}
        <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
          <button
            onClick={() => window.open(url, '_blank')}
            className="w-9 h-9 rounded-xl bg-black/60 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/80 transition-colors"
          >
            <ExternalLink size={15} />
          </button>
          <button
            onClick={handleDownload}
            className="w-9 h-9 rounded-xl bg-black/60 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/80 transition-colors"
          >
            <Download size={15} />
          </button>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-black/60 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/80 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <img
          src={url}
          alt="Generated"
          className="w-full h-auto max-h-[90vh] object-contain rounded-xl shadow-2xl"
        />
      </motion.div>
    </motion.div>
  )
}
