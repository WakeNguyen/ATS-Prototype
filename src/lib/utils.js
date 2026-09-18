import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

const MONTH_ABBR_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Trả về "31 - Aug - 2026" — chỉ phần ngày, không có giờ
export function formatDateVN(dateInput) {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  return `${d.getDate()} - ${MONTH_ABBR_EN[d.getMonth()]} - ${d.getFullYear()}`;
}

// Trả về "31 - Aug - 2026 21:52:55" — ngày + giờ 24h có giây
export function formatDateTimeVN(dateInput) {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${formatDateVN(d)} ${hh}:${mm}:${ss}`;
}

// Trả về "21:52:55" — chỉ giờ:phút:giây theo giờ địa phương trình duyệt, dùng cho created_time
export function formatTimeVN(dateInput) {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

// Chuan hoa chuoi tieng Viet co dau thanh khong dau + lowercase, dung cho MOI noi filter/search
// client-side JS thuan (KHONG thay the unaccent() o tang SQL — 2 lop rieng biet).
export function stripAccents(str) {
  if (!str) return "";
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

// Chuan hoa gia tri contact point de kiem tra trung lap
export function normalizeContactValue(type, rawValue) {
  if (!rawValue) return "";
  const t = (type || "").toLowerCase().trim();
  const val = String(rawValue).trim();
  
  if (t.includes("email") || t.includes("mail")) {
    return val.toLowerCase();
  }
  
  if (t.includes("phone") || t.includes("tel") || t.includes("mobile") || t.includes("call")) {
    let digits = val.replace(/[^\d+]/g, "");
    if (digits.startsWith("0")) {
      digits = "+84" + digits.slice(1);
    } else if (!digits.startsWith("+")) {
      digits = "+84" + digits;
    }
    const digitCount = digits.replace(/\D/g, "").length; // dem chu so that, bo dau +
    if (digitCount < 8 || digitCount > 12) {
      return ""; 
    }
    return digits;
  }
  
  // Facebook profile.php URLs mã hoá định danh DUY NHẤT trong query string (?id=...),
  // khác với các URL khác nơi query string chỉ là noise (tracking param) — không được cắt bỏ.
  if (/facebook\.com\/profile\.php/i.test(val)) {
    const idMatch = val.match(/id=(\d+)/);
    let cleanBase = val
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .replace(/\/+$/, "")
      .toLowerCase();
    const pathOnly = cleanBase.split('?')[0];
    return idMatch ? `${pathOnly}?id=${idMatch[1]}` : pathOnly;
  }

  // URLs (LinkedIn, Facebook, Github, Website, etc.)
  let cleanUrl = val
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "")
    .toLowerCase();
  
  return cleanUrl;
}


