import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";

export async function getAuthenticatedUserId(): Promise<string | null> {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    return typeof userId === "string" && userId.length > 0 ? userId : null;
  } catch (error) {
    console.error(
      "[auth-user] getServerSession failed, continuing as guest:",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}
