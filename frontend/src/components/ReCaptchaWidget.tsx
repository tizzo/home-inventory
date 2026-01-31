import { useEffect, useState } from 'react';

declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

interface ReCaptchaWidgetProps {
  siteKey: string;
  action: string;
  onVerify: (token: string) => void;
  onError?: (error: Error) => void;
}

/**
 * ReCaptcha v3 Widget Component
 *
 * This component loads the Google reCAPTCHA v3 script and provides
 * an invisible captcha verification. No user interaction is required.
 *
 * Usage:
 * ```tsx
 * <ReCaptchaWidget
 *   siteKey="your-site-key"
 *   action="contact_form"
 *   onVerify={(token) => console.log('Token:', token)}
 * />
 * ```
 */
export default function ReCaptchaWidget({
  siteKey,
  action,
  onVerify,
  onError,
}: ReCaptchaWidgetProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if script is already loaded
    if (window.grecaptcha) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoaded(true);
      return;
    }

    // Load reCAPTCHA v3 script
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      setLoaded(true);
    };

    script.onerror = () => {
      const err = new Error('Failed to load reCAPTCHA script');
      setError(err.message);
      if (onError) {
        onError(err);
      }
    };

    document.head.appendChild(script);

    // Cleanup
    return () => {
      // Don't remove the script on unmount as other components might use it
      // document.head.removeChild(script);
    };
  }, [siteKey, onError]);

  useEffect(() => {
    if (!loaded || !window.grecaptcha) return;

    // Execute reCAPTCHA
    window.grecaptcha.ready(() => {
      window.grecaptcha
        .execute(siteKey, { action })
        .then((token) => {
          onVerify(token);
        })
        .catch((err) => {
          const error = err instanceof Error ? err : new Error(String(err));
          setError(error.message);
          if (onError) {
            onError(error);
          }
        });
    });
  }, [loaded, siteKey, action, onVerify, onError]);

  // This is an invisible component
  if (error) {
    return (
      <div className="text-sm text-red-600">
        reCAPTCHA error: {error}
      </div>
    );
  }

  return null;
}

/**
 * Hook to get reCAPTCHA token
 *
 * Usage:
 * ```tsx
 * const executeRecaptcha = useReCaptcha(siteKey);
 *
 * const token = await executeRecaptcha('contact_form');
 * ```
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useReCaptcha(siteKey: string) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (window.grecaptcha) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      setLoaded(true);
    };

    document.head.appendChild(script);
  }, [siteKey]);

  const execute = async (action: string): Promise<string> => {
    if (!loaded || !window.grecaptcha) {
      throw new Error('reCAPTCHA not loaded');
    }

    return new Promise((resolve, reject) => {
      window.grecaptcha.ready(() => {
        window.grecaptcha
          .execute(siteKey, { action })
          .then(resolve)
          .catch(reject);
      });
    });
  };

  return execute;
}
