/**
 * Contact Messages Page - Admin Dashboard
 * Displays and manages support tickets with chat, priorities, tags, and assignments
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Mail, 
  User, 
  Calendar, 
  MessageSquare, 
  CheckCircle, 
  Circle, 
  Archive,
  AlertCircle,
  Clock,
  Tag,
  ArrowRight,
  AlertTriangle
} from 'lucide-react';
import { adminSupabase } from '@/lib/auth';
import type { ContactMessage } from '@/types/support';

interface TicketWithCount extends ContactMessage {
  reply_count?: number;
  unread_count?: number;
}

export function ContactMessagesPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<TicketWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  useEffect(() => {
    loadMessages();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
  }, [statusFilter, priorityFilter]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      
      // Build query with filters
      let query = adminSupabase
        .from('contact_messages')
        .select('*')
        .order('last_reply_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (priorityFilter !== 'all') {
        query = query.eq('priority', priorityFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[ADMIN] Error loading messages:', error);
        return;
      }

      // Get reply counts for each message
      const messagesWithCounts = await Promise.all(
        (data || []).map(async (msg) => {
          const { count: totalCount } = await adminSupabase
            .from('contact_message_replies')
            .select('*', { count: 'exact', head: true })
            .eq('message_id', msg.id);

          const { count: unreadCount } = await adminSupabase
            .from('contact_message_replies')
            .select('*', { count: 'exact', head: true })
            .eq('message_id', msg.id)
            .eq('sender_type', 'user')
            .eq('read_by_admin', false);

          return {
            ...msg,
            reply_count: totalCount || 0,
            unread_count: unreadCount || 0,
          };
        })
      );

      setMessages(messagesWithCounts);
    } catch (err) {
      console.error('[ADMIN] Error loading messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return (
          <Badge className="bg-red-500/20 text-red-300 border-red-500/50 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Urgent
          </Badge>
        );
      case 'high':
        return (
          <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/50 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            High
          </Badge>
        );
      case 'medium':
        return (
          <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/50">
            Medium
          </Badge>
        );
      case 'low':
        return (
          <Badge className="bg-gray-500/20 text-gray-300 border-gray-500/50">
            Low
          </Badge>
        );
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new':
        return <Circle className="w-4 h-4 text-blue-400" />;
      case 'read':
        return <Clock className="w-4 h-4 text-yellow-400" />;
      case 'replied':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'resolved':
        return <CheckCircle className="w-4 h-4 text-purple-400" />;
      case 'archived':
        return <Archive className="w-4 h-4 text-gray-400" />;
      default:
        return <Circle className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 lg:pt-12">
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

  const statusCounts = {
    all: messages.length,
    new: messages.filter(m => m.status === 'new').length,
    read: messages.filter(m => m.status === 'read').length,
    replied: messages.filter(m => m.status === 'replied').length,
    resolved: messages.filter(m => m.status === 'resolved').length,
    archived: messages.filter(m => m.status === 'archived').length,
  };

  const priorityCounts = {
    all: messages.length,
    urgent: messages.filter(m => m.priority === 'urgent').length,
    high: messages.filter(m => m.priority === 'high').length,
    medium: messages.filter(m => m.priority === 'medium').length,
    low: messages.filter(m => m.priority === 'low').length,
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 lg:pt-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold migma-gold-text mb-2">Support Tickets</h1>
        <p className="text-gray-400">Manage and respond to customer support tickets</p>
      </div>

      {/* Filters */}
      <div className="space-y-4 mb-6">
        {/* Status Filter */}
        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-4 h-4 text-gold-light" />
              <p className="text-sm font-semibold text-gold-light">Status Filter:</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'all', label: 'All', count: statusCounts.all },
                { value: 'new', label: 'New', count: statusCounts.new },
                { value: 'read', label: 'In Review', count: statusCounts.read },
                { value: 'replied', label: 'Replied', count: statusCounts.replied },
                { value: 'resolved', label: 'Resolved', count: statusCounts.resolved },
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

        {/* Priority Filter */}
        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-gold-light" />
              <p className="text-sm font-semibold text-gold-light">Priority Filter:</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'all', label: 'All Priorities', count: priorityCounts.all },
                { value: 'urgent', label: 'Urgent', count: priorityCounts.urgent },
                { value: 'high', label: 'High', count: priorityCounts.high },
                { value: 'medium', label: 'Medium', count: priorityCounts.medium },
                { value: 'low', label: 'Low', count: priorityCounts.low },
              ].map((priority) => (
                <Button
                  key={priority.value}
                  variant="outline"
                  size="sm"
                  onClick={() => setPriorityFilter(priority.value)}
                  className={`${
                    priorityFilter === priority.value
                      ? 'bg-gold-medium/20 border-gold-medium text-gold-light'
                      : 'border-gold-medium/50 bg-black/50 text-gold-light hover:bg-black hover:border-gold-medium'
                  }`}
                >
                  {priority.label} ({priority.count})
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tickets List */}
      <div className="space-y-4">
        {messages.length === 0 ? (
          <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardContent className="p-12 text-center">
              <Mail className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 mb-2">No tickets found</p>
              <p className="text-sm text-gray-500">
                {statusFilter !== 'all' || priorityFilter !== 'all' 
                  ? 'Try adjusting your filters' 
                  : 'Tickets will appear here when users submit the contact form'}
              </p>
            </CardContent>
          </Card>
        ) : (
          messages.map((message) => (
            <Card
              key={message.id}
              className={`bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30 cursor-pointer hover:border-gold-medium/60 transition-all ${
                message.unread_count && message.unread_count > 0 ? 'ring-2 ring-gold-medium/50' : ''
              }`}
              onClick={() => navigate(`/dashboard/contact-messages/${message.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      {getStatusIcon(message.status)}
                      <CardTitle className="text-white">{message.subject}</CardTitle>
                      {getStatusBadge(message.status)}
                      {getPriorityBadge(message.priority)}
                      
                      {/* Unread indicator */}
                      {message.unread_count && message.unread_count > 0 && (
                        <Badge className="bg-red-500/30 text-red-200 border-red-500/50 animate-pulse">
                          {message.unread_count} new {message.unread_count === 1 ? 'reply' : 'replies'}
                        </Badge>
                      )}
                      
                      {/* Reply count */}
                      {message.reply_count && message.reply_count > 0 && (
                        <Badge variant="outline" className="border-gold-medium/50 text-gray-300">
                          <MessageSquare className="w-3 h-3 mr-1" />
                          {message.reply_count} {message.reply_count === 1 ? 'reply' : 'replies'}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        <span>{message.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        <a 
                          href={`mailto:${message.email}`} 
                          className="text-gold-light hover:text-gold-medium"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {message.email}
                        </a>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(message.created_at).toLocaleString()}</span>
                      </div>
                      {message.last_reply_at && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span className="text-gold-light">
                            Last reply: {new Date(message.last_reply_at).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <ArrowRight className="w-5 h-5 text-gold-light ml-4 flex-shrink-0" />
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-3">
                  {/* Tags */}
                  {message.tags && message.tags.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Tag className="w-4 h-4 text-gold-light" />
                      {message.tags.map((tag, idx) => (
                        <Badge 
                          key={idx} 
                          variant="outline" 
                          className="border-gold-medium/50 text-gold-light bg-black/30"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  {/* Message preview */}
                  <div>
                    <p className="text-sm font-semibold text-gray-300 mb-1">Message Preview:</p>
                    <p className="text-white text-sm line-clamp-2 bg-black/30 p-3 rounded border border-gold-medium/20">
                      {message.message}
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-gold-medium/30">
                    <p className="text-xs text-gray-500">Click to open ticket and respond</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-gold-medium/20 hover:border-gold-medium"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/dashboard/contact-messages/${message.id}`);
                      }}
                    >
                      Open Ticket
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
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
