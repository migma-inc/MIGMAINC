import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Activity, Users, Calendar, BarChart3, MessageSquare, FileText, FileJson, FileCode, Clock, Coffee, AlertTriangle, ChevronRight, Download } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format, subDays, startOfDay } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { exportIdleDataToExcel } from '@/lib/slackIdleExport';
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

interface IdleStats {
    date: Date;
    users: {
        userId: string;
        userName: string;
        gapsCount: number;
        totalMinutes: number;
        totalHoursFormatted: string;
        gaps: { start: Date; end: Date; minutes: number }[];
    }[];
}

const USER_NAME_MAP: Record<string, string> = {
    'U0A7T9TCX8B': 'ADM MIGMA',
    'U0A83923VHA': 'Paulo Victor',
    'U0A8MHPPRPE': 'Larissa Costa',
    'U0A8WL16G9X': 'Miriã',
    'U0A9DQHUU04': 'Ceme Suaiden',
    'U0A9HSNRV6U': 'Alfeu Wartully',
    'U0A9XERBUGL': 'Vinicius Aguiar',
    'U0ABY0TGWBW': 'Arthur',
    'U0ACA4RG63E': 'Renata Nogueira',
    'U0AC7T8TBTM': 'Romulo Pimentel',
    'U0ABZ4SA7TN': 'Larissa Costa',
    'U0ABNH1RBUK': 'Thayrine Prado',
    'U0ACPRGVC3S': 'Vinicius Aguiar',
    'U0AC3EU30N8': 'Thayrine Prado',
    'U0AAFT96KKK': 'mentorclickup03'
};

