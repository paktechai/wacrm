"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, ListTodo, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: "open" | "in_progress" | "done" | "cancelled";
  priority: "low" | "normal" | "high" | "urgent";
  due_at?: string | null;
  created_at: string;
};

type Appointment = {
  id: string;
  title: string;
  notes?: string | null;
  starts_at: string;
  ends_at: string;
  timezone: string;
  status: "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";
};

export default function CrmWorkspacePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingTask, setCreatingTask] = useState(false);
  const [creatingAppointment, setCreatingAppointment] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [taskRes, appointmentRes] = await Promise.all([
        fetch("/api/crm/tasks", { cache: "no-store" }),
        fetch("/api/crm/appointments", { cache: "no-store" }),
      ]);
      const [taskJson, appointmentJson] = await Promise.all([
        taskRes.json(),
        appointmentRes.json(),
      ]);
      if (!taskRes.ok) throw new Error(taskJson?.error || "Could not load tasks");
      if (!appointmentRes.ok)
        throw new Error(appointmentJson?.error || "Could not load appointments");
      setTasks(taskJson.tasks ?? []);
      setAppointments(appointmentJson.appointments ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load CRM workspace");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const open = tasks.filter((task) => task.status === "open" || task.status === "in_progress").length;
    const overdue = tasks.filter(
      (task) => task.status !== "done" && task.due_at && new Date(task.due_at).getTime() < Date.now(),
    ).length;
    const upcoming = appointments.filter(
      (item) =>
        !["completed", "cancelled", "no_show"].includes(item.status) &&
        new Date(item.starts_at).getTime() >= Date.now(),
    ).length;
    return { open, overdue, upcoming };
  }, [tasks, appointments]);

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creatingTask) return;
    const form = new FormData(event.currentTarget);
    setCreatingTask(true);
    try {
      const response = await fetch("/api/crm/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          priority: form.get("priority"),
          dueAt: form.get("dueAt") || null,
          description: form.get("description"),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Could not create task");
      event.currentTarget.reset();
      setTasks((previous) => [payload.task, ...previous]);
      toast.success("Task created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create task");
    } finally {
      setCreatingTask(false);
    }
  }

  async function toggleTask(task: Task) {
    const next = task.status === "done" ? "open" : "done";
    setTasks((items) => items.map((item) => (item.id === task.id ? { ...item, status: next } : item)));
    try {
      const response = await fetch(`/api/crm/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Could not update task");
      setTasks((items) => items.map((item) => (item.id === task.id ? payload.task : item)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update task");
      void load();
    }
  }

  async function createAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creatingAppointment) return;
    const form = new FormData(event.currentTarget);
    const startsAt = String(form.get("startsAt") || "");
    const duration = Number(form.get("duration") || 30);
    const startDate = new Date(startsAt);
    const endsAt = new Date(startDate.getTime() + Math.max(15, duration) * 60000);
    setCreatingAppointment(true);
    try {
      const response = await fetch("/api/crm/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("appointmentTitle"),
          startsAt: startDate.toISOString(),
          endsAt: endsAt.toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          notes: form.get("notes"),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Could not create appointment");
      event.currentTarget.reset();
      setAppointments((previous) => [...previous, payload.appointment].sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at)));
      toast.success("Appointment scheduled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create appointment");
    } finally {
      setCreatingAppointment(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">SBYT CRM 2.0</div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">Work & follow-ups</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Tasks, reminders and appointments live beside conversations and deals so nothing falls through the cracks.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric icon={<ListTodo className="size-4" />} label="Open tasks" value={stats.open} />
        <Metric icon={<Clock3 className="size-4" />} label="Overdue" value={stats.overdue} />
        <Metric icon={<CalendarDays className="size-4" />} label="Upcoming appointments" value={stats.upcoming} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border p-5">
            <h2 className="font-semibold text-foreground">Tasks & follow-ups</h2>
            <form onSubmit={createTask} className="mt-4 grid gap-3 sm:grid-cols-2">
              <input name="title" required maxLength={200} placeholder="Follow-up title" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <select name="priority" defaultValue="normal" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary">
                <option value="low">Low priority</option><option value="normal">Normal priority</option><option value="high">High priority</option><option value="urgent">Urgent</option>
              </select>
              <input name="dueAt" type="datetime-local" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <input name="description" placeholder="Short note (optional)" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <button disabled={creatingTask} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:col-span-2">
                <Plus className="size-4" /> {creatingTask ? "Creating…" : "Add task"}
              </button>
            </form>
          </div>
          <div className="divide-y divide-border">
            {tasks.map((task) => (
              <button key={task.id} type="button" onClick={() => void toggleTask(task)} className="flex w-full items-start gap-3 p-4 text-left hover:bg-muted/30">
                <CheckCircle2 className={`mt-0.5 size-5 shrink-0 ${task.status === "done" ? "text-emerald-400" : "text-muted-foreground"}`} />
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-medium ${task.status === "done" ? "text-muted-foreground line-through" : "text-foreground"}`}>{task.title}</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="capitalize">{task.priority}</span>
                    {task.due_at ? <span>{new Date(task.due_at).toLocaleString()}</span> : null}
                    <span className="capitalize">{task.status.replace("_", " ")}</span>
                  </div>
                </div>
              </button>
            ))}
            {!loading && tasks.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">No tasks yet.</div> : null}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border p-5">
            <h2 className="font-semibold text-foreground">Appointments</h2>
            <form onSubmit={createAppointment} className="mt-4 grid gap-3 sm:grid-cols-2">
              <input name="appointmentTitle" required maxLength={200} placeholder="Appointment title" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <input name="startsAt" required type="datetime-local" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <select name="duration" defaultValue="30" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary">
                <option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">60 minutes</option><option value="90">90 minutes</option>
              </select>
              <input name="notes" placeholder="Notes (optional)" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <button disabled={creatingAppointment} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:col-span-2">
                <Plus className="size-4" /> {creatingAppointment ? "Scheduling…" : "Schedule appointment"}
              </button>
            </form>
          </div>
          <div className="divide-y divide-border">
            {appointments.map((item) => (
              <div key={item.id} className="flex gap-3 p-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarDays className="size-4" /></div>
                <div>
                  <div className="text-sm font-medium text-foreground">{item.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{new Date(item.starts_at).toLocaleString()} · {item.timezone}</div>
                  <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{item.status}</div>
                </div>
              </div>
            ))}
            {!loading && appointments.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">No appointments scheduled.</div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{label}</span><span className="text-primary">{icon}</span></div>
      <div className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-foreground">{value}</div>
    </div>
  );
}
