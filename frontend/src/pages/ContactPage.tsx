import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { contactApi, itemsApi } from '../api';
import { useReCaptcha } from '../components';
import type { CreateContactSubmissionRequest } from '../types/generated';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';

export default function ContactPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const itemId = searchParams.get('item');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  // Fetch item details if item ID is provided
  const { data: publicItem } = useQuery({
    queryKey: ['items', itemId, 'public'],
    queryFn: () => itemsApi.getPublic(itemId!),
    enabled: !!itemId,
  });

  // Get reCAPTCHA token executor
  const executeRecaptcha = useReCaptcha(RECAPTCHA_SITE_KEY);

  // Prefill subject if item is provided
  useEffect(() => {
    if (publicItem && !formData.subject) {
      setFormData(prev => ({
        ...prev,
        subject: `Regarding: ${publicItem.name}`,
      }));
    }
  }, [publicItem, formData.subject]);

  // Mutation for submitting contact form
  const submitMutation = useMutation({
    mutationFn: async (data: CreateContactSubmissionRequest) => {
      return contactApi.create(data);
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (error) => {
      console.error('Failed to submit contact form:', error);
      alert('Failed to submit contact form. Please try again.');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      alert('Please fill in all required fields');
      return;
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      alert('Please enter a valid email address');
      return;
    }

    try {
      // Get reCAPTCHA token
      const recaptchaToken = await executeRecaptcha('contact_form');

      // Submit form
      await submitMutation.mutateAsync({
        name: formData.name,
        email: formData.email,
        subject: formData.subject,
        message: formData.message,
        item_id: itemId || undefined,
        recaptcha_token: recaptchaToken,
      });
    } catch (error) {
      console.error('reCAPTCHA error:', error);
      alert('Failed to verify reCAPTCHA. Please try again.');
    }
  };

  if (submitted) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="bg-white shadow-lg rounded-lg p-8 text-center">
          <div className="mb-6">
            <svg
              className="w-20 h-20 mx-auto text-green-600 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Message Sent!</h1>
            <p className="text-lg text-gray-600">
              Thank you for your message. The owner will be in touch shortly.
            </p>
          </div>

          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="bg-white shadow-lg rounded-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Contact Us</h1>

        {publicItem && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">Regarding:</span> {publicItem.name}
            </p>
            <p className="text-sm text-blue-800">
              <span className="font-semibold">Owner:</span> {publicItem.owner_display_name}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="subject"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-6">
            <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              required
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="text-sm text-gray-600 mb-4">
            This site is protected by reCAPTCHA and the Google{' '}
            <a href="https://policies.google.com/privacy" className="text-blue-600 hover:underline">
              Privacy Policy
            </a>{' '}
            and{' '}
            <a href="https://policies.google.com/terms" className="text-blue-600 hover:underline">
              Terms of Service
            </a>{' '}
            apply.
          </div>

          <button
            type="submit"
            disabled={submitMutation.isPending}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitMutation.isPending ? 'Sending...' : 'Send Message'}
          </button>
        </form>
      </div>
    </div>
  );
}
