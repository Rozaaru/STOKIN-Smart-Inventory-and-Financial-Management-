import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { ForbiddenError, UnauthorizedError } from "./errors";

export interface Session {
  userId: string;
  businessId: string;
  role: "OWNER" | "STAFF";
}

const COOKIE = "stokin_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 hari

function secretKey() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET harus diisi (minimal 32 karakter)");
  return new TextEncoder().encode(s);
}

export async function createSession(session: Session) {
  const token = await new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secretKey());
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return {
      userId: String(payload.userId),
      businessId: String(payload.businessId),
      role: payload.role === "OWNER" ? "OWNER" : "STAFF",
    };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new UnauthorizedError();
  return s;
}

/** STAFF hanya boleh input transaksi; laporan keuangan & pengaturan khusus OWNER. */
export async function requireOwner(): Promise<Session> {
  const s = await requireSession();
  if (s.role !== "OWNER") throw new ForbiddenError("Hanya pemilik usaha yang boleh mengakses ini");
  return s;
}
