
import React from "react";
import { prisma } from "@/lib/db";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Activity,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    Info,
    RefreshCw,
    Terminal,
    Search
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

function activityIcon(type: string) {
    switch (type) {
        case "action": return <CheckCircle className="w-5 h-5 text-forest" />;
        case "error": return <XCircle className="w-5 h-5 text-red-500" />;
        case "warning": return <AlertCircle className="w-5 h-5 text-amber-500" />;
        default: return <Info className="w-5 h-5 text-blue-500" />;
    }
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LogsPage() {
    const logs = await prisma.activityLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
            agent: {
                select: {
                    name: true,
                    id: true,
                }
            }
        }
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-forest uppercase tracking-tight flex items-center gap-3 italic">
                        <Terminal className="w-8 h-8" />
                        System Debug Logs
                    </h1>
                    <p className="text-forest-muted mt-1 max-w-2xl font-mono">
                        Real-time activity and errors across the AgentHaus platform. Use this to monitor Master Bot responsiveness and skill execution.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link href="/dashboard/logs">
                        <button className="flex items-center gap-2 px-4 py-2 bg-celo text-forest border-2 border-forest rounded-none font-bold uppercase neobrutal-shadow hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all">
                            <RefreshCw className="w-4 h-4" />
                            Refresh
                        </button>
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Stats Column */}
                <div className="lg:col-span-1 space-y-4">
                    <Card className="bg-celo/5 border-2 border-forest rounded-none neobrutal-shadow">
                        <CardHeader className="pb-2">
                            <h3 className="text-lg font-bold text-forest uppercase italic">Platform Health</h3>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center p-3 bg-gypsum border-2 border-forest">
                                    <span className="text-sm font-bold uppercase">Errors (24h)</span>
                                    <span className="text-xl font-bold text-red-500">
                                        {logs.filter(l => l.type === 'error').length}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-gypsum border-2 border-forest">
                                    <span className="text-sm font-bold uppercase">Success Actions</span>
                                    <span className="text-xl font-bold text-forest">
                                        {logs.filter(l => l.type === 'action').length}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-gypsum border-2 border-forest">
                                    <span className="text-sm font-bold uppercase">Total Checked</span>
                                    <span className="text-xl font-bold text-forest">{logs.length}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-forest text-gypsum border-2 border-forest rounded-none neobrutal-shadow">
                        <CardContent className="pt-6">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-6 h-6 text-celo flex-shrink-0" />
                                <div>
                                    <h4 className="font-bold uppercase mb-1">Developer Tip</h4>
                                    <p className="text-sm text-gypsum/80 font-mono">
                                        Filter by <strong>"system"</strong> agent to see Master Bot routing errors. Check metadata for LLM usage details.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Logs Column */}
                <div className="lg:col-span-2 space-y-4">
                    <Card className="border-2 border-forest rounded-none neobrutal-shadow">
                        <CardHeader className="border-b-2 border-forest/10 p-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold uppercase italic flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-celo" />
                                    Live Feed
                                </h3>
                                <div className="flex gap-2">
                                    <Badge variant="outline" className="text-[10px] rounded-none border-forest font-bold">LATEST 100</Badge>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y-2 divide-forest/5 max-h-[600px] overflow-auto">
                                {logs.length === 0 ? (
                                    <div className="text-center py-20 bg-gypsum-dark/10">
                                        <Terminal className="w-12 h-12 text-forest/20 mx-auto mb-4" />
                                        <p className="text-forest-muted font-mono font-bold uppercase">No logs detected in the system.</p>
                                    </div>
                                ) : (
                                    logs.map((log) => (
                                        <div key={log.id} className="group p-4 hover:bg-celo/5 transition-colors">
                                            <div className="flex items-start gap-4">
                                                <div className="mt-1 flex-shrink-0">
                                                    {activityIcon(log.type)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2 mb-1">
                                                        <span className={`text-xs font-bold uppercase px-1.5 py-0.5 border border-forest ${log.agentId === 'system' ? 'bg-forest text-celo' : 'bg-gypsum text-forest'
                                                            }`}>
                                                            {log.agentId === 'system' ? 'SYSTEM' : log.agent?.name || 'UNKNOWN'}
                                                        </span>
                                                        <span className="text-[10px] text-forest-muted font-mono flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {formatDate(log.createdAt)}
                                                        </span>
                                                    </div>
                                                    <p className={`text-sm font-mono leading-relaxed ${log.type === 'error' ? 'text-red-500 font-bold' : 'text-forest'
                                                        }`}>
                                                        {log.message}
                                                    </p>
                                                    {log.metadata && (
                                                        <div className="mt-2 p-2 bg-gypsum-dark/30 border border-forest/10 rounded font-mono text-[10px] text-forest-muted break-all">
                                                            <div className="flex items-center gap-1 mb-1 opacity-50 uppercase font-bold">
                                                                <Search className="w-3 h-3" />
                                                                Metadata
                                                            </div>
                                                            {log.metadata}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
