/**
 * Contact Message Detail Page - Admin View
 * Full ticket management with chat, priority, tags, and status updates
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft,
  Send, 
  User, 
  Mail,
  Calendar, 
  MessageSquare,
  AlertCircle,
  Tag,
  X,
  ExternalLink,
  Clock
} from 'lucide-react';
import { getTicketWithReplies, createReply, updateTicketMetadata, markRepliesAsRead, generateAccessToken } from '@/lib/support';
import { sendAdminReplyNotification } from '@/lib/emails';
import { getCurrentUser, adminSupabase } from '@/lib/auth';
import type { AdminUser } from '@/lib/auth';
import type { TicketWithReplies, TicketPriority, TicketStatus } from '@/types/support';

export function ContactMessageDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [ticket, setTicket] = useState<TicketWithReplies | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [updating, setUpdating] = useState(false);

  // Load ticket and replies
  const loadTicket = async () => {
    if (!id) return;

    try {
      const ticketData = await getTicketWithReplies(id, true);
      
      if (!ticketData) {
        console.error('[ADMIN DETAIL] Ticket not found');
        setLoading(false);
        return;
      }

      setTicket(ticketData);
      
      // Mark admin replies as read
      await markRepliesAsRead(id, 'admin');
      
      setLoading(false);
    } catch (err) {
      console.error('[ADMIN DETAIL] Error loading ticket:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTicket();
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      if (id) {
        getTicketWithReplies(id, true).then(data => {
          if (data) {
            setTicket(data);
            markRepliesAsRead(id, 'admin');
          }
        });
      }
    }, 5000);
    
    // Load current admin user
    getCurrentUser().then(u => {
      setAdminUser(u);
    }).catch(err => {
      console.warn('[ADMIN DETAIL] Could not load current user', err);
    });

    return () => clearInterval(interval);
  }, [id]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.replies]);

  const handleSendReply = async () => {
    if (!ticket || !replyText.trim()) return;

    setSending(true);
    try {
      const adminName = (adminUser && (adminUser.email || adminUser.id)) || 'Admin';
      const adminEmail = (adminUser && adminUser.email) || 'admin@migma.com';

      // Prevent spamming user with multiple emails: check last admin reply timestamp
      const EMAIL_COOLDOWN_MINUTES = 5; // minutes
      let skipEmail = false;
      try {
        const { data: lastAdminReply, error: lastErr } = await adminSupabase
          .from('contact_message_replies')
          .select('created_at')
          .eq('message_id', ticket.id)
          .eq('sender_type', 'admin')
          .order('created_at', { ascending: false })
          .limit(1);

        if (lastErr) {
          console.warn('[ADMIN DETAIL] Could not fetch last admin reply time:', lastErr);
        } else if (lastAdminReply && lastAdminReply.length > 0) {
          const lastAt = new Date(lastAdminReply[0].created_at);
          const now = new Date();
          const diffMs = now.getTime() - lastAt.getTime();
          if (diffMs < EMAIL_COOLDOWN_MINUTES * 60 * 1000) {
            skipEmail = true;
            console.log('[ADMIN DETAIL] Skipping notification email due to cooldown');
          }
        }
      } catch (err) {
        console.warn('[ADMIN DETAIL] Error checking email cooldown:', err);
      }

      const reply = await createReply({
        message_id: ticket.id,
        sender_type: 'admin',
        sender_name: adminName,
        sender_email: adminEmail,
        content: replyText.trim(),
      });

      if (reply) {
        // Update local state
        setTicket({
          ...ticket,
          replies: [...ticket.replies, reply],
          status: 'replied',
        });
        setReplyText('');

        // Send email notification to user (ensure token exists)
        if (!skipEmail) {
        try {
          let tokenToSend = ticket.access_token;
          if (!tokenToSend) {
            const generated = await generateAccessToken(ticket.id);
            if (generated) {
              tokenToSend = generated;
              // update local ticket access_token
              setTicket({ ...ticket, access_token: tokenToSend });
            }
          }

          if (tokenToSend) {
            const emailResult = await sendAdminReplyNotification(
              ticket.email,
              ticket.name,
              ticket.subject,
              tokenToSend
            );
            if (emailResult) {
              console.log('[ADMIN DETAIL] Notification email sent to user');
            } else {
              console.warn('[ADMIN DETAIL] sendAdminReplyNotification returned false');
            }
          } else {
            console.warn('[ADMIN DETAIL] No access token available to send notification link');
          }
        } catch (emailErr) {
          console.error('[ADMIN DETAIL] Failed to send notification email:', emailErr);
          }
        }
      } else {
        alert('Failed to send reply. Please try again.');
      }
    } catch (err) {
      console.error('[ADMIN DETAIL] Error sending reply:', err);
      alert('Failed to send reply. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleUpdatePriority = async (priority: TicketPriority) => {
    if (!ticket) return;

    setUpdating(true);
    try {
      const success = await updateTicketMetadata(ticket.id, { priority });
      if (success) {
        setTicket({ ...ticket, priority });
      }
    } catch (err) {
      console.error('[ADMIN DETAIL] Error updating priority:', err);
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateStatus = async (status: TicketStatus) => {
    if (!ticket) return;

    setUpdating(true);
    try {
      const success = await updateTicketMetadata(ticket.id, { status });
      if (success) {
        setTicket({ ...ticket, status });
      }
    } catch (err) {
      console.error('[ADMIN DETAIL] Error updating status:', err);
    } finally {
      setUpdating(false);
    }
  };

  const handleAddTag = async () => {
    if (!ticket || !newTag.trim()) return;

    const updatedTags = [...(ticket.tags || []), newTag.trim()];
    
    setUpdating(true);
    try {
      const success = await updateTicketMetadata(ticket.id, { tags: updatedTags });
      if (success) {
        setTicket({ ...ticket, tags: updatedTags });
        setNewTag('');
      }
    } catch (err) {
      console.error('[ADMIN DETAIL] Error adding tag:', err);
    } finally {
      setUpdating(false);
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!ticket) return;

    const updatedTags = (ticket.tags || []).filter(tag => tag !== tagToRemove);
    
    setUpdating(true);
    try {
      const success = await updateTicketMetadata(ticket.id, { tags: updatedTags });
      if (success) {
        setTicket({ ...ticket, tags: updatedTags });
      }
    } catch (err) {
      console.error('[ADMIN DETAIL] Error removing tag:', err);
    } finally {
      setUpdating(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge className="bg-red-500/20 text-red-300 border-red-500/50">Urgent</Badge>;
      case 'high':
        return <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/50">High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/50">Medium</Badge>;
      case 'low':
        return <Badge className="bg-gray-500/20 text-gray-300 border-gray-500/50">Low</Badge>;
      default:
        return <Badge>{priority}</Badge>;
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
        return <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/50">Resolved</Badge>;
      case 'archived':
        return <Badge className="bg-gray-500/20 text-gray-300 border-gray-500/50">Archived</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 lg:pt-12">
        <Skeleton className="h-10 w-48 mb-6" />
        <div className="space-y-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 lg:pt-12">
        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Ticket Not Found</h2>
            <p className="text-gray-400 mb-6">The ticket you are looking for does not exist.</p>
            <Link to="/dashboard/contact-messages">
              <Button className="btn btn-primary">Back to Tickets</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 lg:pt-12">
      {/* Back Button */}
      <Button
        variant="outline"
        className="mb-6 border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium"
        onClick={() => navigate('/dashboard/contact-messages')}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Tickets
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Ticket & Chat */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ticket Header */}
          <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardHeader>
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <CardTitle className="text-white text-2xl">{ticket.subject}</CardTitle>
                    {getStatusBadge(ticket.status)}
                    {getPriorityBadge(ticket.priority)}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                    <div className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      <span>{ticket.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      <a href={`mailto:${ticket.email}`} className="text-gold-light hover:text-gold-medium">
                        {ticket.email}
                      </a>
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
              
              {ticket.access_token && (
                <div className="mt-4 p-3 bg-gold-medium/10 border border-gold-medium/30 rounded">
                  <p className="text-xs text-gray-400 mb-1">User Access Link:</p>
                  <a 
                    href={`${window.location.origin}/support/ticket?token=${ticket.access_token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gold-light hover:text-gold-medium text-sm flex items-center gap-1"
                  >
                    View as User
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chat Thread */}
          <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Conversation ({ticket.replies.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 mb-6">
                {ticket.replies.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                    <p className="text-gray-400">No responses yet. Be the first to reply!</p>
                  </div>
                ) : (
                  ticket.replies.map((reply) => (
                    <div
                      key={reply.id}
                      className={`flex ${reply.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-4 ${
                          reply.sender_type === 'admin'
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
                              Admin
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

              {/* Reply Input */}
              {ticket.status !== 'archived' && (
                <div className="space-y-4 pt-4 border-t border-gold-medium/30">
                  <Textarea
                    placeholder="Type your response here..."
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
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Metadata */}
        <div className="space-y-6">
          {/* Status Management */}
          <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardHeader>
              <CardTitle className="text-white text-lg">Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                value={ticket.status}
                onValueChange={(value) => handleUpdateStatus(value as TicketStatus)}
                disabled={updating}
              >
                <SelectTrigger className="bg-black text-white border-gold-medium/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="read">In Review</SelectItem>
                  <SelectItem value="replied">Replied</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Priority Management */}
          <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardHeader>
              <CardTitle className="text-white text-lg">Priority</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                value={ticket.priority}
                onValueChange={(value) => handleUpdatePriority(value as TicketPriority)}
                disabled={updating}
              >
                <SelectTrigger className="bg-black text-white border-gold-medium/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Tags Management */}
          <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardHeader>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <Tag className="w-5 h-5" />
                Tags
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Existing Tags */}
              <div className="flex flex-wrap gap-2">
                {ticket.tags && ticket.tags.length > 0 ? (
                  ticket.tags.map((tag, idx) => (
                    <Badge
                      key={idx}
                      variant="outline"
                      className="border-gold-medium/50 text-gold-light bg-black/30 flex items-center gap-1"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 hover:text-red-400"
                        disabled={updating}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No tags yet</p>
                )}
              </div>

              {/* Add Tag */}
              <div className="flex gap-2">
                <Input
                  placeholder="Add tag..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  className="bg-white text-black"
                  disabled={updating}
                />
                <Button
                  onClick={handleAddTag}
                  disabled={updating || !newTag.trim()}
                  size="sm"
                  className="btn btn-primary"
                >
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Ticket Info */}
          <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardHeader>
              <CardTitle className="text-white text-lg">Ticket Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-gray-400">
                <Calendar className="w-4 h-4" />
                <span>Created: {new Date(ticket.created_at).toLocaleString()}</span>
              </div>
              {ticket.last_reply_at && (
                <div className="flex items-center gap-2 text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span>Last Reply: {new Date(ticket.last_reply_at).toLocaleString()}</span>
                </div>
              )}
              {ticket.ip_address && (
                <div className="text-xs text-gray-500 pt-2 border-t border-gold-medium/20">
                  IP: {ticket.ip_address}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

