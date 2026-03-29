import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Wand2, Loader2, Image as ImageIcon, Zap, Sparkles, Sun, Palette, Maximize, Trash2, Check, ArrowRight, ChevronDown, ChevronUp, Sliders, RotateCcw, History, SunMedium, Contrast, Droplets, Eye, Settings2, Brush, Eraser, Upload, Layers, Users, ChevronRight, ChevronLeft, SplitSquareHorizontal, WifiOff, AlertTriangle, RefreshCw, Info } from 'lucide-react'
import { blink } from '../../blink/client'
import { useAuth } from '../../hooks/useAuth'
import { cn } from '@/lib/utils'

interface ImageEditorProps {
  url: string
  onClose: () => void
  onApplyResult?: (url: string) => void
}

const STYLE_EDITS = [
  { label: 'Cyberpunk', prompt: 'Apply a cyberpunk neon-lit aesthetic with vibrant glowing colors' },
  { label: 'Watercolor Sketch', prompt: 'Convert to a beautiful watercolor sketch with visible brush strokes and pencil outlines' },
  { label: 'Pastel Goth', prompt: 'Apply a pastel goth aesthetic combining dark/spooky elements with soft pastel colors' },
  { label: 'Pixel Art', prompt: 'Convert to high-quality 8-bit or 16-bit pixel art style' },
  { label: 'Synthwave', prompt: 'Apply a 1980s synthwave retro-futuristic style with purple and pink gradients' },
  { label: 'Steampunk', prompt: 'Transform into a steampunk aesthetic with gears, brass, and Victorian industrial elements' },
  { label: 'Anime', prompt: 'Convert to high-quality modern anime style' },
  { label: 'Line Art', prompt: 'Convert to minimalist clean line art' },
  { label: 'Oil Painting', prompt: 'Transform into a classic textured oil painting' },
]

const ENHANCE_EDITS = [
  { label: 'Remove BG', prompt: 'Remove the background completely and make it transparent', icon: <Trash2 size={12} /> },
  { label: 'Upscale 4K', prompt: 'Upscale this image to 4K resolution with extreme detail enhancement', icon: <Maximize size={12} /> },
  { label: 'Retouch', prompt: 'Professionally retouch face and skin, improve clarity', icon: <Sparkles size={12} /> },
  { label: 'Fix Colors', prompt: 'Auto-correct colors and contrast for a professional look', icon: <Zap size={12} /> },
]

const LIGHTING_EDITS = [
  { label: 'Golden Hour', prompt: 'Add warm golden hour sunset lighting' },
  { label: 'Dramatic', prompt: 'Add dramatic high-contrast lighting and shadows' },
  { label: 'Studio', prompt: 'Apply professional studio lighting' },
  { label: 'Neon Glow', prompt: 'Add glowing neon accents and colored lights' },
]

const FILTER_PRESETS = [
  { label: 'Vivid', filter: 'saturate(1.5) contrast(1.1) brightness(1.05)', prompt: 'Make colors vivid and pop with increased saturation and contrast' },
  { label: 'Noir', filter: 'grayscale(1) contrast(1.2)', prompt: 'Convert to a high-contrast black and white noir style' },
  { label: 'Vintage', filter: 'sepia(0.3) saturate(0.8) contrast(0.9)', prompt: 'Apply a vintage film look with warm sepia tones and muted colors' },
  { label: 'Cinematic', filter: 'hue-rotate(-10deg) saturate(1.2) contrast(1.1)', prompt: 'Apply a cinematic teal and orange color grade' },
  { label: 'Cool', filter: 'hue-rotate(180deg) saturate(0.8)', prompt: 'Apply a cool, blue-toned atmosphere' },
  { label: 'Warm', filter: 'sepia(0.2) hue-rotate(-10deg) saturate(1.3)', prompt: 'Apply a warm, golden sun-kissed filter' },
]

