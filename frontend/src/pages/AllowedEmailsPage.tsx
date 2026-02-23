import { useState } from 'react';
import { useAllowedEmails, useAddAllowedEmail, useRemoveAllowedEmail } from '../hooks/useAllowedEmails';
import { useToast } from '../context/ToastContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

export default function AllowedEmailsPage() {
  const { showSuccess, showError } = useToast();
  const { data: emails, isLoading, error } = useAllowedEmails();
  const addEmail = useAddAllowedEmail();
  const removeEmail = useRemoveAllowedEmail();
  const [newEmail, setNewEmail] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newEmail.trim();
    if (!trimmed) return;

    try {
      await addEmail.mutateAsync({ email: trimmed });
      setNewEmail('');
      showSuccess('Email added to allowlist');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        showError('This email is already in the allowlist');
      } else {
        showError('Failed to add email');
      }
    }
  };

  const handleRemove = async (id: string, email: string) => {
    if (!window.confirm(`Remove "${email}" from the allowlist? They will no longer be able to log in.`)) return;

    try {
      await removeEmail.mutateAsync(id);
      showSuccess('Email removed from allowlist');
    } catch {
      showError('Failed to remove email');
    }
  };

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
  if (error) return <div className="text-destructive">Error: {error.message}</div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Allowed Emails</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Only these email addresses can log in. If the list is empty, anyone with a Google account can log in.
          </p>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="p-6">
          <form onSubmit={handleAdd} className="flex gap-3 items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="add-email">Add Email</Label>
              <Input
                id="add-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="user@example.com"
                required
              />
            </div>
            <Button type="submit" disabled={addEmail.isPending}>
              {addEmail.isPending ? 'Adding...' : 'Add'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {!emails || emails.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No emails in allowlist. Anyone with a Google account can log in.
        </div>
      ) : (
        <Card>
          <CardContent className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 font-medium">Email</th>
                    <th className="text-left py-3 px-2 font-medium">Added</th>
                    <th className="text-left py-3 px-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {emails.map((ae) => (
                    <tr key={ae.id} className="border-b border-border hover:bg-muted/50">
                      <td className="py-3 px-2">{ae.email}</td>
                      <td className="py-3 px-2">{new Date(ae.created_at).toLocaleDateString()}</td>
                      <td className="py-3 px-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemove(ae.id, ae.email)}
                          disabled={removeEmail.isPending}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
