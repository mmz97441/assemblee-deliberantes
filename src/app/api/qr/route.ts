import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'

/**
 * GET /api/qr?data=xxx
 * Generates a QR code PNG image from the given data string.
 * Used in convocation emails and the emargement tablet view.
 */
export async function GET(request: NextRequest) {
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
