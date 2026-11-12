import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { handle } from "@/lib/http";
import { AppError } from "@/lib/errors";
import { loginSchema } from "@/lib/schemas";
import { createSession, destroySession } from "@/lib/auth";

export async function POST(req: Request) {
  return handle(async () => {
    const input = loginSchema.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    // Pesan sama untuk email salah / password salah (jangan bocorkan email mana yang terdaftar)
    const valid = user && (await bcrypt.compare(input.password, user.passwordHash));
    if (!user || !valid) throw new AppError("Email atau password salah", 401, "BAD_CREDENTIALS");

    await createSession({ userId: user.id, businessId: user.businessId, role: user.role });
    return { id: user.id, role: user.role };
  });
}

export async function DELETE() {
  return handle(async () => {
    await destroySession();
    return {};
  });
}
