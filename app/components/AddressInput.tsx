"use client";
import { useEffect, useRef } from "react";
import { loadGoogleMaps } from "@/lib/googleMaps";

// A plain address text input that progressively enhances into a Google Places
// autocomplete field (live suggestions as you type) once the Maps script is
// loaded. Falls back to a normal text input if no API key is configured.
export default function AddressInput({
  value,
  onChange,
  placeholder,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || !inputRef.current) return;

    let cancelled = false;
    loadGoogleMaps(apiKey).then(() => {
      if (cancelled || !inputRef.current || !window.google?.maps?.places) return;
      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ["address"],
        fields: ["formatted_address"],
      });
      autocompleteRef.current = autocomplete;
      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (place?.formatted_address) onChangeRef.current(place.formatted_address);
      });
    });

    return () => {
      cancelled = true;
      if (autocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      autoComplete="off"
    />
  );
}
