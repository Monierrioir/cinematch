import { hash } from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getPrismaClientSafe, getPrismaInitErrorMessage } from "@/lib/prisma";

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().email(),
  password: z.string().min(8).max(72)
});

export async function POST(request: NextRequest) {
  const clientKey = request.headers.get("x-forwarded-for") ?? request.ip ?? "anonymous";
  const rate = consumeRateLimit(`register:${clientKey}`, 12, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many signup attempts. Please try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfterSeconds)
        }
      }
    );
  }

  try {
    const prisma = getPrismaClientSafe();
    if (!prisma) {
      return NextResponse.json(
        {
          error: "Service temporarily unavailable.",
          details: getPrismaInitErrorMessage() ?? "Prisma client is not initialized."
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid registration payload.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    const passwordHash = await hash(parsed.data.password, 12);
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name ?? null,
        email,
        passwordHash,
        profile: {
          create: {}
        }
      },
      select: {
        id: true,
        email: true,
        name: true
      }
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to register user.",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
