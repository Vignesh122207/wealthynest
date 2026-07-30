import {useState} from "react";
import {Activity, Check, CheckCircle2, Clock, Loader2, Pencil, Play, RefreshCw, XCircle} from "lucide-react";
import {useAdminJobs, useSystemHealth, useTriggerJob, useUpdateJobSchedule} from "@/features/admin/hooks/useAdmin";
import type {JobScheduleConfig} from "@/features/admin/api/admin.api";
import {cn} from "@/lib/utils";

// Same status vocabulary as JobStatusBadge below, but Actuator health components report
// UP/DOWN/OUT_OF_SERVICE/UNKNOWN, not SUCCESS/FAILED/RUNNING — a separate small map rather than
// bending one map to cover both vocabularies.
function HealthStatusPill({ status }: { status: string }) {
  const isUp = status === "UP";
  return (
    <span className={cn(
      "inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full",
      isUp ? "bg-emerald-500/15 text-emerald-500" : "bg-red-500/15 text-red-500"
    )}>
      {isUp ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {status}
    </span>
  );
}

function SystemHealthCard() {
  const { data, isFetching, isError, error, refetch } = useSystemHealth();
  const checked = data !== undefined || isError;
  const errorStatus = (error as { response?: { status?: number } } | null)?.response?.status;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">System Health</h2>
          {checked && !isError && data && <HealthStatusPill status={data.status} />}
        </div>
        <button onClick={() => refetch()} disabled={isFetching}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-600/15 text-indigo-500 hover:bg-indigo-600/25 border border-indigo-500/20 transition-colors disabled:opacity-50">
          {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {checked ? "Refresh" : "Check now"}
        </button>
      </div>
      {isError && (
        <p className="px-4 py-4 text-sm text-red-500">
          {errorStatus === 403 ? "Admin access required." : "Couldn't reach the health endpoint."}
        </p>
      )}
      {data?.components && (
        <div className="divide-y divide-border">
          {Object.entries(data.components).map(([name, component]) => (
            <div key={name} className="px-4 py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{name}</p>
                {component.details && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {Object.entries(component.details).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                  </p>
                )}
              </div>
              <HealthStatusPill status={component.status} />
            </div>
          ))}
        </div>
      )}
      {!checked && !isFetching && (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">Click &quot;Check now&quot; to fetch live status</p>
      )}
    </div>
  );
}

function JobStatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-xs text-muted-foreground">Never run</span>;
  const map: Record<string, { cls: string; Icon: React.ElementType; label: string }> = {
    SUCCESS: { cls: "text-emerald-500", Icon: CheckCircle2, label: "Success" },
    FAILED:  { cls: "text-red-500",     Icon: XCircle,      label: "Failed" },
    RUNNING: { cls: "text-amber-500",   Icon: Loader2,      label: "Running" },
  };
  const s = map[status] ?? map.FAILED;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", s.cls)}>
      <s.Icon className={cn("w-3.5 h-3.5", status === "RUNNING" && "animate-spin")} />
      {s.label}
    </span>
  );
}

function CronEditor({ job, onSave }: { job: JobScheduleConfig; onSave: (cron: string) => void }) {
  const parts   = job.cronExpression.split(" ");
  const initH   = parts[2] ?? "20";
  const initM   = parts[1] ?? "0";
  const isRange = initH.includes("-") || initH.includes("/") || initM.includes("/");
  const [open, setOpen] = useState(false);
  const [h, setH]       = useState(isRange ? "" : initH.padStart(2, "0"));
  const [m, setM]       = useState(isRange ? "" : initM.padStart(2, "0"));
  const [raw, setRaw]   = useState(job.cronExpression);
  const [mode, setMode] = useState<"simple" | "raw">(isRange ? "raw" : "simple");

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <Clock className="w-3.5 h-3.5" />{job.cronExpression}<Pencil className="w-3 h-3 opacity-60" />
      </button>
    );
  }

  function buildCron() {
    if (mode === "raw") return raw.trim();
    parts[1] = String(parseInt(m, 10));
    parts[2] = String(parseInt(h, 10));
    return parts.join(" ");
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex gap-1 text-xs border border-border rounded-md overflow-hidden">
        <button onClick={() => setMode("simple")} className={cn("px-2 py-1 transition-colors", mode === "simple" ? "bg-indigo-500/20 text-indigo-400" : "hover:bg-muted text-muted-foreground")}>Time</button>
        <button onClick={() => setMode("raw")} className={cn("px-2 py-1 transition-colors", mode === "raw" ? "bg-indigo-500/20 text-indigo-400" : "hover:bg-muted text-muted-foreground")}>Cron</button>
      </div>
      {mode === "simple" ? (
        <div className="flex items-center gap-1">
          <input type="number" min={0} max={23} value={h} onChange={e => setH(e.target.value.padStart(2, "0"))}
            className="w-12 text-xs text-center bg-background border border-border rounded-xl px-1 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
          <span className="text-muted-foreground text-xs">:</span>
          <input type="number" min={0} max={59} value={m} onChange={e => setM(e.target.value.padStart(2, "0"))}
            className="w-12 text-xs text-center bg-background border border-border rounded-xl px-1 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
          <span className="text-[10px] text-muted-foreground">IST</span>
        </div>
      ) : (
        <input value={raw} onChange={e => setRaw(e.target.value)}
          className="w-44 text-xs bg-background border border-border rounded-xl px-2 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40 font-mono" />
      )}
      <button onClick={() => { onSave(buildCron()); setOpen(false); }}
        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500 hover:text-emerald-400 px-2 py-1 rounded-lg hover:bg-emerald-500/10 transition-colors">
        <Check className="w-3.5 h-3.5" /> Save
      </button>
      <button onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1">Cancel</button>
    </div>
  );
}

export function JobsTab() {
  const { data: jobs = [], isLoading }                                        = useAdminJobs();
  const { mutate: trigger, isPending: triggering, variables: triggeringJob }  = useTriggerJob();
  const { mutate: updateSchedule }                                            = useUpdateJobSchedule();

  return (
    <div className="space-y-4">
      <SystemHealthCard />
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Scheduled Jobs</h2>
        {isLoading && <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />}
      </div>
      <div className="divide-y divide-border">
        {jobs.map((job: JobScheduleConfig) => (
          <div key={job.jobName} className="px-4 py-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{job.displayName}</p>
                <CronEditor job={job} onSave={cron => updateSchedule({ jobName: job.jobName, cron })} />
              </div>
              <button onClick={() => trigger(job.jobName)} disabled={triggering && triggeringJob === job.jobName}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-600/15 text-indigo-500 hover:bg-indigo-600/25 border border-indigo-500/20 transition-colors disabled:opacity-50 shrink-0">
                {triggering && triggeringJob === job.jobName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Run now
              </button>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <JobStatusBadge status={job.lastRunStatus} />
              {job.lastRunAt && <span>{new Date(job.lastRunAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
              {job.lastRunMessage && <span className="text-red-400 truncate max-w-[200px]" title={job.lastRunMessage}>{job.lastRunMessage}</span>}
            </div>
          </div>
        ))}
        {jobs.length === 0 && !isLoading && <p className="px-4 py-8 text-center text-sm text-muted-foreground">No jobs configured</p>}
      </div>
      </div>
    </div>
  );
}
