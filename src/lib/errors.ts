export class AuthorizationError extends Error {
  constructor(message = "Bạn không có quyền thực hiện thao tác này.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Không tìm thấy dữ liệu.") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class BookingConflictError extends Error {
  suggestions: string[];

  constructor(message: string, suggestions: string[] = []) {
    super(message);
    this.name = "BookingConflictError";
    this.suggestions = suggestions;
  }
}
