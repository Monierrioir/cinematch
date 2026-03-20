import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUserId } from "@/lib/auth-user";
import { getPrismaClientSafe, getPrismaInitErrorMessage } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";

const updateProfileSchema = z.object({
  preferredMediaType: z.enum(["movie", "tv"]).nullable().optional(),
  preferredLanguage: z.string().max(8).nullable().optional(),
  favoriteGenreIds: z.array(z.number()).max(12).optional()
});

export async function GET(request: NextRequest) {
  const clientKey = request.headers.get("x-forwarded-for") ?? request.ip ?? "anonymous";
  const rate = consumeRateLimit(`profile:get:${clientKey}`, 40, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many profile requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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

  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  return NextResponse.json({ profile });
}

export async function PATCH(request: NextRequest) {
  const clientKey = request.headers.get("x-forwarded-for") ?? request.ip ?? "anonymous";
  const rate = consumeRateLimit(`profile:patch:${clientKey}`, 20, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many profile updates. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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

  try {
    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid profile payload." }, { status: 400 });
    }

    const profile = await prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        preferredMediaType: parsed.data.preferredMediaType ?? null,
        preferredLanguage: parsed.data.preferredLanguage ?? null,
        favoriteGenreIds: parsed.data.favoriteGenreIds ?? []
      },
      update: {
        preferredMediaType: parsed.data.preferredMediaType ?? undefined,
        preferredLanguage: parsed.data.preferredLanguage ?? undefined,
        favoriteGenreIds: parsed.data.favoriteGenreIds ?? undefined
      }
    });

    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to update profile.",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
