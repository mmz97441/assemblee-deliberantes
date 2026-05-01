'use client'

import { useState, useEffect, forwardRef } from 'react'
import { parsePhoneNumberFromString, AsYouType, type CountryCode } from 'libphonenumber-js'
import { Phone, CheckCircle2, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * Champ de saisie de numéro de téléphone avec :
 * - Indicatif par défaut configurable (par défaut +262 = Réunion / Mayotte).
 * - Formatage automatique pendant la saisie (AsYouType de libphonenumber-js).
 * - Validation au blur selon l'indicatif détecté.
 * - Indicateur visuel de validité (vert / rouge / neutre).
 *
 * Le composant accepte n'importe quelle valeur initiale et tente de la
 * formater. Si l'utilisateur tape un numéro sans indicatif, on préfixe
 * automatiquement avec defaultCountry.
 */

interface PhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'value'> {
  value: string
  onChange: (value: string) => void
  defaultCountry?: CountryCode
}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  function PhoneInput(
    { value, onChange, defaultCountry = 'RE', className, ...props },
    ref
  ) {
    const [touched, setTouched] = useState(false)
    const [displayValue, setDisplayValue] = useState(value || '')

    // Synchroniser avec value externe quand elle change (ex: hydration)
    useEffect(() => {
      if (value !== displayValue) {
        setDisplayValue(value || '')
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value])

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      let raw = e.target.value
      // Si l'utilisateur tape sans + et sans 0, on préfixe automatiquement
      // avec l'indicatif du pays par défaut. Évite à l'utilisateur de taper
      // le + à chaque fois.
      if (raw && !raw.startsWith('+') && !raw.startsWith('00') && /^\d/.test(raw)) {
        // On ne préfixe que si la 1ère saisie : si l'utilisateur efface puis
        // recommence, on lui laisse la main.
        if (!displayValue.startsWith('+')) {
          const formatter = new AsYouType(defaultCountry)
          formatter.input(raw)
          const intl = formatter.getNumber()?.formatInternational() || ''
          if (intl) {
            raw = intl
          }
        }
      }
      // Formatage progressif AsYouType pour une UX naturelle
      const formatter = new AsYouType(defaultCountry)
      const formatted = formatter.input(raw)
      setDisplayValue(formatted)
      onChange(formatted)
    }

    // Évalue la validité quand le champ a été touché (= utilisateur a quitté le champ)
    const validity = touched ? checkValidity(displayValue, defaultCountry) : 'pristine'

    return (
      <div className="relative w-full">
        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={ref}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={displayValue}
          onChange={handleChange}
          onBlur={() => setTouched(true)}
          className={cn(
            'pl-10 pr-10',
            validity === 'valid' && 'border-emerald-500 focus-visible:ring-emerald-500',
            validity === 'invalid' && 'border-amber-500 focus-visible:ring-amber-500',
            className
          )}
          placeholder="+262 6 92 12 34 56"
          {...props}
        />
        {validity === 'valid' && (
          <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
        )}
        {validity === 'invalid' && (
          <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-600" />
        )}
      </div>
    )
  }
)

function checkValidity(value: string, defaultCountry: CountryCode): 'pristine' | 'valid' | 'invalid' {
  if (!value || value.trim().length < 4) return 'pristine'
  try {
    const phone = parsePhoneNumberFromString(value, defaultCountry)
    if (phone && phone.isValid()) return 'valid'
    return 'invalid'
  } catch {
    return 'invalid'
  }
}
