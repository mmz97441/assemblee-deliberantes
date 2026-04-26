import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { checkApiRateLimit, API_RATE_LIMITS } from '@/lib/security/api-rate-limiter'

/**
 * GET /api/qr?data=xxx
 * Generates a QR code PNG image from the given data string.
 * Used in convocation emails and the emargement tablet view.
 */
export async function GET(request: NextRequest) {
  // Rate limiting par IP — max 30 par minute (route publique)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
  if (!checkApiRateLimit(`qr_${ip}`, API_RATE_LIMITS.QR.maxRequests, API_RATE_LIMITS.QR.windowMs)) {
    return NextResponse.json(
      { error: 'Trop de demandes. Veuillez patienter quelques instants.' },
      { status: 429 }
    )
  }

  const data = request.nextUrl.searchParams.get('data')

  if (!data) {
    return NextResponse.json({ error: 'Missing data parameter' }, { status: 400 })
  }

  // Input length check — QR data should be a UUID (36 chars) or similar token
  if (data.length > 500) {
    return NextResponse.json({ error: 'Data parameter too long' }, { status: 400 })
  }

  try {
    const buffer = await QRCode.toBuffer(data, {
      type: 'png',
      width: 300,
      margin: 2,
      color: {
        dark: '#1e293b',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400', // 24h cache
      },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to generate QR code' }, { status: 500 })
  }
}
