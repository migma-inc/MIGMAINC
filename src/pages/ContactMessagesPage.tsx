import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Mail, User, Calendar, MessageSquare, CheckCircle, Circle, Archive } from 'lucide-react';
import { adminSupabase } from '@/lib/auth';

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
}

export function ContactMessagesPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadMessages();
  }, [statusFilter]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      let query = adminSupabase
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading messages:', error);
        return;
      }

      setMessages(data || []);
    } catch (err) {
      console.error('Error loading messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await adminSupabase
        .from('contact_messages')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) {
        console.error('Error updating status:', error);
        return;
      }

      // Reload messages
      loadMessages();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/50">New</Badge>;
      case 'read':
        return <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/50">Read</Badge>;
      case 'replied':
        return <Badge className="bg-green-500/20 text-green-300 border-green-500/50">Replied</Badge>;
      case 'archived':
        return <Badge className="bg-gray-500/20 text-gray-300 border-gray-500/50">Archived</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new':
        return <Circle className="w-4 h-4" />;
      case 'read':
        return <CheckCircle className="w-4 h-4" />;
      case 'replied':
        return <CheckCircle className="w-4 h-4" />;
      case 'archived':
        return <Archive className="w-4 h-4" />;
      default:
        return <Circle className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredMessages = statusFilter === 'all' 
    ? messages 
    : messages.filter(m => m.status === statusFilter);

  const statusCounts = {
    all: messages.length,
    new: messages.filter(m => m.status === 'new').length,
    read: messages.filter(m => m.status === 'read').length,
    replied: messages.filter(m => m.status === 'replied').length,
    archived: messages.filter(m => m.status === 'archived').length,
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold migma-gold-text mb-2">Contact Messages</h1>
        <p className="text-gray-400">View and manage messages from the contact form</p>
      </div>

      {/* Status Filter */}
      <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'all', label: 'All', count: statusCounts.all },
              { value: 'new', label: 'New', count: statusCounts.new },
              { value: 'read', label: 'Read', count: statusCounts.read },
              { value: 'replied', label: 'Replied', count: statusCounts.replied },
              { value: 'archived', label: 'Archived', count: statusCounts.archived },
            ].map((status) => (
              <Button
                key={status.value}
                variant="outline"
                size="sm"
                onClick={() => setStatusFilter(status.value)}
                className={`${
                  statusFilter === status.value
                    ? 'bg-gold-medium/20 border-gold-medium text-gold-light'
                    : 'border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium'
                }`}
              >
                {status.label} ({status.count})
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Messages List */}
      <div className="space-y-4">
        {filteredMessages.length === 0 ? (
          <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardContent className="p-12 text-center">
              <Mail className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 mb-2">No messages found</p>
              <p className="text-sm text-gray-500">
                {statusFilter !== 'all' ? 'Try selecting a different status filter' : 'Messages will appear here when users submit the contact form'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredMessages.map((message) => (
            <Card
              key={message.id}
              className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30"
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getStatusIcon(message.status)}
                      <CardTitle className="text-white">{message.subject}</CardTitle>
                      {getStatusBadge(message.status)}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        <span>{message.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        <a href={`mailto:${message.email}`} className="text-gold-light hover:text-gold-medium">
                          {message.email}
                        </a>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(message.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="w-4 h-4 text-gold-light" />
                      <p className="text-sm font-semibold text-gray-300">Message:</p>
                    </div>
                    <p className="text-white whitespace-pre-wrap bg-black/30 p-4 rounded border border-gold-medium/20">
                      {message.message}
                    </p>
                  </div>

                  {message.ip_address && (
                    <div className="text-xs text-gray-500">
                      IP: {message.ip_address}
                    </div>
                  )}

                  <div className="flex gap-2 pt-4 border-t border-gold-medium/30">
                    {message.status === 'new' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateStatus(message.id, 'read')}
                        className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium"
                      >
                        Mark as Read
                      </Button>
                    )}
                    {message.status !== 'replied' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateStatus(message.id, 'replied')}
                        className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium"
                      >
                        Mark as Replied
                      </Button>
                    )}
                    {message.status !== 'archived' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateStatus(message.id, 'archived')}
                        className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium"
                      >
                        Archive
                      </Button>
                    )}
                    {message.status === 'archived' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateStatus(message.id, 'read')}
                        className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium hover:text-gold-medium"
                      >
                        Unarchive
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