const STYLE_TRANSFER_PRESETS = [
  { label: 'Starry Night', url: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=500&auto=format&fit=crop' },
  { label: 'Van Gogh', url: 'https://images.unsplash.com/photo-1701960126065-7a3f6cd98168?q=80&w=500&auto=format&fit=crop' },
  { label: 'Claude Monet', url: 'https://images.unsplash.com/photo-1689018905300-46fda719fe42?q=80&w=500&auto=format&fit=crop' },
  { label: 'Renaissance', url: 'https://images.unsplash.com/photo-1733578873730-df08f202bdce?q=80&w=500&auto=format&fit=crop' },
  { label: 'Cyberpunk', url: 'https://images.unsplash.com/photo-1573767291321-c0af2eaf5266?q=80&w=500&auto=format&fit=crop' },
  { label: 'Watercolor', url: 'https://images.unsplash.com/photo-1713731267883-2e1486c3469b?q=80&w=500&auto=format&fit=crop' },
  { label: 'Pencil Sketch', url: 'https://images.unsplash.com/photo-1582202142946-b1b9dc9f811?q=80&w=500&auto=format&fit=crop' },
  { label: 'Abstract Oil', url: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?q=80&w=500&auto=format&fit=crop' },
]

const LOADING_MESSAGES = [
  "Analyzing pixels...",
  "Applying magic...",
  "Polishing details...",
  "Rendering final image...",
  "Almost there...",
  "Finishing touches...",
]

export function ImageEditor({ url, onClose, onApplyResult }: ImageEditorProps) {
  const { user } = useAuth()
  const [prompt, setPrompt] = useState('')
  const [intensity, setIntensity] = useState(50)
  const [adjustments, setAdjustments] = useState({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    hue: 0,
    blur: 0,
  })
  const [history, setHistory] = useState<string[]>([url])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0)
  const [error, setError] = useState<{ message: string; type: 'network' | 'auth' | 'quota' | 'model' | 'upload' | 'general' } | null>(null)
  const [collabError, setCollabError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'style' | 'adjust' | 'filters' | 'lighting' | 'brush' | 'transfer' | 'batch'>('style')
  const [enhancementsOpen, setEnhancementsOpen] = useState(false)
  const [selectedEffect, setSelectedEffect] = useState<string | null>(null)
  const [showOriginal, setShowOriginal] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  // Batch Processing State
  const [batchUrls, setBatchUrls] = useState<string[]>([])
  const [batchResults, setBatchResults] = useState<{ original: string; edited: string }[]>([])
  const [isProcessingBatch, setIsProcessingBatch] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 })

  // Style Transfer State
  const [referenceUrl, setReferenceUrl] = useState<string | null>(null)
  const [isUploadingReference, setIsUploadingReference] = useState(false)
  const [customStyles, setCustomStyles] = useState<{ url: string; timestamp: number }[]>([])
  const [styleIntensity, setStyleIntensity] = useState(80)
  const [contentPreservation, setContentPreservation] = useState(70)
  const [colorPreservation, setColorPreservation] = useState(20)
  const [textureDetail, setTextureDetail] = useState(50)
  const [transferMethod, setTransferMethod] = useState<'neural' | 'cyclegan' | 'wgan'>('neural')
  const [isHighQuality, setIsHighQuality] = useState(false)

  // Brush State
  const [brushSize, setBrushSize] = useState(20)
  const [brushColor, setBrushColor] = useState('rgba(124, 58, 237, 0.5)')
  const [isEraser, setIsEraser] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasMask, setHasMask] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isHoveringCanvas, setIsHoveringCanvas] = useState(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  
  // Collaboration State
  const [onlineUsers, setOnlineUsers] = useState<any[]>([])
  const [remoteBrushPos, setRemoteBrushPos] = useState<Record<string, { x: number; y: number; color: string }>>({})
  const channelRef = useRef<any>(null)
  const isRemoteUpdate = useRef(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement>(null)
  const workspaceRef = useRef<HTMLDivElement>(null)

  // AI Suggestions State
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Before/After comparison slider state
  const [compareMode, setCompareMode] = useState<'slider' | 'toggle' | 'side-by-side'>('slider')
  const [sliderPos, setSliderPos] = useState(50) // 0-100%
  const [isDraggingSlider, setIsDraggingSlider] = useState(false)
  const [isComparing, setIsComparing] = useState(false)
  const compareContainerRef = useRef<HTMLDivElement>(null)
  const [hintVisible, setHintVisible] = useState(true)

  // Loading message rotation
  useEffect(() => {
    let interval: any
    if (isLoading) {
      interval = setInterval(() => {
        setLoadingMsgIndex((prev) => (prev + 1) % LOADING_MESSAGES.length)
      }, 1500)
    } else {
      setLoadingMsgIndex(0)
    }
    return () => clearInterval(interval)
  }, [isLoading])

  const currentUrl = history[historyIndex]

  const handleReferenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingReference(true)
    setError(null)

    try {
      const { publicUrl } = await blink.storage.upload(
        file,
        `style-references/${Date.now()}.${file.name.split('.').pop()}`
      )
      setReferenceUrl(publicUrl)
      setCustomStyles(prev => [{ url: publicUrl, timestamp: Date.now() }, ...prev])
    } catch (e: any) {
      setError(classifyError(e, 'upload'))
    } finally {
      setIsUploadingReference(false)
    }
  }

  const handleEdit = async (editPrompt: string, overrideIntensity?: number) => {
    const isStyleTransfer = activeTab === 'transfer' && referenceUrl
    if ((!editPrompt.trim() && !isStyleTransfer) || isLoading) return
    
    setIsLoading(true)
    setError(null)

    const finalIntensity = overrideIntensity ?? intensity
    
    // Bake adjustments into prompt
    const adjStrings = []
    if (adjustments.brightness !== 100) adjStrings.push(`brightness: ${adjustments.brightness}%`)
    if (adjustments.contrast !== 100) adjStrings.push(`contrast: ${adjustments.contrast}%`)
    if (adjustments.saturation !== 100) adjStrings.push(`saturation: ${adjustments.saturation}%`)
    if (adjustments.hue !== 0) adjStrings.push(`hue-rotate: ${adjustments.hue}deg`)
    
    const adjustmentPrompt = adjStrings.length > 0 
      ? ` With adjustments: ${adjStrings.join(', ')}.` 
      : ''

    let finalImages = [currentUrl]
    let finalPrompt = editPrompt

    if (isStyleTransfer) {
      const methodDesc = 
        transferMethod === 'cyclegan' ? 'Using generative adversarial domain translation (CycleGAN style) for high structural mapping.' :
        transferMethod === 'wgan' ? 'Using Wasserstein GAN synthesis for stable, realistic texture reproduction.' :
        'Using neural fusion for artistic style integration.'

      if (hasMask && maskCanvasRef.current) {
        try {
          const maskBlob = await new Promise<Blob>((resolve) => maskCanvasRef.current!.toBlob((b) => resolve(b!), 'image/png'))
          const { publicUrl: maskUrl } = await blink.storage.upload(maskBlob, `masks/mask-${Date.now()}.png`)
          finalImages = [currentUrl, referenceUrl!, maskUrl]
          finalPrompt = `In the area marked by image 3, apply the artistic style, color palette, and textures from image 2. 
            Maintain the rest of image 1 exactly as it is. 
            ${methodDesc}
            Style influence: ${styleIntensity}%. 
            Structural preservation: ${contentPreservation}%. 
            Original color retention: ${colorPreservation}%. 
            Texture fidelity: ${textureDetail}%.
            The resulting transformation within the mask MUST be a seamless fusion.${adjustmentPrompt}`
        } catch (e) {
          console.error('Mask upload failed', e)
          // Fallback to global
          finalImages = [currentUrl, referenceUrl!]
          finalPrompt = `${editPrompt || 'Apply artistic style and color palette from second image to first'}. 
            ${methodDesc}
            Style influence: ${styleIntensity}%. 
            Structural subject preservation: ${contentPreservation}%. 
            Original color retention: ${colorPreservation}%. 
            Texture & surface detail fidelity: ${textureDetail}%.
            The result MUST be a seamless fusion: maintain the exact layout and core subject of image 1, while applying the artistic textures, lighting, and aesthetic of image 2.${adjustmentPrompt}`
        }
      } else {
        finalImages = [currentUrl, referenceUrl!]
        finalPrompt = `${editPrompt || 'Apply artistic style and color palette from second image to first'}. 
          ${methodDesc}
          Style influence: ${styleIntensity}%. 
          Structural subject preservation: ${contentPreservation}%. 
          Original color retention: ${colorPreservation}%. 
          Texture & surface detail fidelity: ${textureDetail}%.
          The result MUST be a seamless fusion: maintain the exact layout and core subject of image 1, while applying the artistic textures, lighting, and aesthetic of image 2.${adjustmentPrompt}`
      }
    } else if (activeTab === 'brush' && hasMask && maskCanvasRef.current) {
      try {
        const maskBlob = await new Promise<Blob>((resolve) => maskCanvasRef.current!.toBlob((b) => resolve(b!), 'image/png'))
        const { publicUrl: maskUrl } = await blink.storage.upload(maskBlob, `masks/mask-${Date.now()}.png`)
        finalImages = [currentUrl, maskUrl]
        finalPrompt = `In the area marked by the mask, ${editPrompt}. Maintain the rest of the image exactly as it is.`
      } catch (e) {
        console.error('Mask upload failed', e)
      }
    } else {
      if (activeTab === 'style' || activeTab === 'lighting') {
        finalPrompt = `${editPrompt}. Apply this with ${finalIntensity}% intensity.${adjustmentPrompt}`
      } else {
        finalPrompt = `${editPrompt}.${adjustmentPrompt}`
      }
    }

    try {
      const { data } = await blink.ai.modifyImage({
        images: finalImages,
        prompt: finalPrompt,
        model: isHighQuality ? 'fal-ai/nano-banana-pro/edit' : 'fal-ai/nano-banana/edit',
      })
      const newUrl = data[0]?.url || null
      if (newUrl) {
        const newHistory = history.slice(0, historyIndex + 1)
        newHistory.push(newUrl)
        setHistory(newHistory)
        setHistoryIndex(newHistory.length - 1)
        clearMask()
      }
    } catch (e: any) {
      setError(classifyError(e, 'model'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleBatchUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsLoading(true);
    setError(null);
    setBatchUrls([]);
    setBatchResults([]);
    setIsProcessingBatch(false);
    setBatchProgress({ current: 0, total: 0 });

    const uploadedUrls: string[] = [];
    try {
      for (const file of files) {
        const { publicUrl } = await blink.storage.upload(
          file,
          `batch-uploads/${Date.now()}.${file.name.split('.').pop()}`
        );
        uploadedUrls.push(publicUrl);
      }
      setBatchUrls(uploadedUrls);
      setBatchProgress({ current: 0, total: uploadedUrls.length });
      setIsProcessingBatch(true); // Enable processing button
    } catch (e: any) {
      setError(classifyError(e, 'upload'))
      setIsLoading(false);
    }
  };

  const processBatch = async () => {
    const isStyleTransfer = !!referenceUrl
    if (batchUrls.length === 0 || (!prompt.trim() && !isStyleTransfer)) return

    setIsProcessingBatch(true)
    setBatchResults([])
    setBatchProgress({ current: 0, total: batchUrls.length })

    // Bake adjustments for batch
    const adjStrings = []
    if (adjustments.brightness !== 100) adjStrings.push(`brightness: ${adjustments.brightness}%`)
    if (adjustments.contrast !== 100) adjStrings.push(`contrast: ${adjustments.contrast}%`)
    if (adjustments.saturation !== 100) adjStrings.push(`saturation: ${adjustments.saturation}%`)
    if (adjustments.hue !== 0) adjStrings.push(`hue-rotate: ${adjustments.hue}deg`)
    const adjustmentPrompt = adjStrings.length > 0 ? ` With adjustments: ${adjStrings.join(', ')}.` : ''

    for (let i = 0; i < batchUrls.length; i++) {
      try {
        const bUrl = batchUrls[i]
        let bFinalImages = [bUrl]
        let bFinalPrompt = prompt

        if (isStyleTransfer) {
          const methodDesc = 
            transferMethod === 'cyclegan' ? 'Using generative adversarial domain translation (CycleGAN style) for high structural mapping.' :
            transferMethod === 'wgan' ? 'Using Wasserstein GAN synthesis for stable, realistic texture reproduction.' :
            'Using neural fusion for artistic style integration.'

          bFinalImages = [bUrl, referenceUrl!]
          bFinalPrompt = `${prompt || 'Apply artistic style and color palette from second image to first'}. 
            ${methodDesc}
            Style influence: ${styleIntensity}%. 
            Structural subject preservation: ${contentPreservation}%. 
            Original color retention: ${colorPreservation}%. 
            Texture & surface detail fidelity: ${textureDetail}%.
            Ensure the resulting image follows the artistic aesthetic of the second image while keeping the core subject and layout of the first image.${adjustmentPrompt}`
        } else {
          bFinalPrompt = `${prompt}. Apply this with ${intensity}% intensity.${adjustmentPrompt}`
        }

        const { data } = await blink.ai.modifyImage({
          images: bFinalImages,
          prompt: bFinalPrompt,
          model: isHighQuality ? 'fal-ai/nano-banana-pro/edit' : 'fal-ai/nano-banana/edit',
        })

        if (data[0]?.url) {
          setBatchResults(prev => [...prev, { original: bUrl, edited: data[0].url }])
        }
      } catch (e) {
        console.error(`Batch processing failed for image ${i}:`, e)
      }
      setBatchProgress(prev => ({ ...prev, current: i + 1 }))
    }
    setIsProcessingBatch(false)
  }

  // ─── Canvas / Brush Logic ─────────────────────────────────────────────────

  /** Sync both overlay + mask canvas dimensions to match the displayed image */
  const syncCanvasSize = useCallback(() => {
    const overlay = canvasRef.current
    const mask = maskCanvasRef.current
    if (!overlay || !mask) return

    const rect = overlay.getBoundingClientRect()
    const w = Math.round(rect.width)
    const h = Math.round(rect.height)
    if (w === 0 || h === 0) return

    if (overlay.width !== w || overlay.height !== h) {
      // Preserve existing mask strokes before resize
      let savedMask: ImageData | null = null
      const mCtx = mask.getContext('2d')
      if (mCtx && mask.width > 0 && mask.height > 0) {
        try { savedMask = mCtx.getImageData(0, 0, mask.width, mask.height) } catch { /* ignore */ }
      }

      overlay.width = w
      overlay.height = h
      mask.width = w
      mask.height = h

      // Re-fill mask with black (transparent = not masked)
      if (mCtx) {
        mCtx.fillStyle = '#000000'
        mCtx.fillRect(0, 0, w, h)
        if (savedMask) {
          // Restore at original size (best-effort)
          mCtx.putImageData(savedMask, 0, 0)
        }
      }
    }
  }, [])

  /** Get scaled canvas coordinates from a mouse or touch event */
  const getCanvasCoords = (
    e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent,
    canvas: HTMLCanvasElement
  ): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect()
    let clientX: number, clientY: number
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else if ('changedTouches' in e && (e as TouchEvent).changedTouches.length > 0) {
      clientX = (e as TouchEvent).changedTouches[0].clientX
      clientY = (e as TouchEvent).changedTouches[0].clientY
    } else {
      clientX = (e as MouseEvent).clientX
      clientY = (e as MouseEvent).clientY
    }
    // canvas pixel coords — already 1:1 after syncCanvasSize
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    }
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (activeTab !== 'brush') return
    e.preventDefault()

    syncCanvasSize()

    const overlay = canvasRef.current
    const mask = maskCanvasRef.current
    if (!overlay || !mask) return

    const { x, y } = getCanvasCoords(e, overlay)
    lastPointRef.current = { x, y }
    setIsDrawing(true)
    setMousePos({ x, y })

    // Paint a dot immediately so single clicks are visible
    paintAt(x, y, x, y)

    if (channelRef.current) {
      channelRef.current.publish('brush', { x, y, size: brushSize, isEraser, isStart: true })
    }
  }

  const stopDrawing = (e?: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return
    setIsDrawing(false)
    lastPointRef.current = null

    // Reset composite operations
    const overlayCtx = canvasRef.current?.getContext('2d')
    const maskCtx = maskCanvasRef.current?.getContext('2d')
    if (overlayCtx) overlayCtx.globalCompositeOperation = 'source-over'
    if (maskCtx) maskCtx.globalCompositeOperation = 'source-over'
  }

  /** Core paint function — draws from (x0,y0) to (x1,y1) on both canvases */
  const paintAt = (x0: number, y0: number, x1: number, y1: number) => {
    const overlay = canvasRef.current
    const mask = maskCanvasRef.current
    if (!overlay || !mask) return

    const overlayCtx = overlay.getContext('2d')
    const maskCtx = mask.getContext('2d')
    if (!overlayCtx || !maskCtx) return

    const applyStroke = (ctx: CanvasRenderingContext2D, color: string) => {
      ctx.save()
      ctx.lineWidth = brushSize
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      if (isEraser) {
        ctx.globalCompositeOperation = 'destination-out'
        ctx.strokeStyle = 'rgba(0,0,0,1)'
      } else {
        ctx.globalCompositeOperation = 'source-over'
        ctx.strokeStyle = color
      }

      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.stroke()
      ctx.restore()
    }

    // Overlay canvas — semi-transparent purple so the user can see the mask
    applyStroke(overlayCtx, brushColor)
    // Mask canvas — pure white strokes on black background
    applyStroke(maskCtx, '#ffffff')

    setHasMask(true)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    const overlay = canvasRef.current
    if (!overlay) return

    const { x, y } = getCanvasCoords(e, overlay)
    setMousePos({ x, y })

    if (channelRef.current) {
      channelRef.current.publish('brush-pos', { x, y })
    }

    if (!isDrawing || activeTab !== 'brush') return

    const prev = lastPointRef.current ?? { x, y }
    paintAt(prev.x, prev.y, x, y)
    lastPointRef.current = { x, y }

    if (channelRef.current) {
      channelRef.current.publish('brush', { x0: prev.x, y0: prev.y, x, y, size: brushSize, isEraser, isStart: false })
    }
  }

  const clearMask = () => {
    const overlayCtx = canvasRef.current?.getContext('2d')
    const maskCtx = maskCanvasRef.current?.getContext('2d')
    if (overlayCtx && canvasRef.current) {
      overlayCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    }
    if (maskCtx && maskCanvasRef.current) {
      maskCtx.fillStyle = '#000000'
      maskCtx.fillRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height)
    }
    lastPointRef.current = null
    setHasMask(false)
  }

  // Sync canvas size when switching to brush tab, and keep in sync on resize
  useEffect(() => {
    if (activeTab !== 'brush') return

    // Use rAF so the DOM has finished layout
    const id = requestAnimationFrame(() => {
      syncCanvasSize()
    })

    // Keep overlay in sync when the editor is resized
    const observer = new ResizeObserver(() => {
      syncCanvasSize()
    })
    if (canvasRef.current) {
      observer.observe(canvasRef.current.parentElement || canvasRef.current)
    }

    return () => {
      cancelAnimationFrame(id)
      observer.disconnect()
    }
  }, [activeTab, syncCanvasSize])

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1)
    }
  }

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1)
    }
  }

  const handleReset = () => {
    setHistoryIndex(0)
    setAdjustments({
      brightness: 100,
      contrast: 100,
      saturation: 100,
      hue: 0,
      blur: 0,
    })
    setSelectedEffect(null)
    setPrompt('')
    setReferenceUrl(null)
    setStyleIntensity(80)
    setContentPreservation(70)
    setColorPreservation(20)
    setTextureDetail(50)
    setTransferMethod('neural')
    setIsHighQuality(false)
    clearMask()
    setBatchUrls([])
    setBatchResults([])
    setIsProcessingBatch(false)
    setSuggestions([])
    setShowSuggestions(false)
    setBatchProgress({ current: 0, total: 0 })
  }

  // ── AI Suggestion handler ──────────────────────────────────────────────────
  const fetchSuggestions = async () => {
    const imageUrl = history[historyIndex]
    if (!imageUrl || loadingSuggestions) return
    setLoadingSuggestions(true)
    setShowSuggestions(true)
    setSuggestions([])
    try {
      const { text } = await blink.ai.generateText({
        model: 'gpt-4.1-mini',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this image and suggest 5 specific, creative editing prompts that would enhance or transform it. Each suggestion should be actionable and specific. Return as a JSON array of strings. Only return the JSON array, nothing else.' },
            { type: 'image', image: imageUrl }
          ]
        }]
      })
      const match = text.match(/\[[\s\S]*\]/)
      const parsed: string[] = match ? JSON.parse(match[0]) : []
      setSuggestions(parsed.slice(0, 5))
    } catch {
      setSuggestions(['Add warm golden hour lighting', 'Apply cinematic color grading', 'Enhance details and sharpness', 'Convert to black and white noir style', 'Add dramatic bokeh background blur'])
    } finally {
      setLoadingSuggestions(false)
    }
  }

  // ── Error classification helpers ──────────────────────────────────────────
  function classifyError(e: any, context: 'upload' | 'model' | 'general') {
    const msg: string = e?.message || String(e) || ''
    const lower = msg.toLowerCase()

    if (lower.includes('timeout') || lower.includes('network') || lower.includes('fetch') || lower.includes('websocket') || lower.includes('offline')) {
      return { type: 'network' as const, message: 'Network error — check your connection and try again.' }
    }
    if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('auth')) {
      return { type: 'auth' as const, message: 'Session expired — please refresh the page and sign in again.' }
    }
    if (lower.includes('quota') || lower.includes('rate limit') || lower.includes('429') || lower.includes('limit exceeded')) {
      return { type: 'quota' as const, message: 'Request limit reached — wait a moment and try again.' }
    }
    if (context === 'upload') {
      if (lower.includes('size') || lower.includes('too large') || lower.includes('413')) {
        return { type: 'upload' as const, message: 'File is too large — try a smaller image (under 10 MB).' }
      }
      return { type: 'upload' as const, message: 'Upload failed — check your connection and try a different image.' }
    }
    if (context === 'model') {
      return { type: 'model' as const, message: 'AI edit failed — the model may be busy. Try again or switch to a simpler prompt.' }
    }
    return { type: 'general' as const, message: msg || 'Something went wrong. Please try again.' }
  }

  function classifyCollabError(e: any): string {
    const msg: string = e?.message || String(e) || ''
    const lower = msg.toLowerCase()
    if (lower.includes('timeout')) {
      return 'Could not connect to collaboration server (timeout). Check your network or try again later.'
    }
    if (lower.includes('auth') || lower.includes('401') || lower.includes('unauthorized')) {
      return 'Collaboration requires you to be signed in. Please log in and try again.'
    }
    if (lower.includes('websocket') || lower.includes('network')) {
      return 'WebSocket connection failed. A firewall or VPN may be blocking live collaboration.'
    }
    return 'Collaboration unavailable right now. Solo editing still works normally.'
  }

  const getFilterString = () => {
    return `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturation}%) hue-rotate(${adjustments.hue}deg) blur(${adjustments.blur}px)`
  }

  /** Compute the CSS --range-progress percentage for a studio-slider */
  const rangeProgress = (value: number, min: number, max: number): React.CSSProperties => ({
    '--range-progress': `${((value - min) / (max - min)) * 100}%`,
  } as React.CSSProperties)

  // Auto-dismiss collab error after 8 seconds
  useEffect(() => {
    if (!collabError) return
    const timer = setTimeout(() => setCollabError(null), 8000)
    return () => clearTimeout(timer)
  }, [collabError])

  // Reset drag hint when compare is toggled on
  useEffect(() => {
    if (isComparing) {
      setHintVisible(true)
      setSliderPos(50)
    }
  }, [isComparing])

  // Auto-enable compare mode when first edit is made
  useEffect(() => {
    if (history.length === 2) {
      setIsComparing(true)
      setCompareMode('slider')
    }
  }, [history.length])

  // Comparison Slider Logic
  const stopSliderDrag = useCallback(() => {
    setIsDraggingSlider(false)
  }, [])

  useEffect(() => {
    if (!isDraggingSlider) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!compareContainerRef.current) return
      const rect = compareContainerRef.current.getBoundingClientRect()
      const newPos = ((e.clientX - rect.left) / rect.width) * 100
      setSliderPos(Math.max(2, Math.min(98, newPos)))
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!compareContainerRef.current) return
      const rect = compareContainerRef.current.getBoundingClientRect()
      const newPos = ((e.touches[0].clientX - rect.left) / rect.width) * 100
      setSliderPos(Math.max(2, Math.min(98, newPos)))
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', stopSliderDrag)
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', stopSliderDrag)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', stopSliderDrag)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', stopSliderDrag)
    }
  }, [isDraggingSlider, stopSliderDrag])

  // Collaboration Logic — connect only when user explicitly enables it
  const [collabEnabled, setCollabEnabled] = useState(false)

  useEffect(() => {
    if (!collabEnabled || !user?.id || !url) return

    let channel: any = null
    let mounted = true

    const connectToCollaboration = async () => {
      try {
        const channelId = `image-editor-${btoa(url).slice(0, 32)}`
        channel = blink.realtime.channel(channelId)
        channelRef.current = channel

        const colors = ['#7c3aed', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444']
        const userColor = colors[Math.floor(Math.random() * colors.length)]

        await channel.subscribe({
          userId: user.id,
          metadata: { 
            displayName: user.displayName || 'Anonymous',
            avatar: user.avatarUrl,
            status: 'editing',
            color: userColor
          }
        })

        if (!mounted) return

        channel.onPresence((users: any[]) => {
          if (!mounted) return
          setOnlineUsers(users)
        })

        channel.onMessage((msg: any) => {
          if (!mounted || msg.userId === user.id) return

          isRemoteUpdate.current = true
          
          if (msg.type === 'adjustment') {
            setAdjustments(msg.data)
          } else if (msg.type === 'tab') {
            setActiveTab(msg.data)
          } else if (msg.type === 'prompt') {
            setPrompt(msg.data)
          } else if (msg.type === 'brush') {
            handleRemoteDraw(msg.data)
          } else if (msg.type === 'brush-pos') {
            setRemoteBrushPos(prev => ({
              ...prev,
              [msg.userId]: { ...msg.data, color: msg.metadata?.color || '#7c3aed' }
            }))
          }

          setTimeout(() => {
            isRemoteUpdate.current = false
          }, 50)
        })

      } catch (err: any) {
        if (mounted) {
          setCollabEnabled(false)
          setOnlineUsers([])
          channelRef.current = null
          setCollabError(classifyCollabError(err))
        }
      }
    }

    connectToCollaboration()

    return () => {
      mounted = false
      try { channel?.unsubscribe() } catch { /* ignore cleanup errors */ }
      channelRef.current = null
    }
  }, [collabEnabled, user?.id, url])

  // Sync state changes
  useEffect(() => {
    if (isRemoteUpdate.current || !channelRef.current) return
    channelRef.current.publish('adjustment', adjustments)
  }, [adjustments])

  useEffect(() => {
    if (isRemoteUpdate.current || !channelRef.current) return
    channelRef.current.publish('tab', activeTab)
  }, [activeTab])

  useEffect(() => {
    if (isRemoteUpdate.current || !channelRef.current) return
    channelRef.current.publish('prompt', prompt)
  }, [prompt])

  const handleRemoteDraw = (data: any) => {
    const overlay = canvasRef.current
    const mask = maskCanvasRef.current
    if (!overlay || !mask) return

    const overlayCtx = overlay.getContext('2d')
    const maskCtx = mask.getContext('2d')
    if (!overlayCtx || !maskCtx) return

    const { x0, y0, x, y, size, isEraser: remoteEraser, isStart } = data

    const fromX = (isStart || x0 == null) ? x : x0
    const fromY = (isStart || y0 == null) ? y : y0

    const applyRemoteStroke = (ctx: CanvasRenderingContext2D, color: string) => {
      ctx.save()
      ctx.lineWidth = size || 20
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      if (remoteEraser) {
        ctx.globalCompositeOperation = 'destination-out'
        ctx.strokeStyle = 'rgba(0,0,0,1)'
      } else {
        ctx.globalCompositeOperation = 'source-over'
        ctx.strokeStyle = color
      }
      ctx.beginPath()
      ctx.moveTo(fromX, fromY)
      ctx.lineTo(x, y)
      ctx.stroke()
      ctx.restore()
    }

    applyRemoteStroke(overlayCtx, 'rgba(236, 72, 153, 0.5)')
    applyRemoteStroke(maskCtx, '#ffffff')
  }

  // ─── TOOL DOCK CONFIG ─────────────────────────────────────────────────────
  const toolDockItems = [
    { id: 'style' as const,    icon: <Palette size={18} />,    label: 'Style'    },
    { id: 'transfer' as const, icon: <Sparkles size={18} />,   label: 'Transfer' },
    { id: 'brush' as const,    icon: <Brush size={18} />,      label: 'Mask'     },
    { id: 'adjust' as const,   icon: <Sliders size={18} />,    label: 'Adjust'   },
    { id: 'filters' as const,  icon: <Droplets size={18} />,   label: 'Filters'  },
    { id: 'lighting' as const, icon: <Sun size={18} />,        label: 'Lighting' },
    { id: 'batch' as const,    icon: <Layers size={18} />,     label: 'Batch'    },
  ]

  const panelTitle: Record<string, string> = {
    style: 'Style',
    transfer: 'Style Transfer',
    brush: 'Brush / Mask',
    adjust: 'Adjustments',
    filters: 'Filters',
    lighting: 'Lighting',
    batch: 'Batch Process',
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      {/* ── MAIN MODAL ── */}
      <motion.div
        initial={{ scale: 0.97, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.97, opacity: 0, y: 24 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[1400px] h-[100dvh] sm:h-[92vh] sm:max-h-[900px] bg-card/95 backdrop-blur-2xl rounded-none sm:rounded-[2rem] border border-border/30 shadow-2xl shadow-black/50 flex flex-col overflow-hidden"
      >

        {/* ══════════════════════════════════════════════════════════
            HEADER
        ══════════════════════════════════════════════════════════ */}
        <div className="h-14 flex items-center justify-between px-5 border-b border-border/30 bg-background/50 backdrop-blur-sm shrink-0">

          {/* Left: icon + title + status */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
              <Wand2 size={15} className="text-white" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold leading-none">Creative Studio</span>
              <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-medium">v2.0</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 ml-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-medium text-muted-foreground/60">Live</span>
            </div>
          </div>

          {/* Center: collaboration toggle + avatars */}
          <div className="hidden lg:flex items-center gap-2">
            {collabEnabled && onlineUsers.length > 0 && (
              <div className="flex -space-x-1.5">
                {onlineUsers.map((u) => (
                  <div
                    key={u.userId}
                    className="relative group w-6 h-6 rounded-full border-2 border-background bg-muted overflow-hidden"
                  >
                    {u.metadata?.avatar
                      ? <img src={u.metadata.avatar} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-foreground/70">{(u.metadata?.displayName || 'A')[0].toUpperCase()}</div>
                    }
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black text-white text-[8px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                      {u.metadata?.displayName}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setCollabEnabled(!collabEnabled)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-medium transition-all duration-150 active:scale-95",
                collabEnabled
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 "
                  : "bg-muted/40 border-border/30 text-muted-foreground hover:border-border/60"
              )}
              title={collabEnabled ? "Disable live collaboration" : "Enable live collaboration"}
            >
              <Users size={11} />
              <span>{collabEnabled ? `Live (${onlineUsers.length})` : 'Collab'}</span>
            </button>
          </div>

          {/* Right: undo/redo + history + pro toggle + close */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleUndo}
              disabled={historyIndex === 0}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-30 transition-all active:scale-95 duration-150"
              title="Undo"
            >
              <RotateCcw size={14} />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-30 transition-all active:scale-95 duration-150"
              title="Redo"
            >
              <ArrowRight size={14} />
            </button>

            <div className="w-px h-5 bg-border/50 mx-1" />

            {/* History dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-95 duration-150",
                  showHistory ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                title="Version History"
              >
                <History size={14} />
              </button>

              <AnimatePresence>
                {showHistory && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full right-0 mt-2 w-64 glass border border-border/20 rounded-2xl shadow-2xl z-50 overflow-hidden"
                  >
                    <div className="px-4 py-3 border-b border-border/20">
                      <span className="text-xs font-semibold text-foreground/80">Version History</span>
                    </div>
                    <div className="p-2 space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
                      {history.map((h, i) => (
                        <button
                          key={i}
                          onClick={() => { setHistoryIndex(i); setShowHistory(false) }}
                          className={cn(
                            "w-full flex items-center gap-3 p-2 rounded-xl transition-all text-left",
                            i === historyIndex ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-muted/40"
                          )}
                        >
                          <img src={h} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-[11px] font-medium">{i === 0 ? 'Original' : `Version ${i}`}</span>
                            {i === historyIndex && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                <span className="text-[9px] text-primary font-medium">Current</span>
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="w-px h-5 bg-border/50 mx-1" />

            {/* Pro quality toggle */}
            <button
              onClick={() => setIsHighQuality(!isHighQuality)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all duration-150 active:scale-95",
                isHighQuality
                  ? "bg-primary/15 text-primary border border-primary/25"
                  : "bg-muted/40 text-muted-foreground border border-border/30 hover:border-primary/20"
              )}
            >
              <Sparkles size={10} />
              Pro
            </button>

            <div className="w-px h-5 bg-border/50 mx-1" />

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all active:scale-95 duration-150"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
            BODY
        ══════════════════════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col sm:flex-row min-h-0 overflow-hidden">

          {/* ── ZONE 1: TOOL DOCK — horizontal scrollable on mobile, vertical on desktop ── */}
          <div className="sm:w-[72px] shrink-0 border-b sm:border-b-0 sm:border-r border-border/20 flex flex-row sm:flex-col items-center sm:py-4 px-2 sm:px-0 py-1.5 sm:py-4 gap-1 bg-background/30 backdrop-blur-sm overflow-x-auto sm:overflow-x-visible">

            {toolDockItems.map((tool) => (
              <div key={tool.id} className="relative w-full flex flex-col items-center">
                <button
                  onClick={() => setActiveTab(tool.id)}
                  className={cn(
                    "w-[44px] h-[44px] sm:w-[52px] sm:h-[52px] rounded-xl flex flex-col items-center justify-center gap-0.5 sm:gap-1 transition-all duration-200 active:scale-95 shrink-0",
                    activeTab === tool.id
                      ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:scale-105"
                  )}
                  title={tool.label}
                >
                  {tool.icon}
                  <span className="text-[8px] font-medium leading-none">{tool.label}</span>
                </button>
                {activeTab === tool.id && (
                  <motion.div
                    layoutId="tool-active-dot"
                    className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-l-full bg-primary"
                  />
                )}
              </div>
            ))}

            <div className="flex-1" />

            {/* Users count at bottom — only when collab is active */}
            {collabEnabled && onlineUsers.length > 0 && (
              <div className="flex flex-col items-center gap-1 mb-2">
                <div className="w-[52px] h-[52px] rounded-xl flex flex-col items-center justify-center gap-1 text-emerald-500/80">
                  <Users size={16} />
                  <span className="text-[8px] font-medium">{onlineUsers.length}</span>
                </div>
              </div>
            )}
          </div>

          {/* ── ZONE 2: TOOL PANEL ── */}
          <div className="w-full sm:w-[300px] shrink-0 border-b sm:border-b-0 sm:border-r border-border/20 flex flex-col bg-background/20 backdrop-blur-sm overflow-hidden max-h-[40vh] sm:max-h-none">

            {/* Panel header */}
            <div className="h-10 flex items-center justify-between px-4 border-b border-border/20 shrink-0">
              <span className="text-xs font-semibold text-foreground/80">{panelTitle[activeTab]}</span>
            </div>

            {/* Inline error banner — shown below header, above panel content */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="shrink-0 overflow-hidden border-b border-border/20"
                >
                  <div className={cn(
                    "flex items-start gap-2.5 px-3 py-2.5",
                    error.type === 'network' && 'bg-amber-500/8',
                    error.type === 'auth' && 'bg-blue-500/8',
                    error.type === 'quota' && 'bg-orange-500/8',
                    (error.type === 'model' || error.type === 'upload' || error.type === 'general') && 'bg-destructive/6',
                  )}>
                    <div className={cn(
                      "shrink-0 mt-0.5",
                      error.type === 'network' && 'text-amber-500',
                      error.type === 'auth' && 'text-blue-500',
                      error.type === 'quota' && 'text-orange-500',
                      (error.type === 'model' || error.type === 'upload' || error.type === 'general') && 'text-destructive',
                    )}>
                      {error.type === 'network' ? <WifiOff size={12} /> :
                       error.type === 'auth' ? <Info size={12} /> :
                       <AlertTriangle size={12} />}
                    </div>
                    <p className="flex-1 text-[10px] leading-relaxed text-foreground/80">
                      {error.message}
                    </p>
                    <button
                      onClick={() => setError(null)}
                      className="shrink-0 text-muted-foreground/50 hover:text-foreground/60 transition-colors mt-0.5"
                      aria-label="Dismiss"
                    >
                      <X size={11} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
              <AnimatePresence mode="wait">

                {/* ── STYLE TAB ── */}
                {activeTab === 'style' && (
                  <motion.div
                    key="style"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-4"
                  >
                    {/* Intensity */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide">Effect Strength</span>
                        <span className="text-[10px] font-semibold text-primary tabular-nums">{intensity}%</span>
                      </div>
                      <input
                        type="range" min="0" max="100" value={intensity}
                        onChange={(e) => setIntensity(parseInt(e.target.value))}
                        style={rangeProgress(intensity, 0, 100)}
                        className="w-full studio-slider"
                      />
                    </div>

                    <div className="w-full h-px bg-border/30" />

                    <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60 block">Style Presets</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {STYLE_EDITS.map((edit) => (
                        <button
                          key={edit.label}
                          onClick={() => { setSelectedEffect(edit.label); handleEdit(edit.prompt) }}
                          disabled={isLoading}
                          className={cn(
                            "py-2 px-1 rounded-xl text-[10px] font-medium border transition-all duration-150 active:scale-95 disabled:opacity-40 leading-tight text-center",
                            selectedEffect === edit.label
                              ? "border-primary bg-primary/8 text-primary"
                              : "border-border/40 bg-muted/30 hover:border-primary/30 hover:bg-muted/50 text-foreground/70"
                          )}
                        >
                          {edit.label}
                        </button>
                      ))}
                    </div>

                    <div className="w-full h-px bg-border/30" />

                    {/* Pro enhancements accordion */}
                    <div className="rounded-xl border border-border/20 overflow-hidden">
                      <button
                        onClick={() => setEnhancementsOpen(!enhancementsOpen)}
                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Zap size={13} className="text-amber-500" />
                          <span className="text-[10px] font-semibold uppercase tracking-widest">AI Enhance</span>
                        </div>
                        <ChevronDown size={13} className={cn("text-muted-foreground transition-transform duration-200", enhancementsOpen && "rotate-180")} />
                      </button>
                      <AnimatePresence>
                        {enhancementsOpen && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="p-2 grid grid-cols-2 gap-1.5 border-t border-border/20 bg-background/30">
                              {ENHANCE_EDITS.map((edit) => (
                                <button
                                  key={edit.label}
                                  onClick={() => { setSelectedEffect(edit.label); handleEdit(edit.prompt) }}
                                  disabled={isLoading}
                                  className={cn(
                                    "flex items-center gap-2 p-2.5 rounded-lg border transition-all duration-150 active:scale-95 disabled:opacity-40 text-[10px] font-medium",
                                    selectedEffect === edit.label
                                      ? "border-primary bg-primary/8 text-primary"
                                      : "border-border/40 bg-muted/30 hover:border-primary/30 hover:bg-muted/50 text-foreground/70"
                                  )}
                                >
                                  <span className="shrink-0 text-primary/60">{edit.icon}</span>
                                  {edit.label}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}

                {/* ── TRANSFER TAB ── */}
                {activeTab === 'transfer' && (
                  <motion.div
                    key="transfer"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-4"
                  >
                    {/* Upload custom reference */}
                    <div>
                      <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60 block mb-2">Custom Reference</span>
                      <label className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-dashed border-border/40 hover:border-primary/40 bg-muted/20 hover:bg-muted/30 transition-all cursor-pointer">
                        {isUploadingReference
                          ? <Loader2 size={18} className="animate-spin text-primary" />
                          : <Upload size={18} className="text-muted-foreground/60" />
                        }
                        <span className="text-[10px] text-muted-foreground/60 font-medium">
                          {isUploadingReference ? 'Uploading…' : 'Drop or click to upload'}
                        </span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleReferenceUpload} />
                      </label>
                    </div>

                    {/* User custom styles */}
                    {customStyles.length > 0 && (
                      <div>
                        <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60 block mb-2">Your Uploads</span>
                        <div className="grid grid-cols-3 gap-1.5">
                          {customStyles.map((s) => (
                            <button
                              key={s.timestamp}
                              onClick={() => setReferenceUrl(s.url)}
                              className={cn(
                                "relative aspect-square rounded-xl overflow-hidden border transition-all",
                                referenceUrl === s.url ? "border-primary ring-1 ring-primary/25" : "border-border/30 hover:border-primary/40"
                              )}
                            >
                              <img src={s.url} alt="" className="w-full h-full object-cover" />
                              {referenceUrl === s.url && (
                                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                  <Check size={12} className="text-white" />
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Curated gallery */}
                    <div>
                      <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60 block mb-2">Curated Library</span>
                      <div className="grid grid-cols-2 gap-2">
                        {STYLE_TRANSFER_PRESETS.map((preset) => (
                          <button
                            key={preset.label}
                            onClick={() => setReferenceUrl(preset.url)}
                            className={cn(
                              "group relative aspect-[4/3] rounded-xl overflow-hidden border transition-all hover:scale-[1.02] hover:shadow-lg",
                              referenceUrl === preset.url ? "border-primary ring-1 ring-primary/20" : "border-border/30 hover:border-primary/40"
                            )}
                          >
                            <img
                              src={preset.url} alt={preset.label}
                              className={cn("w-full h-full object-cover transition-all", referenceUrl === preset.url ? "" : "grayscale-[0.4] group-hover:grayscale-0")}
                            />
                            <div className="absolute inset-0 bg-black/40 flex items-end p-2">
                              <span className="text-[9px] font-semibold text-white truncate">{preset.label}</span>
                            </div>
                            {referenceUrl === preset.url && (
                              <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                                <Check size={8} className="text-white" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Preset configs */}
                    {referenceUrl && (
                      <div>
                        <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60 block mb-2">Quick Presets</span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { id: 'balanced', label: 'Balanced', values: { style: 80, content: 70, color: 20, texture: 50 } },
                            { id: 'fidelity', label: 'High Fidelity', values: { style: 40, content: 95, color: 80, texture: 30 } },
                            { id: 'artistic', label: 'Artistic Max', values: { style: 100, content: 30, color: 0, texture: 100 } },
                            { id: 'creative', label: 'Creative', values: { style: 70, content: 50, color: 40, texture: 80 } },
                          ].map((config) => (
                            <button
                              key={config.id}
                              onClick={() => {
                                setStyleIntensity(config.values.style)
                                setContentPreservation(config.values.content)
                                setColorPreservation(config.values.color)
                                setTextureDetail(config.values.texture)
                              }}
                              className="py-2 px-3 rounded-xl border border-border/30 bg-muted/30 text-[10px] font-medium text-foreground/70 hover:border-primary/30 hover:bg-muted/50 transition-all active:scale-95 duration-150"
                            >
                              {config.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Transfer controls */}
                    {referenceUrl && (
                      <div className="space-y-3">
                        {[
                          { label: 'Style Influence', value: styleIntensity, setter: setStyleIntensity },
                          { label: 'Content Lock', value: contentPreservation, setter: setContentPreservation },
                          { label: 'Color Retention', value: colorPreservation, setter: setColorPreservation },
                          { label: 'Texture Detail', value: textureDetail, setter: setTextureDetail },
                        ].map((ctrl) => (
                          <div key={ctrl.label} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide">{ctrl.label}</span>
                              <span className="text-[10px] font-semibold text-primary tabular-nums">{ctrl.value}%</span>
                            </div>
                            <input
                              type="range" min="0" max="100" value={ctrl.value}
                              onChange={(e) => ctrl.setter(parseInt(e.target.value))}
                              style={rangeProgress(ctrl.value, 0, 100)}
                              className="w-full studio-slider"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Algorithm buttons */}
                    {referenceUrl && (
                      <div>
                        <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60 block mb-2">Algorithm</span>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { id: 'neural', label: 'Neural' },
                            { id: 'cyclegan', label: 'CycleGAN' },
                            { id: 'wgan', label: 'WGAN' },
                          ].map((method) => (
                            <button
                              key={method.id}
                              onClick={() => setTransferMethod(method.id as any)}
                              className={cn(
                                "py-2 px-1 rounded-xl border text-[10px] font-medium transition-all duration-150 active:scale-95 text-center",
                                transferMethod === method.id
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border/30 bg-muted/30 text-foreground/60 hover:border-primary/25"
                              )}
                            >
                              {method.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ── BRUSH TAB ── */}
                {activeTab === 'brush' && (
                  <motion.div
                    key="brush"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-4"
                  >
                    {/* Brush / Eraser toggle */}
                    <div>
                      <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60 block mb-2">Tool</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setIsEraser(false)}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-[10px] font-medium transition-all active:scale-95",
                            !isEraser ? "border-primary bg-primary/10 text-primary" : "border-border/30 bg-muted/30 text-foreground/60 hover:border-primary/25"
                          )}
                        >
                          <Brush size={13} /> Brush
                        </button>
                        <button
                          onClick={() => setIsEraser(true)}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-[10px] font-medium transition-all active:scale-95",
                            isEraser ? "border-primary bg-primary/10 text-primary" : "border-border/30 bg-muted/30 text-foreground/60 hover:border-primary/25"
                          )}
                        >
                          <Eraser size={13} /> Eraser
                        </button>
                      </div>
                    </div>

                    {/* Brush size */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide">Brush Size</span>
                        <span className="text-[10px] font-semibold text-primary tabular-nums">{brushSize}px</span>
                      </div>
                      <input
                        type="range" min="2" max="120" value={brushSize}
                        onChange={(e) => setBrushSize(parseInt(e.target.value))}
                        style={rangeProgress(brushSize, 2, 120)}
                        className="w-full studio-slider"
                      />
                    </div>

                    {/* Brush color */}
                    {!isEraser && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide block">Mask Color</span>
                        <div className="flex gap-2 flex-wrap">
                          {[
                            { label: 'Purple', value: 'rgba(124, 58, 237, 0.55)' },
                            { label: 'Red', value: 'rgba(239, 68, 68, 0.55)' },
                            { label: 'Blue', value: 'rgba(59, 130, 246, 0.55)' },
                            { label: 'Green', value: 'rgba(16, 185, 129, 0.55)' },
                            { label: 'Orange', value: 'rgba(245, 158, 11, 0.55)' },
                          ].map(({ label, value }) => (
                            <button
                              key={label}
                              title={label}
                              onClick={() => setBrushColor(value)}
                              className={cn(
                                'w-7 h-7 rounded-full border-2 transition-all active:scale-90',
                                brushColor === value ? 'border-foreground scale-110' : 'border-border/40 hover:border-foreground/50'
                              )}
                              style={{ background: value }}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Clear mask */}
                    {hasMask && (
                      <button
                        onClick={clearMask}
                        className="w-full py-2.5 rounded-xl border border-destructive/30 bg-destructive/5 text-[10px] font-medium text-destructive hover:bg-destructive/10 transition-all active:scale-95"
                      >
                        Clear Mask
                      </button>
                    )}

                    {/* Info hint */}
                    <div className="p-3 rounded-xl border border-primary/15 bg-primary/5">
                      <div className="flex items-start gap-2">
                        <Brush size={12} className="text-primary mt-0.5 shrink-0" />
                        <p className="text-[10px] leading-relaxed text-muted-foreground">
                          Paint over the area you want to edit, then type a prompt and click <span className="font-semibold text-primary">Bake Image</span>.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ── ADJUST TAB ── */}
                {activeTab === 'adjust' && (
                  <motion.div
                    key="adjust"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60">Pro Adjustments</span>
                      <button
                        onClick={() => setAdjustments({ brightness: 100, contrast: 100, saturation: 100, hue: 0, blur: 0 })}
                        className="text-[9px] font-semibold text-primary hover:text-primary/70 transition-colors"
                      >
                        Reset All
                      </button>
                    </div>

                    {[
                      { label: 'Brightness', icon: <SunMedium size={13} />, value: adjustments.brightness, key: 'brightness', min: 0, max: 200, unit: '%' },
                      { label: 'Contrast', icon: <Contrast size={13} />, value: adjustments.contrast, key: 'contrast', min: 0, max: 200, unit: '%' },
                      { label: 'Saturation', icon: <Droplets size={13} />, value: adjustments.saturation, key: 'saturation', min: 0, max: 200, unit: '%' },
                      { label: 'Hue', icon: <Palette size={13} />, value: adjustments.hue, key: 'hue', min: -180, max: 180, unit: '°' },
                      { label: 'Blur', icon: <ImageIcon size={13} />, value: adjustments.blur, key: 'blur', min: 0, max: 10, unit: 'px' },
                    ].map((adj) => (
                      <div key={adj.label} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground/60">{adj.icon}</span>
                            <span className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide">{adj.label}</span>
                          </div>
                          <span className="text-[10px] font-semibold text-primary tabular-nums">{adj.value}{adj.unit}</span>
                        </div>
                        <input
                          type="range" min={adj.min} max={adj.max} value={adj.value}
                          onChange={(e) => setAdjustments(prev => ({ ...prev, [adj.key]: parseInt(e.target.value) }))}
                          style={rangeProgress(adj.value, adj.min, adj.max)}
                          className="w-full studio-slider"
                        />
                      </div>
                    ))}

                    <div className="p-3 rounded-xl border border-primary/15 bg-primary/5 mt-2">
                      <div className="flex items-start gap-2">
                        <Sparkles size={12} className="text-primary mt-0.5 shrink-0" />
                        <p className="text-[10px] leading-relaxed text-muted-foreground">
                          Adjustments preview in real-time. Click <span className="font-semibold text-primary">Bake Image</span> to commit permanently.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ── FILTERS TAB ── */}
                {activeTab === 'filters' && (
                  <motion.div
                    key="filters"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-3"
                  >
                    <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60 block">Preset Filters</span>
                    <div className="grid grid-cols-2 gap-2">
                      {FILTER_PRESETS.map((filter) => (
                        <button
                          key={filter.label}
                          onClick={() => { setSelectedEffect(filter.label); handleEdit(filter.prompt) }}
                          disabled={isLoading}
                          className={cn(
                            "group flex flex-col rounded-xl border overflow-hidden transition-all hover:scale-[1.02] hover:shadow-md disabled:opacity-40 active:scale-95",
                            selectedEffect === filter.label
                              ? "border-primary ring-1 ring-primary/20"
                              : "border-border/30 hover:border-primary/40"
                          )}
                        >
                          <div className="aspect-square relative overflow-hidden">
                            <img
                              src={url} alt={filter.label}
                              style={{ filter: filter.filter }}
                              className="w-full h-full object-cover"
                            />
                            {selectedEffect === filter.label && (
                              <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                <Check size={16} className="text-white" />
                              </div>
                            )}
                          </div>
                          <div className="px-2 py-1.5 bg-background/50">
                            <span className="text-[10px] font-semibold text-foreground/70">{filter.label}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* ── LIGHTING TAB ── */}
                {activeTab === 'lighting' && (
                  <motion.div
                    key="lighting"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-4"
                  >
                    {/* Intensity */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide">Effect Strength</span>
                        <span className="text-[10px] font-semibold text-primary tabular-nums">{intensity}%</span>
                      </div>
                      <input
                        type="range" min="0" max="100" value={intensity}
                        onChange={(e) => setIntensity(parseInt(e.target.value))}
                        style={rangeProgress(intensity, 0, 100)}
                        className="w-full studio-slider"
                      />
                    </div>

                    <div className="w-full h-px bg-border/30" />

                    <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60 block">Lighting Presets</span>
                    <div className="grid grid-cols-2 gap-2">
                      {LIGHTING_EDITS.map((edit) => (
                        <button
                          key={edit.label}
                          onClick={() => { setSelectedEffect(edit.label); handleEdit(edit.prompt) }}
                          disabled={isLoading}
                          className={cn(
                            "py-3 px-3 rounded-xl border text-[11px] font-medium transition-all duration-150 active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2",
                            selectedEffect === edit.label
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border/40 bg-muted/30 hover:border-primary/30 hover:bg-muted/50 text-foreground/70"
                          )}
                        >
                          <Sun size={12} className="shrink-0" />
                          {edit.label}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* ── BATCH TAB ── */}
                {activeTab === 'batch' && (
                  <motion.div
                    key="batch"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-4"
                  >
                    {/* Upload zone */}
                    <div>
                      <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60 block mb-2">Upload Images</span>
                      <label className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border border-dashed border-border/40 hover:border-primary/40 bg-muted/20 hover:bg-muted/30 transition-all cursor-pointer">
                        <Upload size={20} className="text-muted-foreground/50" />
                        <span className="text-[10px] text-muted-foreground/60 font-medium text-center">
                          Drop multiple images or click to browse
                        </span>
                        <input type="file" accept="image/*" multiple className="hidden" onChange={handleBatchUpload} />
                      </label>
                    </div>

                    {/* Queue thumbnails */}
                    {batchUrls.length > 0 && (
                      <div>
                        <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60 block mb-2">
                          Queue ({batchUrls.length})
                        </span>
                        <div className="grid grid-cols-4 gap-1.5">
                          {batchUrls.map((u, i) => (
                            <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border/30">
                              <img src={u} alt="" className="w-full h-full object-cover" />
                              {batchResults[i] && (
                                <div className="absolute inset-0 bg-emerald-500/30 flex items-center justify-center">
                                  <Check size={12} className="text-white" />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Progress */}
                    {isProcessingBatch && batchProgress.total > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-medium text-muted-foreground/70">Processing</span>
                          <span className="text-[10px] font-semibold text-primary">{batchProgress.current} / {batchProgress.total}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-300"
                            style={{ width: `${batchProgress.total > 0 ? (batchProgress.current / batchProgress.total) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Run button */}
                    {batchUrls.length > 0 && (
                      <button
                        onClick={processBatch}
                        disabled={isLoading || isProcessingBatch || (!prompt.trim() && !referenceUrl)}
                        className="w-full py-3 rounded-xl bg-primary text-white text-[11px] font-semibold hover:shadow-lg hover:shadow-primary/25 transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
                      >
                        {isProcessingBatch ? <Loader2 size={13} className="animate-spin" /> : <Layers size={13} />}
                        Run Batch ({batchUrls.length})
                      </button>
                    )}

                    {/* Results */}
                    {batchResults.length > 0 && (
                      <div>
                        <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60 block mb-2">Results</span>
                        <div className="space-y-2">
                          {batchResults.map((result, i) => (
                            <div key={i} className="flex gap-2 rounded-xl border border-border/20 overflow-hidden bg-background/30">
                              <img src={result.original} alt="before" className="w-16 h-16 object-cover" />
                              <div className="flex items-center">
                                <ArrowRight size={12} className="text-muted-foreground/40" />
                              </div>
                              <img src={result.edited} alt="after" className="w-16 h-16 object-cover flex-1" />
                              <button
                                onClick={() => onApplyResult?.(result.edited)}
                                className="px-2 text-[9px] text-primary font-semibold hover:bg-primary/5 transition-colors"
                              >
                                Use
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </div>

          {/* ── ZONE 3: CANVAS ── */}
          <div className="flex-1 flex flex-col p-2 sm:p-4 gap-2 sm:gap-3 bg-background/10 overflow-hidden min-w-0 min-h-0">

            {/* Canvas container */}
            <div
              ref={compareContainerRef}
              className="flex-1 relative rounded-2xl overflow-hidden bg-black/60 border border-white/5 flex items-center justify-center shadow-[inset_0_0_60px_rgba(0,0,0,0.3)]"
            >
              {/* ── COMPARE: SIDE BY SIDE ── */}
              {isComparing && compareMode === 'side-by-side' ? (
                <div className="w-full h-full flex">
                  {/* Before pane */}
                  <div className="flex-1 relative overflow-hidden border-r border-white/20">
                    <img
                      src={url}
                      alt="Original"
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-black/60 text-[9px] font-semibold text-white/80 tracking-wide uppercase">Before</div>
                  </div>
                  {/* After pane */}
                  <div className="flex-1 relative overflow-hidden">
                    <img
                      src={currentUrl}
                      alt="Edited"
                      style={{ filter: getFilterString() }}
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-primary/70 text-[9px] font-semibold text-white tracking-wide uppercase">After</div>
                  </div>
                </div>
              ) : isComparing && compareMode === 'toggle' ? (
                /* ── COMPARE: TOGGLE ── */
                <AnimatePresence mode="wait">
                  <motion.div
                    key={showOriginal ? 'original' : 'edited'}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="w-full h-full flex items-center justify-center"
                  >
                    <img
                      src={showOriginal ? url : currentUrl}
                      alt={showOriginal ? 'Original' : 'Edited'}
                      style={{ filter: showOriginal ? 'none' : getFilterString() }}
                      className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg"
                    />
                    <div className={cn(
                      "absolute top-3 left-3 px-2 py-0.5 rounded-md text-[9px] font-semibold text-white tracking-wide uppercase",
                      showOriginal ? "bg-black/60" : "bg-primary/70"
                    )}>
                      {showOriginal ? 'Before' : 'After'}
                    </div>
                  </motion.div>
                </AnimatePresence>
              ) : isComparing && compareMode === 'slider' ? (
                /* ── COMPARE: DRAG SLIDER (clip-path) ── */
                <div
                  className="w-full h-full relative select-none overflow-hidden"
                  style={{ cursor: isDraggingSlider ? 'ew-resize' : 'default' }}
                  onMouseMove={(e) => {
                    if (!isDraggingSlider || !compareContainerRef.current) return
                    const rect = compareContainerRef.current.getBoundingClientRect()
                    setSliderPos(Math.max(2, Math.min(98, ((e.clientX - rect.left) / rect.width) * 100)))
                    setHintVisible(false)
                  }}
                  onMouseUp={stopSliderDrag}
                  onMouseLeave={stopSliderDrag}
                >
                  {/* AFTER — full, sits behind */}
                  <img
                    src={currentUrl}
                    alt="After"
                    style={{ filter: getFilterString() }}
                    className="absolute inset-0 w-full h-full object-contain"
                    draggable={false}
                  />

                  {/* BEFORE — same layout, clipped to left by clip-path */}
                  <img
                    src={url}
                    alt="Before"
                    className="absolute inset-0 w-full h-full object-contain"
                    style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
                    draggable={false}
                  />

                  {/* BEFORE label */}
                  <div
                    className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm text-[10px] font-medium text-white/90 z-10 pointer-events-none transition-opacity duration-200"
                    style={{ opacity: sliderPos > 10 ? 1 : 0 }}
                  >Before</div>

                  {/* AFTER label */}
                  <div
                    className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm text-[10px] font-medium text-white/90 z-10 pointer-events-none transition-opacity duration-200"
                    style={{ opacity: sliderPos < 90 ? 1 : 0 }}
                  >After</div>

                  {/* Divider + handle */}
                  <div
                    className="absolute top-0 bottom-0 z-20 flex items-center justify-center"
                    style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)', width: 48 }}
                    onMouseDown={(e) => { e.preventDefault(); setIsDraggingSlider(true); setHintVisible(false) }}
                    onTouchStart={(e) => { e.stopPropagation(); setIsDraggingSlider(true); setHintVisible(false) }}
                    onTouchMove={(e) => {
                      if (!compareContainerRef.current) return
                      const rect = compareContainerRef.current.getBoundingClientRect()
                      setSliderPos(Math.max(2, Math.min(98, ((e.touches[0].clientX - rect.left) / rect.width) * 100)))
                      setHintVisible(false)
                    }}
                    onTouchEnd={stopSliderDrag}
                  >
                    {/* Line */}
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-white/90 pointer-events-none"
                      style={{ boxShadow: '0 0 6px rgba(255,255,255,0.6)' }} />

                    {/* Knob */}
                    <div
                      className={cn(
                        "relative z-10 flex items-center justify-center w-10 h-10 rounded-full bg-white cursor-ew-resize transition-transform duration-150 ease-out",
                        isDraggingSlider ? "scale-110" : "hover:scale-110"
                      )}
                      style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.35), 0 0 0 1.5px rgba(255,255,255,0.25)' }}
                    >
                      <ChevronLeft size={11} className="text-gray-400 -mr-[1px]" strokeWidth={2.5} />
                      <ChevronRight size={11} className="text-gray-400 -ml-[1px]" strokeWidth={2.5} />
                    </div>
                  </div>

                  {/* Drag hint */}
                  <AnimatePresence>
                    {hintVisible && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        transition={{ duration: 0.2 }}
                        className="absolute bottom-5 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-black/70 backdrop-blur-sm text-white text-[10px] font-medium pointer-events-none flex items-center gap-2 z-30"
                      >
                        <ChevronLeft size={10} strokeWidth={2.5} />
                        Drag to compare
                        <ChevronRight size={10} strokeWidth={2.5} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

              ) : (
                /* ── NORMAL VIEW (no compare) ── */
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentUrl}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.02 }}
                    transition={{ duration: 0.25 }}
                    className="w-full h-full flex items-center justify-center relative"
                  >
                    <img
                      src={currentUrl}
                      alt="Result"
                      style={{ filter: getFilterString() }}
                      className="max-w-full max-h-full w-auto h-auto object-contain transition-all duration-300 rounded-lg"
                    />

                    {/* Drawing Canvas overlay */}
                    {activeTab === 'brush' && (
                      <div className="absolute inset-0 pointer-events-none">
                        <canvas
                          ref={canvasRef}
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseLeave={(e) => { stopDrawing(e); setIsHoveringCanvas(false) }}
                          onMouseEnter={() => setIsHoveringCanvas(true)}
                          onTouchStart={startDrawing}
                          onTouchMove={draw}
                          onTouchEnd={stopDrawing}
                          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                          className="pointer-events-auto cursor-crosshair"
                        />

                        {/* Brush cursor preview */}
                        {isHoveringCanvas && (
                          <div
                            className="absolute pointer-events-none border-2 border-primary/60 rounded-full bg-primary/10"
                            style={{
                              width: brushSize,
                              height: brushSize,
                              left: mousePos.x,
                              top: mousePos.y,
                              transform: 'translate(-50%, -50%)',
                              zIndex: 30
                            }}
                          />
                        )}

                        {/* Remote cursors */}
                        {Object.entries(remoteBrushPos).map(([uid, pos]) => {
                          const remoteUser = onlineUsers.find(u => u.userId === uid)
                          if (!remoteUser) return null
                          const displayName = remoteUser.metadata?.displayName || 'Editor'
                          return (
                            <div
                              key={uid}
                              className="absolute pointer-events-none z-50 flex flex-col items-center transition-all duration-75 ease-linear"
                              style={{ left: pos.x, top: pos.y, transform: 'translate(-50%,-50%)' }}
                            >
                              <div
                                className="w-3 h-3 rounded-full border border-white/80 shadow-lg shadow-black/30"
                                style={{ backgroundColor: pos.color }}
                              />
                              <div
                                className="mt-1 px-1.5 py-0.5 rounded text-[8px] font-medium text-white shadow-lg whitespace-nowrap"
                                style={{ backgroundColor: pos.color }}
                              >
                                {displayName}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}

              {/* Hidden mask canvas — dimensions set by syncCanvasSize */}
              <canvas ref={maskCanvasRef} className="hidden" />

              {/* Compare button cluster (top-left) — only show when there are 2+ versions */}
              {history.length > 1 && (
                <div className="absolute top-4 left-4 z-30 flex items-center gap-1.5">
                  {/* Main toggle */}
                  <button
                    onClick={() => {
                      setIsComparing(!isComparing)
                      if (!isComparing) setSliderPos(50)
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-full glass border text-[10px] font-medium transition-all active:scale-95 shadow-lg",
                      isComparing
                        ? "bg-white/25 border-white/40 text-white"
                        : "border-white/10 text-white/80 hover:bg-white/10"
                    )}
                  >
                    <SplitSquareHorizontal size={12} />
                    <span className="hidden sm:inline">{isComparing ? 'Comparing' : 'Compare'}</span>
                  </button>

                  {/* Sub-mode picker — only when comparing */}
                  {isComparing && (
                    <motion.div
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-1 bg-black/50 backdrop-blur-sm border border-white/15 rounded-full px-1.5 py-1"
                    >
                      {([
                        { id: 'slider', icon: <SplitSquareHorizontal size={11} />, title: 'Drag Slider' },
                        { id: 'side-by-side', icon: <ChevronRight size={11} />, title: 'Side by Side' },
                        { id: 'toggle', icon: <Eye size={11} />, title: 'Toggle' },
                      ] as const).map((mode) => (
                        <button
                          key={mode.id}
                          title={mode.title}
                          onClick={() => setCompareMode(mode.id)}
                          className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center transition-all text-white",
                            compareMode === mode.id ? "bg-white/30" : "opacity-50 hover:opacity-80"
                          )}
                        >
                          {mode.icon}
                        </button>
                      ))}
                    </motion.div>
                  )}

                  {/* Toggle button for toggle mode */}
                  {isComparing && compareMode === 'toggle' && (
                    <button
                      onMouseDown={() => setShowOriginal(true)}
                      onMouseUp={() => setShowOriginal(false)}
                      onMouseLeave={() => setShowOriginal(false)}
                      onTouchStart={() => setShowOriginal(true)}
                      onTouchEnd={() => setShowOriginal(false)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 border border-white/30 text-white text-[10px] font-medium transition-all active:scale-95 hover:bg-white/30"
                    >
                      <Eye size={11} />
                      Hold: Before
                    </button>
                  )}
                </div>
              )}

              {/* Collab error toast (bottom-left, non-blocking) */}
              <AnimatePresence>
                {collabError && (
                  <motion.div
                    initial={{ opacity: 0, y: 12, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.96 }}
                    transition={{ duration: 0.2 }}
                    className="absolute bottom-6 left-4 z-30 max-w-[280px] bg-background/95 backdrop-blur-md border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden"
                  >
                    <div className="flex items-start gap-2.5 px-3.5 py-3">
                      <WifiOff size={13} className="text-amber-500 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-semibold text-foreground/90 mb-0.5">Collaboration Unavailable</p>
                        <p className="text-[9px] leading-relaxed text-muted-foreground">{collabError}</p>
                        <button
                          onClick={() => {
                            setCollabError(null)
                            setCollabEnabled(true)
                          }}
                          className="mt-1.5 flex items-center gap-1 text-[9px] font-semibold text-amber-600  hover:underline"
                        >
                          <RefreshCw size={9} />
                          Retry connection
                        </button>
                      </div>
                      <button
                        onClick={() => setCollabError(null)}
                        className="shrink-0 text-muted-foreground/40 hover:text-foreground/60 transition-colors"
                        aria-label="Dismiss"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Version badge (bottom-right) */}
              {history.length > 1 && (
                <div className="absolute bottom-4 right-4 flex items-center gap-1.5 glass border border-white/10 px-3 py-1.5 rounded-full shadow-lg">
                  <History size={11} className="text-white/50" />
                  <span className="text-[10px] font-semibold text-white/80">V{historyIndex + 1} / {history.length}</span>
                </div>
              )}

              {/* AI loading indicator (center-bottom) */}
              <AnimatePresence>
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 12 }}
                    className="absolute bottom-6 left-1/2 -translate-x-1/2 glass border border-white/10 px-5 py-3 rounded-2xl flex items-center gap-3 z-20 shadow-2xl shadow-primary/20 min-w-[220px]"
                  >
                    <div className="relative shrink-0">
                      <Loader2 size={20} className="animate-spin text-primary" />
                      <Wand2 size={9} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white" />
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-white">AI Processing</div>
                      <div className="text-[10px] text-primary/70 animate-pulse">{LOADING_MESSAGES[loadingMsgIndex]}</div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ── ZONE 4: ADJUSTMENT PANEL ── */}
          <div className="w-[260px] shrink-0 border-l border-border/20 flex flex-col bg-background/20 backdrop-blur-sm overflow-hidden">
            <div className="h-10 flex items-center px-4 border-b border-border/20 shrink-0">
              <span className="text-xs font-semibold text-foreground/80">Properties</span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">

              {/* Card: Pro Adjustments */}
              <AdjustmentCard title="Pro Adjustments" icon={<Sliders size={13} className="text-primary/60" />} defaultOpen>
                <div className="space-y-3">
                  {[
                    { label: 'Brightness', value: adjustments.brightness, key: 'brightness', min: 0, max: 200, unit: '%' },
                    { label: 'Contrast', value: adjustments.contrast, key: 'contrast', min: 0, max: 200, unit: '%' },
                    { label: 'Saturation', value: adjustments.saturation, key: 'saturation', min: 0, max: 200, unit: '%' },
                    { label: 'Hue', value: adjustments.hue, key: 'hue', min: -180, max: 180, unit: '°' },
                    { label: 'Blur', value: adjustments.blur, key: 'blur', min: 0, max: 10, unit: 'px' },
                  ].map((adj) => (
                    <div key={adj.label} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide">{adj.label}</span>
                        <span className="text-[10px] font-semibold text-primary tabular-nums">{adj.value}{adj.unit}</span>
                      </div>
                      <input
                        type="range" min={adj.min} max={adj.max} value={adj.value}
                        onChange={(e) => setAdjustments(prev => ({ ...prev, [adj.key]: parseInt(e.target.value) }))}
                        style={rangeProgress(adj.value, adj.min, adj.max)}
                        className="w-full studio-slider"
                      />
                    </div>
                  ))}
                </div>
              </AdjustmentCard>

              {/* Card: AI Enhance */}
              <AdjustmentCard title="AI Enhance" icon={<Zap size={13} className="text-amber-500/70" />}>
                <div className="grid grid-cols-2 gap-1.5">
                  {ENHANCE_EDITS.map((edit) => (
                    <button
                      key={edit.label}
                      onClick={() => { setSelectedEffect(edit.label); handleEdit(edit.prompt) }}
                      disabled={isLoading}
                      className={cn(
                        "flex items-center gap-1.5 p-2 rounded-lg border text-[10px] font-medium transition-all active:scale-95 disabled:opacity-40",
                        selectedEffect === edit.label
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/30 bg-muted/30 text-foreground/60 hover:border-primary/25"
                      )}
                    >
                      <span className="text-primary/50 shrink-0">{edit.icon}</span>
                      {edit.label}
                    </button>
                  ))}
                </div>
              </AdjustmentCard>

              {/* Card: Style Transfer Controls (visible when transfer tab or referenceUrl set) */}
              {(activeTab === 'transfer' && referenceUrl) && (
                <AdjustmentCard title="Transfer Controls" icon={<Sparkles size={13} className="text-primary/60" />} defaultOpen>
                  <div className="space-y-3">
                    {[
                      { label: 'Style Influence', value: styleIntensity, setter: setStyleIntensity },
                      { label: 'Content Lock', value: contentPreservation, setter: setContentPreservation },
                      { label: 'Color Retention', value: colorPreservation, setter: setColorPreservation },
                      { label: 'Texture Detail', value: textureDetail, setter: setTextureDetail },
                    ].map((ctrl) => (
                      <div key={ctrl.label} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide">{ctrl.label}</span>
                          <span className="text-[10px] font-semibold text-primary tabular-nums">{ctrl.value}%</span>
                        </div>
                        <input
                          type="range" min="0" max="100" value={ctrl.value}
                          onChange={(e) => ctrl.setter(parseInt(e.target.value))}
                          style={rangeProgress(ctrl.value, 0, 100)}
                          className="w-full studio-slider"
                        />
                      </div>
                    ))}
                  </div>
                </AdjustmentCard>
              )}

              {/* Card: Algorithm */}
              <AdjustmentCard title="Algorithm" icon={<Settings2 size={13} className="text-primary/60" />}>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'neural', label: 'Neural' },
                    { id: 'cyclegan', label: 'CycleGAN' },
                    { id: 'wgan', label: 'WGAN' },
                  ].map((method) => (
                    <button
                      key={method.id}
                      onClick={() => setTransferMethod(method.id as any)}
                      className={cn(
                        "py-1.5 px-1 rounded-lg border text-[9px] font-medium transition-all active:scale-95 text-center",
                        transferMethod === method.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/30 bg-muted/30 text-foreground/60 hover:border-primary/25"
                      )}
                    >
                      {method.label}
                    </button>
                  ))}
                </div>
              </AdjustmentCard>

              {/* Card: Quality */}
              <AdjustmentCard title="Rendering Quality" icon={<Sparkles size={13} className="text-primary/60" />}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-medium">Pro Rendering</div>
                    <div className="text-[9px] text-muted-foreground/60 mt-0.5">Higher quality, slower</div>
                  </div>
                  <button
                    onClick={() => setIsHighQuality(!isHighQuality)}
                    className={cn(
                      "relative w-9 h-5 rounded-full border transition-all duration-200",
                      isHighQuality
                        ? "bg-primary border-primary"
                        : "bg-muted/50 border-border/40"
                    )}
                  >
                    <div className={cn(
                      "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200",
                      isHighQuality ? "left-[18px]" : "left-0.5"
                    )} />
                  </button>
                </div>
              </AdjustmentCard>

            </div>
          </div>

        </div>

        {/* ══════════════════════════════════════════════════════════
            FOOTER BAR
        ══════════════════════════════════════════════════════════ */}
        <div className="min-h-[52px] flex flex-wrap items-center justify-between px-3 sm:px-5 py-2 sm:py-0 sm:h-[52px] border-t border-border/20 bg-background/50 backdrop-blur-sm shrink-0 gap-2 sm:gap-4">

          {/* Left: reset */}
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground/50 hover:text-foreground transition-colors group shrink-0"
          >
            <RotateCcw size={11} className="group-hover:-rotate-90 transition-transform duration-300" />
            Reset
          </button>

          {/* Center: custom prompt + AI Suggest */}
          <div className="flex-1 min-w-[140px] max-w-sm relative flex items-center gap-2">
            <div className="relative flex-1">
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEdit(prompt)}
                placeholder="Describe your edit…"
                className="w-full text-[12px] pl-3 pr-8 py-1.5 rounded-xl border border-border/30 bg-background/60 focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 transition-all placeholder:text-muted-foreground/40"
              />
              <Wand2 size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/30" />
            </div>

            {/* ✨ AI Suggest button + popover */}
            <div className="relative shrink-0">
              <button
                onClick={fetchSuggestions}
                disabled={loadingSuggestions}
                title="AI Edit Suggestions"
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition-all duration-150 active:scale-95',
                  showSuggestions
                    ? 'bg-primary text-white border-primary shadow-sm shadow-primary/30'
                    : 'bg-background/80 border-border/30 text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5'
                )}
              >
                {loadingSuggestions
                  ? <Loader2 size={11} className="animate-spin" />
                  : <Sparkles size={11} />
                }
                <span className="hidden sm:inline">Suggest</span>
              </button>

              <AnimatePresence>
                {showSuggestions && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowSuggestions(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.96 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute bottom-full right-0 mb-2 w-72 bg-popover border border-border/40 rounded-2xl shadow-xl z-40 overflow-hidden"
                    >
                      <div className="flex items-center justify-between px-3.5 pt-3 pb-2 border-b border-border/20">
                        <div className="flex items-center gap-1.5">
                          <Sparkles size={12} className="text-primary" />
                          <span className="text-[11px] font-semibold text-foreground/80">AI Edit Suggestions</span>
                        </div>
                        <button
                          onClick={() => setShowSuggestions(false)}
                          className="text-muted-foreground/50 hover:text-foreground transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>

                      <div className="p-2 space-y-1">
                        {loadingSuggestions ? (
                          <div className="flex flex-col items-center justify-center py-5 gap-2">
                            <Loader2 size={18} className="animate-spin text-primary/60" />
                            <span className="text-[11px] text-muted-foreground/60">Analyzing image…</span>
                          </div>
                        ) : suggestions.length > 0 ? (
                          suggestions.map((s, i) => (
                            <motion.button
                              key={i}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                              onClick={() => {
                                setPrompt(s)
                                setShowSuggestions(false)
                              }}
                              className="w-full text-left px-3 py-2 rounded-xl text-[11px] text-foreground/75 hover:bg-primary/8 hover:text-foreground transition-all group flex items-start gap-2"
                            >
                              <span className="shrink-0 w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center mt-0.5 group-hover:bg-primary group-hover:text-white transition-colors">
                                {i + 1}
                              </span>
                              <span className="leading-snug">{s}</span>
                            </motion.button>
                          ))
                        ) : (
                          <div className="text-center py-4 text-[11px] text-muted-foreground/50">
                            No suggestions yet
                          </div>
                        )}
                      </div>

                      {!loadingSuggestions && suggestions.length > 0 && (
                        <div className="px-3 pb-3 pt-1">
                          <button
                            onClick={fetchSuggestions}
                            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[10px] font-medium text-muted-foreground/60 hover:text-primary hover:bg-primary/5 border border-border/20 hover:border-primary/30 transition-all"
                          >
                            <RefreshCw size={10} />
                            Regenerate suggestions
                          </button>
                        </div>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onApplyResult?.(currentUrl)}
              className="px-4 py-1.5 rounded-xl border border-border/30 bg-background/60 text-[11px] font-medium text-foreground/70 hover:bg-muted/40 hover:border-border/60 transition-all active:scale-95 duration-150"
            >
              Export
            </button>
            <button
              onClick={() => handleEdit(prompt)}
              disabled={isLoading}
              className="relative overflow-hidden px-5 py-2 rounded-xl bg-primary text-white text-[11px] font-semibold hover:shadow-lg hover:shadow-primary/30 transition-all active:scale-95 duration-150 disabled:opacity-40 flex items-center gap-2 group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
              {isLoading
                ? <Loader2 size={13} className="animate-spin" />
                : <Zap size={13} />
              }
              Bake Image
            </button>
          </div>
        </div>

      </motion.div>
    </motion.div>
  )
}

// ─── ADJUSTMENT CARD COMPONENT ────────────────────────────────────────────────
function AdjustmentCard({
  title,
  icon,
  children,
  defaultOpen = false,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-xl border border-border/20 bg-background/40 overflow-hidden mb-1">
      <button
        onClick={() => setOpen(!open)}
        className="w-full h-10 flex items-center justify-between px-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-[11px] font-medium text-foreground/80">{title}</span>
        </div>
        <ChevronDown
          size={13}
          className={cn("text-muted-foreground/50 transition-transform duration-200", open && "rotate-180")}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
