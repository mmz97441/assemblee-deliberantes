import { Resend } from 'resend'

if (!process.env.RESEND_API_KEY) {
  console.warn('RESEND_API_KEY is not set — emails will not be sent')
}

export const resend = new Resend(process.env.RESEND_API_KEY || '')

// Default sender — must be a verified domain in Resend
// During development, use Resend's test address
export const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev'
export const FROM_NAME = process.env.NEXT_PUBLIC_INSTITUTION_NAME || 'Assemblees Deliberantes'
