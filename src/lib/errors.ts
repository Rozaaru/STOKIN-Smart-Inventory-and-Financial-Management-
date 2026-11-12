export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "BAD_REQUEST",
  ) {
    super(message);
  }
}

export class InsufficientStockError extends AppError {
  constructor(productName: string, available: number, requested: number) {
    super(
      `Stok "${productName}" tidak cukup (tersedia ${available}, diminta ${requested})`,
      409,
      "INSUFFICIENT_STOCK",
    );
  }
}

export class NotFoundError extends AppError {
  constructor(what = "Data") {
    super(`${what} tidak ditemukan`, 404, "NOT_FOUND");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Silakan login terlebih dahulu") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Anda tidak punya akses untuk ini") {
    super(message, 403, "FORBIDDEN");
  }
}
