import type { CustomerApiError } from '../types';

export function normalizeCustomerError(status: number, data?: any): CustomerApiError {
  const code = data?.code;
  const isGuestError = status === 403 && code === 'GUEST_NOT_PERMITTED';
  const isSessionExpired = status === 401;

  let message = 'เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณาลองใหม่อีกครั้ง';

  if (isGuestError) {
    message = 'กรุณายืนยันตัวตนเพื่อดูประวัติการแจ้งปัญหา';
  } else if (isSessionExpired) {
    message = 'เซสชันหมดอายุ กรุณาเชื่อมต่อใหม่อีกครั้ง';
  } else if (status === 403) {
    message = 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลส่วนนี้';
  } else if (status === 404) {
    message = 'ไม่พบรายการตั๋วที่คุณค้นหา';
  } else if (status === 409) {
    message = 'สถานะของรายการมีการเปลี่ยนแปลง กรุณารีเฟรชเพื่อดูข้อมูลล่าสุด';
  } else if (status === 429) {
    message = 'คุณทำรายการบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง';
  } else if (status >= 500) {
    message = 'ระบบกำลังปรับปรุงชั่วคราว กรุณาลองใหม่อีกครั้งในภายหลัง';
  }

  return {
    status,
    code,
    message,
    isGuestError,
    isSessionExpired,
  };
}
