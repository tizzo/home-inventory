import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import { render, screen as testScreen, waitFor as testWaitFor } from '../../test/utils';
import userEvent from '@testing-library/user-event';
import { useToast } from '../ToastContext';
import { ToastProvider } from '../ToastContext';

// Test component that uses the toast context
const TestComponent = () => {
  const toast = useToast();

  return (
    <div>
      <button onClick={() => toast.showToast('Test message', 'info')}>
        Show Toast
      </button>
      <button onClick={() => toast.showError('Error message')}>
        Show Error
      </button>
      <button onClick={() => toast.showSuccess('Success message')}>
        Show Success
      </button>
      <button onClick={() => toast.showWarning('Warning message')}>
        Show Warning
      </button>
      <button onClick={() => toast.showInfo('Info message')}>
        Show Info
      </button>
    </div>
  );
};

describe('ToastContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
  });

  it('should throw error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Create a component that uses the hook without provider
    const TestComponentWithoutProvider = () => {
      useToast();
      return <div>Test</div>;
    };

    expect(() => {
      rtlRender(<TestComponentWithoutProvider />);
    }).toThrow('useToast must be used within a ToastProvider');

    consoleSpy.mockRestore();
  });

  it('should show toast message', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    const showToastButton = testScreen.getByText('Show Toast');
    await user.click(showToastButton);

    await testWaitFor(
      () => {
        expect(testScreen.getByText('Test message')).toBeInTheDocument();
      },
      { timeout: 1000 }
    );
  });

  it('should show error toast', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    const showErrorButton = testScreen.getByText('Show Error');
    await user.click(showErrorButton);

    await testWaitFor(
      () => {
        expect(testScreen.getByText('Error message')).toBeInTheDocument();
      },
      { timeout: 1000 }
    );
  });

  it('should show success toast', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    const showSuccessButton = testScreen.getByText('Show Success');
    await user.click(showSuccessButton);

    await testWaitFor(
      () => {
        expect(testScreen.getByText('Success message')).toBeInTheDocument();
      },
      { timeout: 1000 }
    );
  });

  it('should show warning toast', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    const showWarningButton = testScreen.getByText('Show Warning');
    await user.click(showWarningButton);

    await testWaitFor(
      () => {
        expect(testScreen.getByText('Warning message')).toBeInTheDocument();
      },
      { timeout: 1000 }
    );
  });

  it('should show info toast', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    const showInfoButton = testScreen.getByText('Show Info');
    await user.click(showInfoButton);

    await testWaitFor(
      () => {
        expect(testScreen.getByText('Info message')).toBeInTheDocument();
      },
      { timeout: 1000 }
    );
  });

  it('should show multiple toasts', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    await user.click(testScreen.getByText('Show Error'));
    await user.click(testScreen.getByText('Show Success'));

    await testWaitFor(
      () => {
        expect(testScreen.getByText('Error message')).toBeInTheDocument();
        expect(testScreen.getByText('Success message')).toBeInTheDocument();
      },
      { timeout: 1000 }
    );
  });

  it('should remove toast when closed', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    await user.click(testScreen.getByText('Show Toast'));

    await testWaitFor(
      () => {
        expect(testScreen.getByText('Test message')).toBeInTheDocument();
      },
      { timeout: 1000 }
    );

    // Find and click the close button
    const closeButton = testScreen.getByLabelText('Close');
    await user.click(closeButton);

    await testWaitFor(
      () => {
        expect(testScreen.queryByText('Test message')).not.toBeInTheDocument();
      },
      { timeout: 1000 }
    );
  });
});
