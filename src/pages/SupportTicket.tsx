/**
 * Support Ticket Page - User View
 * Allows users to view and respond to their support tickets via unique token
 */

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, Send, User, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import { getTicketByToken, getTicketReplies, createReply, markRepliesAsRead } from '@/lib/support';
import type { ContactMessage, ContactMessageReply } from '@/types/support';

export function SupportTicket() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [ticket, setTicket] = useState<ContactMessage | null>(null);
  const [replies, setReplies] = useState<ContactMessageReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load ticket and replies
  const loadTicket = async () => {
    if (!token) {
      setError('No access token provided');
      setLoading(false);
      return;
    }

    try {
      const ticketData = await getTicketByToken(token);
      
      if (!ticketData) {
        setError('Invalid or expired token');
        setLoading(false);
        return;
      }

      setTicket(ticketData);
      
      const repliesData = await getTicketReplies(ticketData.id);
      setReplies(repliesData);
      
      // Mark admin replies as read by user
      await markRepliesAsRead(ticketData.id, 'user');
      
      setLoading(false);
    } catch (err) {
      console.error('[SUPPORT TICKET] Error loading ticket:', err);
      setError('Failed to load ticket');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTicket();
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      if (ticket) {
        getTicketReplies(ticket.id).then(setReplies);
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [token]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies]);

  const handleSendReply = async () => {
    if (!ticket || !replyText.trim()) return;

    setSending(true);
    try {
      const reply = await createReply({
        message_id: ticket.id,
        sender_type: 'user',
        sender_name: ticket.name,
        sender_email: ticket.email,
        content: replyText.trim(),
      });

      if (reply) {
        setReplies([...replies, reply]);
        setReplyText('');
      } else {
        alert('Failed to send reply. Please try again.');
      }
    } catch (err) {
      console.error('[SUPPORT TICKET] Error sending reply:', err);
      alert('Failed to send reply. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/50">New</Badge>;
      case 'read':
        return <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/50">In Review</Badge>;
      case 'replied':
        return <Badge className="bg-green-500/20 text-green-300 border-green-500/50">Replied</Badge>;
      case 'resolved':
        return <Badge className="bg-gray-500/20 text-gray-300 border-gray-500/50">Resolved</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black via-[#1a1a1a] to-black">
        <header className="bg-black/95 shadow-sm border-b border-gold-medium/30 py-4">
          <div className="container">
            <Link to="/">
              <img src="/logo2.png" alt="MIGMA" className="h-16 md:h-20 w-auto" />
            </Link>
          </div>
        </header>
        <div className="container py-12">
          <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardHeader>
              <Skeleton className="h-8 w-64" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black via-[#1a1a1a] to-black">
        <header className="bg-black/95 shadow-sm border-b border-gold-medium/30 py-4">
          <div className="container">
            <Link to="/">
              <img src="/logo2.png" alt="MIGMA" className="h-16 md:h-20 w-auto" />
            </Link>
          </div>
        </header>
        <div className="container py-12">
          <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardContent className="p-12 text-center">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Ticket Not Found</h2>
              <p className="text-gray-400 mb-6">{error || 'The ticket you are looking for does not exist or the link has expired.'}</p>
              <Link to="/contact">
                <Button className="btn btn-primary">Contact Us</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-[#1a1a1a] to-black">
      {/* Header */}
      <header className="bg-black/95 shadow-sm border-b border-gold-medium/30 py-4">
        <div className="container">
          <Link to="/">
            <img src="/logo2.png" alt="MIGMA" className="h-16 md:h-20 w-auto" />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="container py-8 max-w-4xl">
        {/* Ticket Header */}
        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <CardTitle className="text-white">{ticket.subject}</CardTitle>
                  {getStatusBadge(ticket.status)}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    <span>{ticket.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(ticket.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-black/30 p-4 rounded border border-gold-medium/20">
              <p className="text-sm font-semibold text-gray-300 mb-2">Original Message:</p>
              <p className="text-white whitespace-pre-wrap">{ticket.message}</p>
            </div>
          </CardContent>
        </Card>

        {/* Messages Thread */}
        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Conversation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {replies.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                  <p className="text-gray-400">No responses yet. Our team will respond soon.</p>
                </div>
              ) : (
                replies.map((reply) => (
                  <div
                    key={reply.id}
                    className={`flex ${reply.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-4 ${
                        reply.sender_type === 'user'
                          ? 'bg-gold-medium/20 border border-gold-medium/40'
                          : 'bg-black/40 border border-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-semibold text-gold-light">
                          {reply.sender_name}
                        </span>
                        {reply.sender_type === 'admin' && (
                          <Badge className="bg-gold-medium/30 text-gold-light border-gold-medium/50 text-xs">
                            MIGMA Team
                          </Badge>
                        )}
                      </div>
                      <p className="text-white whitespace-pre-wrap">{reply.content}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {new Date(reply.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </CardContent>
        </Card>

        {/* Reply Input */}
        {ticket.status !== 'resolved' && ticket.status !== 'archived' && (
          <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardContent className="p-6">
              <div className="space-y-4">
                <Textarea
                  placeholder="Type your message here..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="min-h-[120px] bg-white text-black"
                  disabled={sending}
                />
                <div className="flex justify-end">
                  <Button
                    onClick={handleSendReply}
                    disabled={sending || !replyText.trim()}
                    className="btn btn-primary disabled:opacity-50"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {sending ? 'Sending...' : 'Send Reply'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {ticket.status === 'resolved' && (
          <Card className="bg-gradient-to-br from-green-500/10 via-green-500/5 to-green-500/10 border border-green-500/30">
            <CardContent className="p-6 text-center">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <h3 className="text-xl font-bold text-white mb-2">Ticket Resolved</h3>
              <p className="text-gray-300">
                This ticket has been marked as resolved. If you need further assistance, please{' '}
                <Link to="/contact" className="text-gold-light hover:text-gold-medium underline">
                  create a new ticket
                </Link>
                .
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

