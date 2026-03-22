'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Eraser, Check } from 'lucide-react'

interface SignaturePadProps {
  onConfirm: (signatureSvg: string) => void
  onCancel: () => void
  memberName: string
  isPending?: boolean
  width?: number
  height?: number
}

export function SignaturePad({
  onConfirm,
  onCancel,
  memberName,
  isPending = false,
  width = 400,
  height = 200,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [paths, setPaths] = useState<string[]>([])
  const currentPath = useRef<string[]>([])

  // Setup canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // High DPI support
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.scale(dpr, dpr)

    // Draw background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    // Signature line
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(20, height - 40)
    ctx.lineTo(width - 20, height - 40)
    ctx.stroke()

    // Label
    ctx.fillStyle = '#94a3b8'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Signez ici', width / 2, height - 20)
  }, [width, height])

  const getPosition = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()

    if ('touches' in e) {
      const touch = e.touches[0]
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      }
    }
    return {
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top,
    }
  }, [])

  const startDrawing = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return

    setIsDrawing(true)
    setHasDrawn(true)

    const pos = getPosition(e)
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)

    currentPath.current = [`M ${pos.x} ${pos.y}`]
  }, [getPosition])

  const draw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    if (!isDrawing) return

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return

    const pos = getPosition(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()

    currentPath.current.push(`L ${pos.x} ${pos.y}`)
  }, [isDrawing, getPosition])

  const stopDrawing = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    if (!isDrawing) return
    setIsDrawing(false)

    if (currentPath.current.length > 1) {
      setPaths(prev => [...prev, currentPath.current.join(' ')])
    }
    currentPath.current = []
  }, [isDrawing])

  function clearCanvas() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return

    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.scale(dpr, dpr)

    // Redraw background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(20, height - 40)
    ctx.lineTo(width - 20, height - 40)
    ctx.stroke()
    ctx.fillStyle = '#94a3b8'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Signez ici', width / 2, height - 20)

    setHasDrawn(false)
    setPaths([])
  }

  function handleConfirm() {
    // Generate SVG from paths
    const svgPaths = paths
      .map(d => `<path d="${d}" stroke="#1e293b" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`)
      .join('\n  ')

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  ${svgPaths}
</svg>`

    onConfirm(svg)
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-lg font-semibold text-center">
        Signature de <span className="text-institutional-blue">{memberName}</span>
      </p>

      <div className="rounded-xl border-2 border-dashed border-slate-300 overflow-hidden bg-white shadow-sm">
        <canvas
          ref={canvasRef}
          style={{ width, height, touchAction: 'none' }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>

      <div className="flex items-center gap-3 w-full" style={{ maxWidth: width }}>
        <Button
          variant="outline"
          size="lg"
          onClick={clearCanvas}
          disabled={!hasDrawn || isPending}
          className="flex-1 h-14 text-base gap-2"
        >
          <Eraser className="h-5 w-5" />
          Effacer
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={onCancel}
          disabled={isPending}
          className="flex-1 h-14 text-base"
        >
          Annuler
        </Button>
        <Button
          size="lg"
          onClick={handleConfirm}
          disabled={!hasDrawn || isPending}
          className="flex-[2] h-14 text-base gap-2 bg-emerald-600 hover:bg-emerald-700"
        >
          <Check className="h-5 w-5" />
          Confirmer
        </Button>
      </div>
    </div>
  )
}
