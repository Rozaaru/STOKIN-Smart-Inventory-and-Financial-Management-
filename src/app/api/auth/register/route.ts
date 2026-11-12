import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { handle } from "@/lib/http";
import { AppError } from "@/lib/errors";
import { registerSchema } from "@/lib/schemas";
import { createSession } from "@/lib/auth";

// Mendaftar = membuat usaha baru + akun OWNER pertamanya.
export async function POST(req: Request) {
  return handle(async () => {
    const input = registerSchema.parse(await req.json());
    const email = input.email.toLowerCase();

    if (await prisma.user.findUnique({ where: { email } })) {
      throw new AppError("Email sudah terdaftar", 409, "EMAIL_TAKEN");
    }
    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = await prisma.user.create({
      data: {
        name: input.name,
        email,
        passwordHash,
        role: "OWNER",
        business: { create: { name: input.businessName, type: input.businessType } },
      },
    });
    await createSession({ userId: user.id, businessId: user.businessId, role: "OWNER" });
    return { id: user.id, businessId: user.businessId };
  }, 201);
}
