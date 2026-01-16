import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { Loader2, Activity, Users, Calendar, BarChart3, MessageSquare, Clock, FileText, Timer, FileJson, FileCode } from 'lucide-react';
import { format } from 'date-fns';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    const [isDialogOpen, setIsDialogOpen] = useState(false);

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
            setReports(data || []);
        } catch (error) {
            console.error('Error fetching slack reports:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleViewReport = (report: SlackReport) => {
        setSelectedReport(report);
        setIsDialogOpen(true);
    };

    const handleDownloadJSON = (report: SlackReport) => {
        const blob = new Blob([JSON.stringify(report.report_data, null, 2)], { type: "application/json" });
        saveAs(blob, `slack-report-${report.date}.json`);
    };

    const handleDownloadHTML = (report: SlackReport) => {
        // Generate a simple HTML report
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
        .message-text { font-size: 14px; line-height: 1.4; }
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
                    ${user.messages.map(msg => `
                        <li class="message-item">
                            <span class="message-time">${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span class="message-channel">#${msg.channelName}</span>
                            <span class="message-text">${msg.text}</span>
                        </li>
                    `).join('')}
                    ${user.messages.length === 0 ? '<li class="message-item" style="color: #999; font-style: italic;">No messages recorded.</li>' : ''}
                </ul>
            </div>
        `).join('') || '<p>No user data available.</p>'}
        
        <div style="margin-top: 30px; text-align: center; color: #888; font-size: 12px;">
            Generated by Migma Admin Panel from Slack Data
        </div>
    </div>
</body>
</html>
        `;

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
            {/* Header */}
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
            </div>

            {/* Stats Overview */}
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
                            <p className="text-xs text-gray-400 mt-1">On {format(new Date(latestReport.date), 'PPP')}</p>
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
                            <p className="text-xs text-gray-400 mt-1">On {format(new Date(latestReport.date), 'PPP')}</p>
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

            {/* Reports List */}
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
                                            {format(new Date(report.date), 'PPP')}
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

            {/* Detailed Report Modal */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 gap-0 bg-neutral-900 border-gold-medium/30">
                    <DialogHeader className="p-6 pb-2 border-b border-gold-medium/20 bg-gradient-to-r from-gold-dark/20 to-transparent">
                        <DialogTitle className="text-xl font-bold migma-gold-text flex items-center gap-2">
                            <Activity className="w-5 h-5" />
                            Activity Report: {selectedReport && format(new Date(selectedReport.date), 'PPP')}
                        </DialogTitle>
                        <DialogDescription className="text-gray-400 flex gap-4 mt-1">
                            <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {selectedReport?.total_events} Events</span>
                            <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {selectedReport?.unique_users} Users</span>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                        <div className="space-y-6">
                            {selectedReport?.report_data?.users?.map((user, index) => (
                                <Card key={user.userId + index} className="bg-black/40 border border-gold-medium/20 overflow-hidden">
                                    <div className="bg-gold-medium/5 border-b border-gold-medium/10 p-3 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-medium to-gold-dark flex items-center justify-center text-black font-bold text-xs">
                                                {user.userName.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-white leading-none">{user.userName}</h3>
                                                <p className="text-xs text-gray-400 mt-1">{user.userEmail}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Badge variant="outline" className="border-gold-medium/30 text-gold-light bg-gold-medium/5 text-[10px] h-6">
                                                <MessageSquare className="w-3 h-3 mr-1" />
                                                {user.totalEvents} msgs
                                            </Badge>
                                            <Badge variant="outline" className="border-blue-500/30 text-blue-300 bg-blue-500/5 text-[10px] h-6">
                                                <Clock className="w-3 h-3 mr-1" />
                                                {user.totalActiveTimeFormatted} active
                                            </Badge>
                                        </div>
                                    </div>

                                    <CardContent className="p-0">
                                        <Tabs defaultValue="messages" className="w-full">
                                            <div className="px-4 pt-2 bg-black/20 border-b border-white/5">
                                                <TabsList className="bg-transparent h-8 p-0 gap-4">
                                                    <TabsTrigger
                                                        value="messages"
                                                        className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-gold-light data-[state=active]:border-b-2 data-[state=active]:border-gold-light rounded-none px-0 pb-2 h-8 text-xs text-gray-500 hover:text-gray-300"
                                                    >
                                                        Messages ({user.messages.length})
                                                    </TabsTrigger>
                                                    <TabsTrigger
                                                        value="sessions"
                                                        className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-gold-light data-[state=active]:border-b-2 data-[state=active]:border-gold-light rounded-none px-0 pb-2 h-8 text-xs text-gray-500 hover:text-gray-300"
                                                    >
                                                        Activity Sessions ({user.sessions?.length || 0})
                                                    </TabsTrigger>
                                                </TabsList>
                                            </div>

                                            <TabsContent value="messages" className="m-0">
                                                {user.messages.length > 0 ? (
                                                    <div className="divide-y divide-white/5">
                                                        {user.messages.map((msg, i) => (
                                                            <div key={i} className="p-3 px-4 hover:bg-white/5 transition-colors flex gap-3 group">
                                                                <div className="text-xs text-gray-500 w-12 shrink-0 pt-0.5 font-mono">
                                                                    {format(new Date(msg.timestamp), 'HH:mm')}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-baseline gap-2 mb-0.5">
                                                                        <span className="text-[10px] items-center px-1.5 py-0.5 rounded bg-white/10 text-gray-300 font-medium inline-flex">
                                                                            #{msg.channelName}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-sm text-gray-200 break-words whitespace-pre-wrap leading-relaxed">
                                                                        {msg.text}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="p-4 text-center text-sm text-gray-500 italic">
                                                        No messages recorded for this session.
                                                    </div>
                                                )}
                                            </TabsContent>

                                            <TabsContent value="sessions" className="m-0">
                                                {user.sessions && user.sessions.length > 0 ? (
                                                    <div className="divide-y divide-white/5">
                                                        {user.sessions.map((session, i) => (
                                                            <div key={i} className="p-3 px-4 hover:bg-white/5 transition-colors flex items-center justify-between group">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-xs text-gray-400">Time Range</span>
                                                                        <span className="text-sm text-gray-200 font-mono">
                                                                            {format(new Date(session.start), 'HH:mm')} - {format(new Date(session.end), 'HH:mm')}
                                                                        </span>
                                                                    </div>
                                                                    <Separator orientation="vertical" className="h-8 bg-white/10" />
                                                                    <div className="flex flex-col">
                                                                        <span className="text-xs text-gray-400">Duration</span>
                                                                        <span className="text-sm text-gold-light font-medium flex items-center gap-1.5">
                                                                            <Timer className="w-3.5 h-3.5" />
                                                                            {session.durationFormatted}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <Badge variant="outline" className="border-white/10 text-gray-400 bg-white/5 text-[10px] h-6">
                                                                    {session.eventCount} events
                                                                </Badge>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="p-8 text-center text-sm text-gray-500 italic">
                                                        <Clock className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                                        No specific session segments recorded.
                                                    </div>
                                                )}
                                            </TabsContent>
                                        </Tabs>
                                    </CardContent>
                                </Card>
                            ))}

                            {(!selectedReport?.report_data?.users || selectedReport.report_data.users.length === 0) && (
                                <div className="text-center py-12 text-gray-400">
                                    <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>No user activity data available for this report.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