export function SlackReportsPage() {
    const [reports, setReports] = useState<SlackReport[]>([]);
    const [idleData, setIdleData] = useState<IdleStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingIdle, setLoadingIdle] = useState(false);
    const [activeTab, setActiveTab] = useState('reports');
    const [daysToShow, setDaysToShow] = useState(7); // Período padrão: 7 dias
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
        fetchIdleStats();
    }, []);

    useEffect(() => {
        if (activeTab === 'idle') {
            fetchIdleStats();
        }
    }, [daysToShow, activeTab]);

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

    const fetchIdleStats = async () => {
        try {
            setLoadingIdle(true);

            const startDate = subDays(new Date(), daysToShow);
            console.log('🔍 Calculando gaps de ociosidade de', startOfDay(startDate).toISOString(), 'até', new Date().toISOString());

            // Calcular gaps diretamente no banco de dados usando SQL
            const { data: gapsData, error } = await supabase.rpc('calculate_idle_gaps', {
                start_date: startOfDay(startDate).toISOString(),
                end_date: new Date().toISOString(),
                min_gap_minutes: 30
            });

            if (error) {
                console.error('Erro ao calcular gaps:', error);
                // Fallback: se a função não existir, vamos criar ela
                console.log('⚠️ Função calculate_idle_gaps não encontrada. Usando query direta...');

                const { data: rawGaps, error: queryError } = await supabase.from('slack_raw_events').select(`
                    user_id,
                    slack_timestamp,
                    metadata
                `).gte('slack_timestamp', startOfDay(startDate).toISOString())
                    .lte('slack_timestamp', new Date().toISOString())
                    .order('user_id, slack_timestamp', { ascending: true });

                if (queryError) throw queryError;

                // Processar gaps no frontend como fallback
                const userEvents: Record<string, any[]> = {};
                (rawGaps || []).forEach(event => {
                    if (!userEvents[event.user_id]) userEvents[event.user_id] = [];
                    userEvents[event.user_id].push(event);
                });

                const dailyStats: Record<string, IdleStats> = {};

                Object.keys(userEvents).forEach(userId => {
                    const events = userEvents[userId];
                    for (let i = 1; i < events.length; i++) {
                        const prev = new Date(events[i - 1].slack_timestamp);
                        const curr = new Date(events[i].slack_timestamp);
                        const diffMinutes = (curr.getTime() - prev.getTime()) / (1000 * 60);

                        if (diffMinutes > 30) {
                            const dateKey = format(curr, 'yyyy-MM-dd');
                            if (!dailyStats[dateKey]) {
                                dailyStats[dateKey] = { date: startOfDay(curr), users: [] };
                            }

                            let userStat = dailyStats[dateKey].users.find(u => u.userId === userId);
                            if (!userStat) {
                                userStat = {
                                    userId,
                                    userName: USER_NAME_MAP[userId] || events[i].metadata?.userName || userId,
                                    gapsCount: 0,
                                    totalMinutes: 0,
                                    totalHoursFormatted: '0h 0m',
                                    gaps: []
                                };
                                dailyStats[dateKey].users.push(userStat);
                            }

                            userStat.gapsCount++;
                            userStat.totalMinutes += diffMinutes;
                            userStat.gaps.push({ start: prev, end: curr, minutes: diffMinutes });
                        }
                    }
                });

                const result = Object.values(dailyStats).map(day => {
                    day.users = day.users.map(u => {
                        const hours = Math.floor(u.totalMinutes / 60);
                        const mins = Math.round(u.totalMinutes % 60);
                        u.totalHoursFormatted = `${hours}h ${mins}m`;
                        return u;
                    }).sort((a, b) => b.totalMinutes - a.totalMinutes);
                    return day;
                }).sort((a, b) => b.date.getTime() - a.date.getTime());

                console.log('📅 Dados processados (fallback):', result.length, 'dias');
                setIdleData(result);
                return;
            }

            console.log('✅ Gaps calculados no servidor:', gapsData?.length || 0);

            // Processar dados retornados do servidor
            const dailyStats: Record<string, IdleStats> = {};

            (gapsData || []).forEach((gap: any) => {
                const gapStart = new Date(gap.gap_start);
                const gapEnd = new Date(gap.gap_end);

                // Apenas contar gaps que começam e terminam no mesmo dia
                const startDate = format(gapStart, 'yyyy-MM-dd');
                const endDate = format(gapEnd, 'yyyy-MM-dd');

                if (startDate !== endDate) {
                    // Gap atravessa dias - ignorar para evitar contagens acima de 24h
                    return;
                }

                // Ignorar usuários sem nome mapeado
                if (!USER_NAME_MAP[gap.user_id]) {
                    return;
                }

                const dateKey = endDate;
                if (!dailyStats[dateKey]) {
                    dailyStats[dateKey] = { date: startOfDay(gapEnd), users: [] };
                }

                let userStat = dailyStats[dateKey].users.find(u => u.userId === gap.user_id);
                if (!userStat) {
                    userStat = {
                        userId: gap.user_id,
                        userName: USER_NAME_MAP[gap.user_id],
                        gapsCount: 0,
                        totalMinutes: 0,
                        totalHoursFormatted: '0h 0m',
                        gaps: []
                    };
                    dailyStats[dateKey].users.push(userStat);
                }

                userStat.gapsCount++;
                userStat.totalMinutes += gap.gap_minutes;
                userStat.gaps.push({
                    start: gapStart,
                    end: gapEnd,
                    minutes: gap.gap_minutes
                });
            });

            // Formatação final
            const result = Object.values(dailyStats).map(day => {
                day.users = day.users.map(u => {
                    const hours = Math.floor(u.totalMinutes / 60);
                    const mins = Math.round(u.totalMinutes % 60);
                    u.totalHoursFormatted = `${hours}h ${mins}m`;
                    return u;
                }).sort((a, b) => b.totalMinutes - a.totalMinutes);
                return day;
            }).sort((a, b) => b.date.getTime() - a.date.getTime());

            console.log('📅 Dias com dados:', result.length);
            setIdleData(result);
        } catch (error) {
            console.error('Error fetching idle stats:', error);
        } finally {
            setLoadingIdle(false);
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
            <div className="p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in duration-500">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-4">
                        <Skeleton className="h-10 w-64" />
                        <Skeleton className="h-4 w-96 hidden md:block" />
                    </div>
                    <Skeleton className="h-10 w-32" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <Card key={i} className="bg-zinc-900/40 border-white/5 p-6 space-y-4">
                            <Skeleton className="h-4 w-32" />
                            <div className="flex items-center gap-3">
                                <Skeleton className="h-8 w-8 rounded" />
                                <Skeleton className="h-8 w-24" />
                            </div>
                            <Skeleton className="h-3 w-40" />
                        </Card>
                    ))}
                </div>

                <Card className="bg-zinc-900/40 border-white/5">
                    <CardHeader>
                        <Skeleton className="h-6 w-48" />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex gap-4 border-b border-white/5 pb-4">
                                {[1, 2, 3, 4].map(i => (
                                    <Skeleton key={i} className="h-4 flex-1" />
                                ))}
                            </div>
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="flex gap-4 items-center">
                                    <Skeleton className="h-5 flex-1" />
                                    <Skeleton className="h-5 flex-1" />
                                    <Skeleton className="h-5 flex-1" />
                                    <div className="flex-1 flex justify-end gap-2">
                                        <Skeleton className="h-8 w-8" />
                                        <Skeleton className="h-8 w-8" />
                                        <Skeleton className="h-8 w-20" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
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

            {latestReport && activeTab === 'reports' && (
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

            <Tabs defaultValue="reports" className="w-full" onValueChange={setActiveTab}>
                <TabsList className="bg-black/40 border border-white/5 p-1 mb-6">
                    <TabsTrigger value="reports" className="data-[state=active]:bg-gold-medium data-[state=active]:text-black">
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Historical Reports
                    </TabsTrigger>
                    <TabsTrigger value="idle" className="data-[state=active]:bg-gold-medium data-[state=active]:text-black">
                        <Clock className="w-4 h-4 mr-2" />
                        Idle Monitoring
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="reports" className="space-y-6">
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
                </TabsContent>

                <TabsContent value="idle" className="space-y-6">
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-white">Idle Analysis</h3>
                            <p className="text-sm text-gray-400 mt-1">
                                Periods without activity over 30 minutes
                            </p>
                        </div>
                        <div className="flex gap-2">
                            {[7, 15, 30].map((days) => (
                                <button
                                    key={days}
                                    onClick={() => setDaysToShow(days)}
                                    className={cn(
                                        "px-4 py-2 rounded-lg font-bold text-sm transition-all",
                                        daysToShow === days
                                            ? "bg-gold-medium text-black"
                                            : "bg-black/40 border border-white/10 text-white hover:bg-white/5 hover:text-gold-light"
                                    )}
                                >
                                    {days} days
                                </button>
                            ))}
                            <div className="w-px bg-white/10 mx-2" />
                            <button
                                onClick={() => exportIdleDataToExcel(idleData, daysToShow)}
                                disabled={idleData.length === 0 || loadingIdle}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600/80 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all"
                                title="Exportar para Excel"
                            >
                                <Download className="w-4 h-4" />
                                Excel
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-6">
                        {loadingIdle ? (
                            <div className="space-y-4">
                                {[1, 2, 3].map(i => (
                                    <Card key={i} className="bg-zinc-900/40 border-white/5 p-6">
                                        <Skeleton className="h-6 w-48 mb-4" />
                                        <div className="space-y-2">
                                            <Skeleton className="h-10 w-full" />
                                            <Skeleton className="h-10 w-full" />
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            idleData.map((day) => (
                                <Card key={day.date.toISOString()} className="bg-gradient-to-br from-zinc-900/80 to-black border border-white/5 overflow-hidden">
                                    <div className="p-4 bg-white/5 border-b border-white/5 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Calendar className="w-5 h-5 text-gold-light" />
                                            <h3 className="font-bold text-lg text-white">
                                                {format(day.date, 'PPPP', { locale: undefined })}
                                            </h3>
                                        </div>
                                        <Badge variant="outline" className="bg-gold-medium/10 text-gold-light border-gold-medium/30">
                                            {day.users.length} Active Users
                                        </Badge>
                                    </div>
                                    <CardContent className="p-0">
                                        <div className="divide-y divide-white/5">
                                            {day.users.map((user) => (
                                                <div key={user.userId} className="p-4 hover:bg-white/5 transition-colors group">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gold-medium/20 to-gold-dark/20 flex items-center justify-center text-gold-light font-bold text-xl border border-gold-medium/20">
                                                                {user.userName.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <h4 className="text-white font-bold text-lg flex items-center gap-2">
                                                                    {user.userName}
                                                                    {user.totalMinutes > 480 && (
                                                                        <span title="High idle time detected">
                                                                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                                                                        </span>
                                                                    )}
                                                                </h4>
                                                                <p className="text-xs text-gray-500 font-mono">{user.userId}</p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-6">
                                                            <div className="text-right">
                                                                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Idle Periods</p>
                                                                <div className="flex items-center justify-end gap-2 text-white font-bold">
                                                                    <Coffee className="w-4 h-4 text-gold-medium" />
                                                                    {user.gapsCount} breaks
                                                                </div>
                                                            </div>
                                                            <div className="text-right min-w-[120px]">
                                                                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Total Time</p>
                                                                <div className="text-xl font-black text-gold-light">
                                                                    {user.totalHoursFormatted}
                                                                </div>
                                                            </div>
                                                            <div className="hidden sm:block">
                                                                <ChevronRight className="w-5 h-5 text-gray-700 group-hover:text-gold-light transition-colors" />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Detalhes das pausas (mini timeline) */}
                                                    <div className="mt-4 flex gap-1 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                        {user.gaps.map((gap, idx) => (
                                                            <div
                                                                key={idx}
                                                                className={cn(
                                                                    "h-full rounded-full transition-all",
                                                                    gap.minutes > 120 ? "bg-red-500" : gap.minutes > 60 ? "bg-amber-500" : "bg-gold-medium"
                                                                )}
                                                                style={{ width: `${Math.min((gap.minutes / 480) * 100, 50)}%` }}
                                                                title={`Start: ${format(gap.start, 'HH:mm')} - End: ${format(gap.end, 'HH:mm')} (${Math.round(gap.minutes)} min)`}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}

                        {!loadingIdle && idleData.length === 0 && (
                            <div className="flex flex-col items-center justify-center p-12 text-center bg-zinc-900/40 border border-dashed border-white/10 rounded-xl">
                                <Activity className="w-12 h-12 text-gray-600 mb-4" />
                                <h3 className="text-lg font-bold text-white">No idle data found</h3>
                                <p className="text-gray-400 mt-2 max-w-sm">
                                    There are no records of inactivity over 30 minutes linked to users in the logs from recent days.
                                </p>
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>

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
