import { NextResponse } from "next/server";
import { getSkillsForTemplate } from "@/lib/skills/registry";
import { getDefaultCronJobs, getCronJobs, saveCronJobs } from "@/lib/skills/cron-runner";
import { prisma } from "@/lib/db";
import { v4 as uuid } from "uuid";

/**
 * GET /api/agents/[id]/skills
 * Get skills and cron jobs for an agent
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const agent = await prisma.agent.findUnique({
      where: { id },
      select: { templateType: true, cronJobs: true, disabledSkills: true },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const disabledSkills = (agent as any).disabledSkills ? JSON.parse((agent as any).disabledSkills) as string[] : [];
    const skills = getSkillsForTemplate((agent as any).templateType);
    const cronJobs = await getCronJobs(id);
    const defaultCrons = getDefaultCronJobs(agent.templateType);

    return NextResponse.json({
      skills: skills.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        category: s.category,
        commandTag: s.commandTag,
        requiresWallet: s.requiresWallet,
        mutatesState: s.mutatesState,
        enabled: !disabledSkills.includes(s.id),
      })),
      cronJobs,
      defaultCronJobs: defaultCrons,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agents/[id]/skills
 * Add or update cron jobs for an agent
 * Body: { action: "add_cron" | "toggle_cron" | "remove_cron" | "init_defaults", ... }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const agent = await prisma.agent.findUnique({
      where: { id },
      select: { templateType: true, disabledSkills: true },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    switch (body.action) {
      case "init_defaults": {
        const defaults = getDefaultCronJobs(agent.templateType);
        const jobs = defaults.map((d) => ({
          ...d,
          id: uuid(),
          agentId: id,
        }));
        await saveCronJobs(id, jobs);
        return NextResponse.json({ cronJobs: jobs });
      }

      case "add_cron": {
        const existing = await getCronJobs(id);
        const newJob = {
          id: uuid(),
          agentId: id,
          name: body.name || "Custom Job",
          cron: body.cron || "*/30 * * * *",
          skillPrompt: body.skillPrompt || "",
          enabled: body.enabled ?? true,
        };
        existing.push(newJob);
        await saveCronJobs(id, existing);
        return NextResponse.json({ cronJob: newJob });
      }

      case "toggle_cron": {
        const jobs = await getCronJobs(id);
        const updated = jobs.map((j) =>
          j.id === body.jobId ? { ...j, enabled: !j.enabled } : j
        );
        await saveCronJobs(id, updated);
        return NextResponse.json({ cronJobs: updated });
      }

      case "remove_cron": {
        const jobs = await getCronJobs(id);
        const filtered = jobs.filter((j) => j.id !== body.jobId);
        await saveCronJobs(id, filtered);
        return NextResponse.json({ cronJobs: filtered });
      }

      case "toggle_skill": {
        const { skillId } = body;
        if (!skillId) {
          return NextResponse.json({ error: "skillId required" }, { status: 400 });
        }

        let disabledSkills = (agent as any).disabledSkills ? JSON.parse((agent as any).disabledSkills) as string[] : [];
        if (disabledSkills.includes(skillId)) {
          disabledSkills = disabledSkills.filter((s) => s !== skillId);
        } else {
          disabledSkills.push(skillId);
        }

        await prisma.agent.update({
          where: { id },
          data: { disabledSkills: JSON.stringify(disabledSkills) },
        });

        return NextResponse.json({ success: true, disabledSkills });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}

