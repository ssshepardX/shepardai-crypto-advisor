import { useState } from 'react';
import AppShell from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { submitContactMessage } from '@/services/adminService';
import { Trans } from '@/contexts/LanguageContext';

const Contact = () => {
  const [form, setForm] = useState({ name: '', email: '', satisfaction: 'neutral', subject: '', message: '' });
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setStatus(null);
    try {
      await submitContactMessage({
        ...form,
        satisfaction: form.satisfaction as 'happy' | 'neutral' | 'unhappy',
      });
      setForm({ name: '', email: '', satisfaction: 'neutral', subject: '', message: '' });
      setStatus('Message sent.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Message failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell title="Contact" subtitle="Send feedback or support request.">
      <Card className="mx-auto max-w-2xl border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle><Trans text="Contact form" /></CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" className="border-slate-700 bg-slate-950" />
          <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="border-slate-700 bg-slate-950" />
          <Select value={form.satisfaction} onValueChange={(value) => setForm({ ...form, satisfaction: value })}>
            <SelectTrigger className="border-slate-700 bg-slate-950"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="happy">Happy</SelectItem>
              <SelectItem value="neutral">Neutral</SelectItem>
              <SelectItem value="unhappy">Unhappy</SelectItem>
            </SelectContent>
          </Select>
          <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Subject" className="border-slate-700 bg-slate-950" />
          <Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Message" className="min-h-36 border-slate-700 bg-slate-950" />
          {status && <div className="text-sm text-slate-300">{status}</div>}
          <Button onClick={submit} disabled={loading || !form.subject || !form.message} className="bg-cyan-500 hover:bg-cyan-600">
            <Trans text={loading ? 'Sending' : 'Send'} />
          </Button>
        </CardContent>
      </Card>
    </AppShell>
  );
};

export default Contact;
