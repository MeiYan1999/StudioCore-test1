export default function DriveNotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="max-w-md text-center">
        <h1 className="mb-3 text-2xl font-semibold">Không tìm thấy link</h1>
        <p className="text-muted-foreground">
          Link không tồn tại hoặc đã được studio thu hồi. Vui lòng liên hệ studio để nhận link mới.
        </p>
      </div>
    </main>
  );
}
