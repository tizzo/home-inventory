import { describe, it, expect, vi } from 'vitest';
import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import { render } from '../../test/utils';
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
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    const showToastButton = screen.getByText('Show Toast');
    await user.click(showToastButton);

    await waitFor(
      () => {
        expect(screen.getByText('Test message')).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it('should show error toast', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    const showErrorButton = screen.getByText('Show Error');
    await user.click(showErrorButton);

    await waitFor(
      () => {
        expect(screen.getByText('Error message')).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it('should show success toast', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    const showSuccessButton = screen.getByText('Show Success');
    await user.click(showSuccessButton);

    await waitFor(
      () => {
        expect(screen.getByText('Success message')).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it('should show warning toast', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    const showWarningButton = screen.getByText('Show Warning');
    await user.click(showWarningButton);

    await waitFor(
      () => {
        expect(screen.getByText('Warning message')).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it('should show info toast', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    const showInfoButton = screen.getByText('Show Info');
    await user.click(showInfoButton);

    await waitFor(
      () => {
        expect(screen.getByText('Info message')).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it('should show multiple toasts', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    await user.click(screen.getByText('Show Error'));
    await user.click(screen.getByText('Show Success'));

    await waitFor(
      () => {
        expect(screen.getByText('Error message')).toBeInTheDocument();
        expect(screen.getByText('Success message')).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it('should remove toast when closed', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    await user.click(screen.getByText('Show Toast'));

    await waitFor(
      () => {
        expect(screen.getByText('Test message')).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    // Find and click the close button
    const closeButton = screen.getByLabelText('Close');
    await user.click(closeButton);

    await waitFor(
      () => {
        expect(screen.queryByText('Test message')).not.toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });
});
