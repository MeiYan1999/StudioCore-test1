import { ShareUnavailable } from "@/components/share/share-unavailable";

export default function ShareNotFound() {
  return (
    <ShareUnavailable
      title="Không tìm thấy album"
      description="Link không đúng hoặc album đã bị xóa. Vui lòng kiểm tra lại link studio đã gửi."
    />
  );
}
