import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { Loader2, Activity, Users, Calendar, BarChart3, MessageSquare, FileText, FileJson, FileCode } from 'lucide-react';
import { format } from 'date-fns';
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { saveAs } from 'file-saver';

// Type definition based on table schema
interface SlackReport {
    id: string;
    date: string;
    total_events: number;
    unique_users: number;
    report_data: ReportData; // JSONB
    created_at: string;
}

interface ReportData {
    date: string;
    totalEvents: number;
    uniqueUsers: number;
    users: ReportUser[];
}

interface ReportUser {
    userId: string;
    userName: string;
    userEmail: string;
    userDisplayName?: string;
    totalEvents: number;
    totalActiveTimeFormatted: string;
    messages: ReportMessage[];
    sessions: ReportSession[];
}

interface ReportSession {
    start: string;
    end: string;
    duration: number;
    eventCount: number;
    durationFormatted: string;
}

interface ReportMessage {
    text: string;
    channelName: string;
    timestamp: string;
    isPrivate: boolean;
}

export function SlackReportsPage() {
    const [reports, setReports] = useState<SlackReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState<SlackReport | null>(null);
    const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const safeFormat = (dateStr: any, formatStr: string) => {
        try {
            if (!dateStr) return 'N/A';

            let d: Date;
            // Case 1: Simple date (YYYY-MM-DD)
            if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                const [year, month, day] = dateStr.split('-').map(Number);
                d = new Date(year, month - 1, day);
            }
            // Case 2: Slack timestamp (float string like "1706277600.0001")
            else if (typeof dateStr === 'string' && /^\d{10}\.\d+$/.test(dateStr)) {
                d = new Date(parseFloat(dateStr) * 1000);
            }
            // Case 3: Epoch number (seconds or milliseconds)
            else if (typeof dateStr === 'number') {
                // If it looks like seconds (10 digits), multiply by 1000
                d = new Date(dateStr < 10000000000 ? dateStr * 1000 : dateStr);
            }
            // Case 4: Standard ISO string or other date format
            else {
                d = new Date(dateStr);
            }

            if (isNaN(d.getTime())) return 'N/A';
            return format(d, formatStr);
        } catch (e) {
            return 'N/A';
        }
    };

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        try {
            const { data, error } = await supabase
                .from('slack_activity_reports')
                .select('*')
                .order('date', { ascending: false });

            if (error) throw error;

            // Filtramos relatórios vazios (0 eventos)
            const activeReports = (data || []).filter(r => r.total_events > 0);
            setReports(activeReports);
        } catch (error) {
            console.error('Error fetching slack reports:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleViewReport = (report: SlackReport) => {
        setSelectedReport(report);
        const channels = getChannelsFromReport(report);
        setSelectedChannel(channels.length > 0 ? channels[0] : null);
        setIsDialogOpen(true);
    };

    const getChannelsFromReport = (report: SlackReport) => {
        const channels = new Set<string>();
        report.report_data.users?.forEach(user => {
            user.messages?.forEach(msg => {
                if (msg.channelName) channels.add(msg.channelName);
            });
        });
        return Array.from(channels).sort();
    };

    const getMessagesForChannel = (report: SlackReport, channelName: string) => {
        const allMessages: (ReportMessage & { userName: string; userEmail: string; userDisplayName?: string })[] = [];
        report.report_data.users?.forEach(user => {
            user.messages?.forEach(msg => {
                if (msg.channelName === channelName) {
                    allMessages.push({
                        ...msg,
                        userName: user.userName,
                        userEmail: user.userEmail,
                        userDisplayName: user.userDisplayName
                    });
                }
            });
        });
        return allMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    };

    const handleDownloadJSON = (report: SlackReport) => {
        const blob = new Blob([JSON.stringify(report.report_data, null, 2)], { type: "application/json" });
        saveAs(blob, `slack-report-${report.date}.json`);
    };

    const formatSlackMessage = (text: string, users: ReportUser[] = []) => {
        if (!text) return '';

        try {
            // Create a map of ID -> Name
            const userMap: Record<string, string> = {};
            if (Array.isArray(users)) {
                users.forEach(u => {
                    userMap[u.userId] = u.userDisplayName || u.userName;
                });
            }

            let formatted = text;

            // 1. Handle user mentions <@U...>
            formatted = formatted.replace(/<@([A-Z0-9]+)>/g, (_, userId) => {
                const userName = userMap[userId] || userId;
                return `<span class="text-blue-400 font-bold bg-blue-400/10 px-1 rounded hover:underline cursor-pointer">@${userName}</span>`;
            });

            // 2. Handle channel mentions <#C...>
            formatted = formatted.replace(/<#([A-Z0-9]+)\|?([^>]*)>/g, (_, channelId, channelName) => {
                return `<span class="text-blue-400 font-medium bg-blue-400/10 px-1 rounded hover:underline cursor-pointer">#${channelName || channelId}</span>`;
            });

            // 3. Handle special mentions <!here>, <!channel>, <!everyone>
            formatted = formatted.replace(/<!(here|channel|everyone)>/g, (_, mention) => {
                return `<span class="text-gold-light font-bold bg-gold-medium/20 px-1 rounded">@${mention}</span>`;
            });

            // 4. Handle URLs <http...>
            formatted = formatted.replace(/<(https?:\/\/[^>|]+)\|?([^>]*)>/g, (_, url, label) => {
                return `<a href="${url}" target="_blank" class="text-blue-400 hover:underline break-all">${label || url}</a>`;
            });

            // 5. Basic markdown-like formatting (be careful with overlapping)
            // Bold: *text*
            formatted = formatted.replace(/\*(.*?)\*/g, '<strong>$1</strong>');

            // Italic: _text_
            formatted = formatted.replace(/_(.*?)_/g, '<em>$1</em>');

            // Strikethrough: ~text~
            formatted = formatted.replace(/~(.*?)~/g, '<del>$1</del>');

            // Code: `text`
            formatted = formatted.replace(/`(.*?)`/g, '<code class="bg-white/10 px-1 rounded font-mono text-sm">$1</code>');

            // Blockquotes: > text
            formatted = formatted.replace(/^>(.*)$/gm, '<blockquote class="border-l-4 border-white/20 pl-4 py-1 my-2 italic text-gray-400">$1</blockquote>');

            return formatted;
        } catch (e) {
            console.error('[CRITICAL] Error in formatSlackMessage:', e);
            return typeof text === 'string' ? text : '';
        }
    };

    const handleDownloadHTML = (report: SlackReport) => {
        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Slack Activity Report - ${report.date}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f5f5f5; padding: 20px; color: #333; }
        .container { max-width: 900px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #111; border-bottom: 2px solid #eee; padding-bottom: 10px; }
        .stats { display: flex; gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #f9f9f9; padding: 15px; border-radius: 6px; flex: 1; text-align: center; border: 1px solid #eee; }
        .stat-value { font-size: 24px; font-weight: bold; color: #d4af37; }
        .user-card { margin-bottom: 20px; border: 1px solid #eee; border-radius: 8px; overflow: hidden; }
        .user-header { background: #f9f9f9; padding: 10px 15px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; }
        .user-name { font-weight: bold; font-size: 16px; }
        .user-meta { font-size: 12px; color: #666; }
        .message-list { padding: 0; margin: 0; list-style: none; }
        .message-item { padding: 10px 15px; border-bottom: 1px solid #f0f0f0; display: flex; gap: 10px; }
        .message-time { color: #888; font-size: 12px; font-family: monospace; white-space: nowrap; }
        .message-channel { background: #eee; border-radius: 4px; padding: 2px 6px; font-size: 10px; font-weight: bold; color: #555; align-self: flex-start; }
        .message-text { font-size: 14px; line-height: 1.4; word-break: break-word; }
        .badge { display: inline-block; padding: 3px 8px; border-radius: 10px; font-size: 11px; font-weight: bold; margin-left: 5px; }
        .badge-events { background: #fff3cd; color: #856404; }
        .badge-active { background: #d1ecf1; color: #0c5460; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Slack Activity Report: ${report.date}</h1>
        <div class="stats">
            <div class="stat-card">
                <div class="stat-value">${report.total_events}</div>
                <div>Total Events</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${report.unique_users}</div>
                <div>Active Users</div>
            </div>
        </div>
        <h2>User Activity</h2>
        ${report.report_data.users?.map(user => `
            <div class="user-card">
                <div class="user-header">
                    <div>
                        <span class="user-name">${user.userName}</span>
                        <div class="user-meta">${user.userEmail}</div>
                    </div>
                    <div>
                        <span class="badge badge-events">${user.totalEvents} msgs</span>
                        <span class="badge badge-active">${user.totalActiveTimeFormatted} active</span>
                    </div>
                </div>
                <ul class="message-list">
                    ${user.messages?.map(msg => `
                        <li class="message-item">
                            <span class="message-time">${msg.timestamp && !isNaN(new Date(msg.timestamp).getTime()) ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
                            <span class="message-channel">#${msg.channelName}</span>
                            <span class="message-text">${msg.text}</span>
                        </li>
                    `).join('') || ''}
                    ${!(user.messages?.length > 0) ? '<li class="message-item" style="color: #999; font-style: italic;">No messages recorded.</li>' : ''}
                </ul>
            </div>
        `).join('') || '<p>No user data available.</p>'}
        <div style="margin-top: 30px; text-align: center; color: #888; font-size: 12px;">
            Generated by Migma Admin Panel from Slack Data
        </div>
    </div>
</body>
</html>`;
        const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
        saveAs(blob, `slack-report-${report.date}.html`);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8 min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-gold-medium" />
            </div>
        );
    }

    const latestReport = reports[0];

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold migma-gold-text flex items-center gap-2">
                        <Activity className="w-6 h-6 sm:w-8 sm:h-8" />
                        Slack Activity Reports
                    </h1>
                    <p className="text-gray-400 mt-1 text-sm sm:text-base">
                        Overview of community engagement and activity metrics
                    </p>
                </div>
                <button
                    onClick={fetchReports}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-gold-medium/10 border border-gold-medium/30 rounded-lg text-gold-light hover:bg-gold-medium/20 transition-all font-medium"
                >
                    <Activity className={cn("w-4 h-4", loading && "animate-spin")} />
                    Refresh
                </button>
            </div>

            {latestReport && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-400">Total Events (Latest)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-white flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-gold-light" />
                                {latestReport.total_events}
                            </div>
                            <p className="text-xs text-gray-400 mt-1">On {safeFormat(latestReport.date, 'PPP')}</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-400">Active Users (Latest)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-white flex items-center gap-2">
                                <Users className="w-5 h-5 text-gold-light" />
                                {latestReport.unique_users}
                            </div>
                            <p className="text-xs text-gray-400 mt-1">On {safeFormat(latestReport.date, 'PPP')}</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-400">Total Reports</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-white flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-gold-light" />
                                {reports.length}
                            </div>
                            <p className="text-xs text-gray-400 mt-1">Recorded days</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <BarChart3 className="w-5 h-5" />
                        Activity History
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-400 uppercase border-b border-gold-medium/30">
                                <tr>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">Events</th>
                                    <th className="px-4 py-3">Unique Users</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reports.map((report) => (
                                    <tr key={report.id} className="border-b border-gold-medium/10 hover:bg-gold-medium/5 transition-colors">
                                        <td className="px-4 py-3 font-medium text-white">
                                            {safeFormat(report.date, 'PPP')}
                                        </td>
                                        <td className="px-4 py-3 text-gray-300">
                                            <div className="flex items-center gap-2">
                                                <MessageSquare className="w-3 h-3 text-gold-medium/70" />
                                                {report.total_events}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-300">
                                            <div className="flex items-center gap-2">
                                                <Users className="w-3 h-3 text-gold-medium/70" />
                                                {report.unique_users}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleDownloadJSON(report)}
                                                    className="p-1.5 text-gray-400 hover:text-gold-light hover:bg-gold-medium/10 rounded transition-colors"
                                                    title="Download JSON"
                                                >
                                                    <FileJson className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDownloadHTML(report)}
                                                    className="p-1.5 text-gray-400 hover:text-gold-light hover:bg-gold-medium/10 rounded transition-colors"
                                                    title="Download HTML"
                                                >
                                                    <FileCode className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleViewReport(report)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gold-light bg-gold-medium/10 border border-gold-medium/30 rounded-md hover:bg-gold-medium/20 transition-colors"
                                                >
                                                    <FileText className="w-3 h-3" />
                                                    View
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {reports.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                                            No reports found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-6xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0 bg-[#1A1D21] border-gold-medium/30 overflow-hidden">
                    <div className="h-12 border-b border-white/10 flex items-center justify-between px-4 bg-[#121417]">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                            <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                            <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
                            <span className="ml-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
                                Migma Workspace Activity - {selectedReport && safeFormat(selectedReport.date, 'PPP')}
                            </span>
                        </div>
                        <div className="flex items-center gap-4 text-gray-500">
                            <div className="text-[10px] bg-gold-medium/10 text-gold-light px-2 py-0.5 rounded border border-gold-medium/20">
                                {selectedReport?.total_events} Total Events
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 flex overflow-hidden">
                        <div className="w-64 bg-[#19171D] border-r border-white/5 flex flex-col hidden sm:flex">
                            <div className="p-4 border-b border-white/5">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4 text-gold-medium" />
                                    Channels
                                </h3>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
                                {selectedReport && getChannelsFromReport(selectedReport).map(channel => (
                                    <button
                                        key={channel}
                                        onClick={() => setSelectedChannel(channel)}
                                        className={cn(
                                            "w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-2 group",
                                            selectedChannel === channel
                                                ? "bg-gold-medium text-black font-bold"
                                                : "text-gray-400 hover:bg-white/5 hover:text-white"
                                        )}
                                    >
                                        <span className={cn(
                                            "font-mono opacity-50 text-lg leading-none",
                                            selectedChannel === channel ? "text-black" : "text-gray-500"
                                        )}>#</span>
                                        {channel}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col bg-[#1A1D21]">
                            <div className="h-14 border-b border-white/10 flex items-center px-6 justify-between bg-black/20">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl font-bold text-white flex items-center gap-1">
                                        <span className="text-gray-500 font-normal">#</span>
                                        {selectedChannel || 'Select a channel'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar bg-gradient-to-b from-transparent to-black/20">
                                {selectedReport && selectedChannel ? (
                                    <div className="py-6">
                                        {getMessagesForChannel(selectedReport, selectedChannel).map((msg, i, arr) => {
                                            const showHeader = i === 0 || arr[i - 1].userName !== msg.userName ||
                                                (new Date(msg.timestamp).getTime() - new Date(arr[i - 1].timestamp).getTime() > 180000); // 3 minutes

                                            return (
                                                <div
                                                    key={i}
                                                    className={cn(
                                                        "group px-6 py-1 hover:bg-white/[0.03] transition-colors relative",
                                                        showHeader ? "mt-4 pt-2" : ""
                                                    )}
                                                >
                                                    {showHeader ? (
                                                        <div className="flex gap-4">
                                                            <div className="w-10 h-10 rounded bg-gradient-to-br from-gold-medium to-gold-dark shrink-0 flex items-center justify-center text-black font-bold text-lg shadow-lg">
                                                                {msg.userName.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-baseline gap-2 mb-0.5">
                                                                    <span className="font-black text-[15px] text-white">
                                                                        {msg.userDisplayName || msg.userName}
                                                                    </span>
                                                                    <span className="text-[11px] text-gray-500 font-medium">
                                                                        {safeFormat(msg.timestamp, 'HH:mm')}
                                                                    </span>
                                                                </div>
                                                                <div
                                                                    className="text-[15px] text-[#D1D2D3] break-words [word-break:break-word] [overflow-wrap:anywhere] whitespace-pre-wrap leading-relaxed"
                                                                    dangerouslySetInnerHTML={{ __html: formatSlackMessage(msg.text, selectedReport?.report_data?.users || []) }}
                                                                />
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex gap-4 group">
                                                            <div className="w-10 shrink-0 flex justify-end pr-2 opacity-0 group-hover:opacity-100">
                                                                <span className="text-[10px] text-gray-500 font-mono mt-1">
                                                                    {safeFormat(msg.timestamp, 'HH:mm')}
                                                                </span>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div
                                                                    className="text-[15px] text-[#D1D2D3] break-words [word-break:break-word] [overflow-wrap:anywhere] whitespace-pre-wrap leading-relaxed"
                                                                    dangerouslySetInnerHTML={{ __html: formatSlackMessage(msg.text, selectedReport?.report_data?.users || []) }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {getMessagesForChannel(selectedReport, selectedChannel).length === 0 && (
                                            <div className="flex flex-col items-center justify-center h-full text-gray-500 py-12">
                                                <MessageSquare className="w-12 h-12 mb-4 opacity-10" />
                                                <p>This channel has no messages recorded for this day.</p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                        <Activity className="w-16 h-16 mb-4 opacity-10" />
                                        <p>Select a channel from the sidebar to view conversations.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
