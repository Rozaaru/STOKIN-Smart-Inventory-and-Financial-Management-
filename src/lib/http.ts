import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./errors";

/** Bungkus handler API: ubah error menjadi JSON dengan status yang tepat. */
export async function handle<T>(fn: () => Promise<T>, okStatus = 200) {
  try {
    const data = await fn();
    return NextResponse.json({ ok: true, data }, { status: okStatus });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json(
        { ok: false, error: e.message, code: e.code },
        { status: e.status },
      );
    }
    if (e instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: e.issues[0]?.message ?? "Input tidak valid",
          code: "VALIDATION",
          issues: e.issues,
        },
        { status: 422 },
      );
    }
    console.error(e);
    return NextResponse.json(
      { ok: false, error: "Terjadi kesalahan di server", code: "INTERNAL" },
      { status: 500 },
    );
  }
}
