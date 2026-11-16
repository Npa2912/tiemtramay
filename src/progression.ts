import { securityActive } from "./incidents";
import type { State } from "./engine";
import { customers, recipes, supplies, unlocked } from "./catalog";

export type Metric =
  | "served"
  | "accurate"
  | "revenue"
  | "purchases"
  | "upgrades"
  | "decorations"
  | "events"
  | "vip"
  | "regulars"
  | "training"
  | "staff"
  | "lowSugar"
  | "large"
  | "flavored"
  | "toppings"
  | "days"
  | "savings"
  | "recipes"
  | "security"
  | "perfectDays";
export interface Progression {
  schema: 1;
  metrics: Record<Metric, number>;
  relationships: Record<string, number>;
  tasted: string[];
  claimed: string[];
  staff: Record<string, { level: number; active: boolean }>;
  security: Record<string, number>;
  event: { id: string; day: number } | null;
  eventHistory: { id: string; day: number; choice: string; text: string }[];
  cooldowns: Record<string, number>;
  lastEventDay: number;
  eventExpenses?: number;
  boosts: { patience: number; seal: number; tip: number; discount: number };
  ownerName: string;
  reducedMotion: boolean;
}
const metricNames: Metric[] = [
  "served",
  "accurate",
  "revenue",
  "purchases",
  "upgrades",
  "decorations",
  "events",
  "vip",
  "regulars",
  "training",
  "staff",
  "lowSugar",
  "large",
  "flavored",
  "toppings",
  "days",
  "savings",
  "recipes",
  "security",
  "perfectDays",
];
export function validOwnerName(name: unknown): name is string {
  return (
    typeof name === "string" &&
    name.length >= 2 &&
    name.length <= 30 &&
    /^[\p{L}\p{N} .'-]+$/u.test(name) &&
    !/(địt|đụ má|fuck|shit)/iu.test(name)
  );
}
export function createProgression(): Progression {
  return {
    schema: 1,
    metrics: Object.fromEntries(metricNames.map((k) => [k, 0])) as Record<
      Metric,
      number
    >,
    relationships: {},
    tasted: [],
    claimed: [],
    staff: {},
    security: {},
    event: null,
    eventHistory: [],
    cooldowns: {},
    lastEventDay: 0,
    eventExpenses: 0,
    boosts: { patience: 0, seal: 0, tip: 0, discount: 0 },
    ownerName: "Chủ Tiệm An",
    reducedMotion: false,
  };
}
const finite = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;
export function validProgression(v: unknown): v is Progression {
  if (!v || typeof v !== "object") return false;
  const p = v as Progression;
  try {
    return (
      p.schema === 1 &&
      !!p.metrics &&
      metricNames.every((k) => finite(p.metrics[k])) &&
      validOwnerName(p.ownerName) &&
      typeof p.reducedMotion === "boolean" &&
      Array.isArray(p.claimed) &&
      p.claimed.every((k) => typeof k === "string") &&
      Array.isArray(p.tasted) &&
      p.tasted.every((k) => typeof k === "string") &&
      !!p.staff &&
      Object.entries(p.staff).every(
        ([id, s]) =>
          staffCatalog.some((x) => x.id === id) &&
          Number.isInteger(s.level) &&
          s.level >= 1 &&
          s.level <= 5 &&
          typeof s.active === "boolean",
      ) &&
      !!p.security &&
      Object.entries(p.security).every(
        ([id, n]) => securityCatalog.some((x) => x.id === id) && n === 1,
      ) &&
      !!p.relationships &&
      Object.values(p.relationships).every(finite) &&
      !!p.cooldowns &&
      Object.values(p.cooldowns).every(finite) &&
      finite(p.lastEventDay) &&
      (p.eventExpenses === undefined || finite(p.eventExpenses)) &&
      Array.isArray(p.eventHistory) &&
      p.eventHistory.every(
        (e) =>
          events.some((x) => x.id === e.id) &&
          finite(e.day) &&
          typeof e.choice === "string" &&
          typeof e.text === "string",
      ) &&
      (p.event === null ||
        (events.some((e) => e.id === p.event?.id) && finite(p.event.day))) &&
      !!p.boosts &&
      finite(p.boosts.patience) &&
      finite(p.boosts.tip) &&
      finite(p.boosts.discount) &&
      typeof p.boosts.seal === "number" &&
      Number.isFinite(p.boosts.seal) &&
      Math.abs(p.boosts.seal) <= 2
    );
  } catch {
    return false;
  }
}
export function migrateProgression(
  s: State,
): State & { progression: Progression } {
  const existing = (s as State & { progression?: Progression }).progression;
  if (existing && !validProgression(existing))
    throw new Error(
      "Dữ liệu tiến trình không hợp lệ. Bản lưu gốc được giữ nguyên.",
    );
  return { ...s, progression: existing ?? createProgression() };
}
export const staffCatalog = [
  {
    id: "barista",
    name: "Miu",
    role: "Pha chế",
    day: 5,
    cost: 45000,
    wage: 4000,
    desc: "Giảm thời gian dán nắp 0,15 giây/cấp.",
  },
  {
    id: "cashier",
    name: "Bông",
    role: "Thu ngân",
    day: 8,
    cost: 50000,
    wage: 3500,
    desc: "Tăng tiền tip 1% giá đơn/cấp khi pha đúng.",
  },
  {
    id: "server",
    name: "Sóc",
    role: "Phục vụ",
    day: 8,
    cost: 45000,
    wage: 3500,
    desc: "Khách kiên nhẫn thêm 3 giây/cấp.",
  },
  {
    id: "courier",
    name: "Nấm",
    role: "Giao hàng",
    day: 10,
    cost: 60000,
    wage: 4000,
    desc: "Khách kiên nhẫn thêm 2 giây/cấp.",
  },
  {
    id: "manager",
    name: "Lam",
    role: "Quản lý",
    day: 15,
    cost: 80000,
    wage: 5000,
    desc: "Giảm giá nhập kho 1%/cấp; hỗ trợ kiểm kê mất trộm.",
  },
];
export const securityCatalog = [
  {
    id: "lock",
    name: "Khóa chống trộm",
    cost: 20000,
    day: 1,
    desc: "Chặn hoàn toàn trộm trong ngày mua. Hôm sau cần mua lại (20.000đ/ngày).",
  },
  {
    id: "camera",
    name: "Camera an ninh",
    cost: 50000,
    day: 1,
    desc: "Có hiệu lực 10 ngày tính cả ngày mua. Đối chiếu để thu hồi tiền bị trộm khi camera còn hạn.",
  },
  {
    id: "safe",
    name: "Két tiền",
    cost: 70000,
    day: 1,
    desc: "Vĩnh viễn: giới hạn tổn thất do trộm còn 5% vốn hiện có thay vì 10%.",
  },
  {
    id: "generator",
    name: "Máy phát điện",
    cost: 60000,
    day: 1,
    desc: "Vĩnh viễn: duy trì quầy khi mất điện (20% mỗi ngày); không cần đợi 60 giây.",
  },
  {
    id: "backup",
    name: "Máy dán nắp dự phòng",
    cost: 25000,
    day: 1,
    desc: "Vĩnh viễn: tự thay máy chính khi hỏng. Hoặc sửa máy chính với giá 50.000đ.",
  },
];
interface Choice {
  id: string;
  label: string;
  description: string;
  cost?: number;
  requires?: string;
}
export interface GameEvent {
  id: string;
  name: string;
  story: string;
  day: number;
  cooldown: number;
  priority: number;
  choices: Choice[];
}
export const events: GameEvent[] = [
  {
    id: "theft",
    name: "Tiền quầy bị thiếu",
    story:
      "Mây thấy tiền quầy chưa khớp sổ. Có thể là nhầm lẫn hoặc thất lạc; chưa có bằng chứng để kết luận ai gây ra.",
    day: 4,
    cooldown: 1,
    priority: 3,
    choices: [
      {
        id: "camera",
        label: "Kiểm tra camera",
        description: "Đối chiếu hình ảnh, thu hồi khoản thất lạc.",
        requires: "camera",
      },
      {
        id: "inventory",
        label: "Kiểm kê cùng nhân viên",
        description: "Đối chiếu sổ, giảm thiệt hại; không buộc tội ai.",
      },
      {
        id: "continue",
        label: "Ghi nhận và tiếp tục",
        description:
          "Mất 10% vốn hiện có; có két tiền thì tối đa 5%, có khóa hôm nay thì không mất tiền.",
      },
    ],
  },
  {
    id: "vip",
    name: "Lời mời của khách VIP",
    story:
      "Một khách sành trà muốn giới thiệu tiệm. Chất lượng phục vụ hôm nay sẽ tạo ấn tượng.",
    day: 8,
    cooldown: 6,
    priority: 2,
    choices: [
      {
        id: "welcome",
        label: "Chuẩn bị đón khách",
        description: "Tip cho các ly pha đúng tăng 5% hôm nay.",
      },
      {
        id: "gift",
        label: "Chuẩn bị quà nhỏ",
        description: "Chi 10.000đ, danh tiếng +0,1.",
        cost: 10000,
      },
    ],
  },
  {
    id: "power",
    name: "Mất điện trong phố",
    story:
      "Điện vừa chập chờn trước giờ mở cửa. Mây có thể chủ động chuẩn bị để không làm gián đoạn đơn.",
    day: 5,
    cooldown: 8,
    priority: 3,
    choices: [
      {
        id: "generator",
        label: "Bật máy phát",
        description: "Máy hoạt động bình thường.",
        requires: "generator",
      },
      {
        id: "wait",
        label: "Chờ điện ổn định",
        description:
          "Quầy mất điện 60 giây, có đếm ngược; máy phát giúp tiếp tục hoạt động.",
      },
      {
        id: "notice",
        label: "Báo trước cho khách",
        description: "Danh tiếng -0,03; không ảnh hưởng máy.",
      },
    ],
  },
  {
    id: "inspection",
    name: "Thanh tra vệ sinh",
    story:
      "Tiệm được kiểm tra kho, hạn dùng và cách quản lý vật tư. Mây có đủ hồ sơ để hợp tác.",
    day: 7,
    cooldown: 10,
    priority: 2,
    choices: [
      {
        id: "check",
        label: "Mời kiểm tra kho",
        description:
          "Kho không có lô hết hạn: uy tín +0,1. Nếu có, tự loại lô hỏng.",
      },
      {
        id: "clean",
        label: "Vệ sinh bổ sung",
        description: "Chi 8.000đ, uy tín +0,05.",
        cost: 8000,
      },
    ],
  },
  {
    id: "demanding",
    name: "Khách cần ít đường",
    story:
      "Một khách quen muốn cả nhóm được tư vấn rõ hơn về lượng đường. Mây có thể dành thêm thời gian chăm sóc.",
    day: 4,
    cooldown: 5,
    priority: 1,
    choices: [
      {
        id: "listen",
        label: "Lắng nghe và tư vấn",
        description: "Khách kiên nhẫn thêm 8 giây hôm nay.",
      },
      {
        id: "voucher",
        label: "Gửi phiếu ưu đãi",
        description: "Chi 5.000đ; uy tín +0,05.",
        cost: 5000,
      },
    ],
  },
  {
    id: "shortage",
    name: "Nhà cung cấp giao chậm",
    story:
      "Một tuyến giao nguyên liệu bị chậm. Kho hiện có vẫn được giữ nguyên; hãy chọn phương án nhập hàng.",
    day: 6,
    cooldown: 7,
    priority: 2,
    choices: [
      {
        id: "alternate",
        label: "Nhà cung cấp thay thế",
        description: "Chi 5.000đ vận chuyển; giảm 3% tiền nhập kho hôm nay.",
        cost: 5000,
      },
      {
        id: "wait",
        label: "Dùng kho dự phòng",
        description:
          "Giữ nguyên kho, khách kiên nhẫn thêm 3 giây vì được báo trước.",
      },
    ],
  },
  {
    id: "festival",
    name: "Ngày hội trà sữa",
    story:
      "Khu phố tổ chức ngày hội nhỏ. Những ly pha chính xác sẽ được khách thưởng thêm.",
    day: 3,
    cooldown: 7,
    priority: 1,
    choices: [
      {
        id: "join",
        label: "Tham gia ngày hội",
        description: "Tip cho đơn đúng tăng 8% hôm nay.",
      },
      {
        id: "decorate",
        label: "Trang trí gian hàng",
        description: "Chi 12.000đ; uy tín +0,15.",
        cost: 12000,
      },
    ],
  },
  {
    id: "celebrity",
    name: "Một vị khách nổi tiếng",
    story:
      "Một tác giả du lịch muốn ghé thăm góc tiệm. Mây có thể giới thiệu câu chuyện của quán.",
    day: 12,
    cooldown: 12,
    priority: 1,
    choices: [
      {
        id: "story",
        label: "Kể chuyện của tiệm",
        description: "Danh tiếng +0,08.",
      },
      {
        id: "welcome",
        label: "Chuẩn bị buổi đón tiếp",
        description: "Chi 10.000đ; tip đơn đúng tăng 10% hôm nay.",
        cost: 10000,
      },
    ],
  },
  {
    id: "lost",
    name: "Chiếc ví bỏ quên",
    story:
      "Một vị khách để quên ví. Mây giữ nguyên đồ bên trong và tìm cách liên hệ an toàn.",
    day: 3,
    cooldown: 8,
    priority: 1,
    choices: [
      {
        id: "return",
        label: "Liên hệ chủ nhân",
        description: "Danh tiếng +0,1, khách quen thêm một lần ghé.",
      },
      {
        id: "hold",
        label: "Gửi quầy đồ thất lạc",
        description: "Danh tiếng +0,05; ghi vào nhật ký.",
      },
    ],
  },
  {
    id: "machine",
    name: "Máy dán nắp cần bảo trì",
    story:
      "Trước giờ mở cửa, máy báo cần vệ sinh trục lăn. Không có ly đang pha nào bị mất.",
    day: 6,
    cooldown: 9,
    priority: 3,
    choices: [
      {
        id: "repair",
        label: "Gọi bảo trì",
        description: "Chi 50.000đ; máy hoạt động bình thường.",
        cost: 50000,
      },
      {
        id: "backup",
        label: "Dùng máy dự phòng",
        description: "Không mất phí sửa hôm nay.",
        requires: "backup",
      },
      {
        id: "manual",
        label: "Vệ sinh thủ công",
        description:
          "Quầy tạm dừng tới khi sửa 50.000đ hoặc mua máy dự phòng 25.000đ.",
      },
    ],
  },
  {
    id: "rival",
    name: "Tiệm mới ở góc phố",
    story:
      "Một quán mới vừa mở. Mây muốn giữ bản sắc và chăm chút trải nghiệm của khách.",
    day: 10,
    cooldown: 12,
    priority: 1,
    choices: [
      {
        id: "quality",
        label: "Chú trọng chất lượng",
        description: "Khách kiên nhẫn thêm 5 giây hôm nay.",
      },
      {
        id: "advertise",
        label: "Giới thiệu tiệm",
        description: "Chi 15.000đ; danh tiếng +0,15.",
        cost: 15000,
      },
    ],
  },
  {
    id: "bulk",
    name: "Lời mời đặt tiệc",
    story:
      "Một nhóm muốn đặt tiệc trà sau giờ bán. Mây cần dành nguyên liệu thay vì hứa vượt khả năng.",
    day: 9,
    cooldown: 7,
    priority: 2,
    choices: [
      {
        id: "accept",
        label: "Nhận gói 5 ly trà sữa",
        description:
          "Cần 5 trà sữa, 5 ly M, 5 nắp, 5 trân châu và 2 sữa; nhận 100.000đ.",
      },
      {
        id: "decline",
        label: "Hẹn dịp khác",
        description:
          "Giữ nguyên kho và tài chính; khách đánh giá sự trung thực.",
      },
    ],
  },
];
export interface Quest {
  id: string;
  name: string;
  description: string;
  metric: Metric;
  target: number;
  reward: number;
  kind: "main" | "side" | "achievement";
  day: number;
}
const mainData: [string, Metric, number, string][] = [
  ["Đơn đầu tiên", "served", 1, "Phục vụ ly đầu tiên."],
  ["Kho sẵn sàng", "purchases", 8, "Nhập đủ nhiều nhóm vật tư."],
  ["Pha đúng công thức", "accurate", 3, "Được khách đánh giá ngon."],
  ["Một ngày chăm chỉ", "days", 1, "Hoàn tất ngày bán đầu tiên."],
  ["Góc quán mới", "decorations", 1, "Đổi một trang trí."],
  ["Máy mới", "upgrades", 1, "Mua một nâng cấp."],
  ["Khách nhớ tên tiệm", "regulars", 2, "Phục vụ lại khách cũ."],
  ["Vị ít ngọt", "lowSugar", 3, "Pha đúng đơn có đường tối đa 50%."],
  ["Sổ thu đầu tiên", "revenue", 200000, "Tích lũy doanh thu bán hàng."],
  ["Cùng khu phố", "events", 1, "Giải quyết sự kiện."],
  ["Topping đa dạng", "toppings", 2, "Phục vụ đúng hai loại topping."],
  ["Một tuần bên Mây", "days", 7, "Kết thúc bảy ngày kinh doanh."],
  ["Bạn đồng hành", "staff", 1, "Tuyển một nhân viên."],
  ["Đào tạo tận tâm", "training", 1, "Đào tạo nhân viên một lần."],
  ["Ly lớn niềm vui", "large", 3, "Phục vụ đúng đơn ly L."],
  ["Khóa cửa an tâm", "security", 1, "Mua thiết bị bảo vệ hoặc dự phòng."],
  ["Hương mới", "flavored", 3, "Phục vụ đúng đơn có hương trái cây."],
  ["Khách sành trà", "vip", 3, "Pha đúng đơn của khách VIP."],
  ["Menu của Mây", "recipes", 8, "Mở tám công thức đủ điều kiện."],
  [
    "Ngày không bỏ lỡ",
    "perfectDays",
    1,
    "Hoàn tất ngày có khách và không bỏ lỡ ai.",
  ],
  ["Nửa tháng rực rỡ", "days", 15, "Kết thúc ngày kinh doanh thứ mười lăm."],
  ["Tổ đội nhỏ", "staff", 3, "Tuyển ba vai trò nhân viên."],
  ["Kỹ năng vững vàng", "training", 5, "Đào tạo tổng cộng năm lần."],
  ["Dự phòng bình yên", "savings", 600000, "Giữ được khoản tiền dự phòng."],
  ["Chuyện ở góc phố", "events", 6, "Giải quyết sáu sự kiện."],
  ["Tiệm của khách quen", "regulars", 20, "Phục vụ nhiều lượt khách quay lại."],
  [
    "Một triệu doanh thu",
    "revenue",
    1000000,
    "Tích lũy một triệu đồng doanh thu.",
  ],
  ["Menu phong phú", "recipes", 20, "Mở hai mươi công thức."],
  ["Tháng đầu tiên", "days", 30, "Kết thúc ba mươi ngày kinh doanh."],
  [
    "Tiệm trà bền vững",
    "accurate",
    150,
    "Phục vụ chính xác một trăm năm mươi đơn.",
  ],
];
const sideData: [string, Metric, number, string][] = [
  ["Trà đầu ngày", "served", 5, "Phục vụ khách."],
  ["Bàn tay khéo", "accurate", 5, "Pha đúng đơn."],
  ["Ghi sổ cẩn thận", "revenue", 80000, "Doanh thu bán hàng."],
  ["Chuyến hàng nhỏ", "purchases", 4, "Nhập kho thành công."],
  ["Chăm chút thiết bị", "upgrades", 2, "Nâng cấp tiệm."],
  ["Đổi màu mái hiên", "decorations", 2, "Thay trang trí."],
  ["Nghe chuyện phố", "events", 2, "Giải quyết sự kiện."],
  ["Đón khách sành trà", "vip", 1, "Phục vụ chính xác khách VIP."],
  ["Một lời hẹn", "regulars", 1, "Phục vụ khách quay lại."],
  ["Buổi học đầu", "training", 2, "Đào tạo nhân viên."],
  ["Đội ngũ mới", "staff", 2, "Tuyển nhân viên."],
  ["Vị thanh nhẹ", "lowSugar", 1, "Pha đúng đơn ít đường."],
  ["Mang đi ly lớn", "large", 1, "Pha đúng ly lớn."],
  ["Hương thơm vườn", "flavored", 1, "Pha đúng vị trái cây."],
  ["Bát topping mới", "toppings", 3, "Phục vụ đa dạng topping."],
  ["Ba ngày mở cửa", "days", 3, "Hoàn tất ngày bán."],
  ["Quỹ ngày mưa", "savings", 250000, "Duy trì tiền dự phòng."],
  ["Ghi thêm công thức", "recipes", 4, "Mở công thức."],
  ["Thiết bị an toàn", "security", 2, "Mua thiết bị dự phòng."],
  [
    "Ngày vui trọn vẹn",
    "perfectDays",
    2,
    "Không mất khách trong ngày hoàn tất.",
  ],
  ["Mười lời cảm ơn", "accurate", 10, "Pha chính xác."],
  ["Túi trà chiều", "served", 15, "Phục vụ khách."],
  ["Nụ cười VIP", "vip", 5, "Phục vụ đúng khách VIP."],
  ["Món quen", "regulars", 5, "Khách quay lại."],
  ["Hàng mới đúng lúc", "purchases", 15, "Nhập vật tư."],
  ["Quầy tiện nghi", "upgrades", 4, "Cải tiến thiết bị."],
  ["Mái nhà sắc màu", "decorations", 4, "Thay đổi không gian."],
  ["Dễ chịu ít đường", "lowSugar", 8, "Pha đúng đơn ít đường."],
  ["Tặng vị trái cây", "flavored", 8, "Pha đúng hương mới."],
  ["Chia sẻ ly lớn", "large", 8, "Pha đúng ly L."],
  ["Chuyện kể mười ngày", "days", 10, "Hoàn tất ngày bán."],
  ["Một nửa triệu", "revenue", 500000, "Tích lũy doanh thu."],
  ["Tổ trưởng tương lai", "training", 4, "Đào tạo đội ngũ."],
  ["Bốn người bạn", "staff", 4, "Tuyển đủ bốn vai trò."],
  ["Bốn loại topping", "toppings", 4, "Pha đúng tất cả topping."],
  ["Mười hai công thức", "recipes", 12, "Mở thêm công thức."],
  ["Két và khóa", "security", 3, "Mua thiết bị an toàn."],
  ["Lời giải dịu dàng", "events", 4, "Giải quyết sự kiện."],
  ["Không ai chờ mãi", "perfectDays", 3, "Ngày bán không mất khách."],
  ["Quỹ vững vàng", "savings", 800000, "Giữ tiền dự phòng."],
  ["Hai mươi ngày", "days", 20, "Tiếp tục kinh doanh."],
  ["Chuyên gia vị thanh", "lowSugar", 20, "Pha đúng đơn ít ngọt."],
  ["Quán của khu phố", "regulars", 40, "Phục vụ khách quay lại."],
  ["Cả đội bên nhau", "staff", 5, "Tuyển đủ năm vai trò."],
  ["Tay nghề ngày mới", "training", 10, "Đào tạo chuyên sâu."],
  ["Hai triệu doanh thu", "revenue", 2000000, "Tích lũy doanh thu."],
  ["Khách đến trăm lần", "served", 100, "Phục vụ khách."],
  ["Mười chuyện nhỏ", "events", 10, "Giải quyết sự kiện."],
  ["Thực đơn cuối mùa", "recipes", 30, "Mở ba mươi công thức."],
  ["Bảy ngày hoàn hảo", "perfectDays", 7, "Hoàn tất ngày không mất khách."],
];
const achievementData: [string, Metric, number][] = [
  ["Ly đầu tay", "served", 1],
  ["Tay pha chuẩn", "accurate", 25],
  ["Sổ vàng", "revenue", 1000000],
  ["Người giữ kho", "purchases", 30],
  ["Thợ máy của tiệm", "upgrades", 8],
  ["Góc quán nghệ thuật", "decorations", 8],
  ["Chuyện phố Mây", "events", 12],
  ["Khách VIP yêu mến", "vip", 10],
  ["Ngôi nhà thứ hai", "regulars", 30],
  ["Người thầy kiên nhẫn", "training", 12],
  ["Đội ngũ Mây", "staff", 5],
  ["Ngọt vừa đủ", "lowSugar", 30],
  ["Ly lớn đong đầy", "large", 25],
  ["Vườn hương", "flavored", 25],
  ["Topping tinh tế", "toppings", 4],
  ["Một tháng bên nhau", "days", 30],
  ["Quỹ an tâm", "savings", 1500000],
  ["Cuốn sách công thức", "recipes", 36],
  ["Quầy được bảo vệ", "security", 5],
  ["Bảy ngày không bỏ lỡ", "perfectDays", 7],
];
export const quests: Quest[] = [
  ...mainData.map(([name, metric, target, description], i) => ({
    id: `main-${i + 1}`,
    name,
    metric,
    target,
    description,
    kind: "main" as const,
    day: 1,
    reward: 3000 + Math.floor(i / 5) * 1000,
  })),
  ...sideData.map(([name, metric, target, description], i) => ({
    id: `side-${i + 1}`,
    name,
    metric,
    target,
    description,
    kind: "side" as const,
    day: 1,
    reward: 2000 + Math.floor(i / 10) * 1000,
  })),
  ...achievementData.map(([name, metric, target], i) => ({
    id: `achievement-${i + 1}`,
    name,
    metric,
    target,
    description: "Danh hiệu ghi nhận hành trình của tiệm.",
    kind: "achievement" as const,
    day: 1,
    reward: 5000,
  })),
];
export type ProgressionAction =
  | { type: "eventChoice"; choice: string }
  | { type: "hire" | "train" | "staffAssign" | "security"; id: string }
  | { type: "claimQuest"; id: string }
  | { type: "ownerName"; name: string }
  | { type: "reducedMotion" };
function log(s: State, description: string, amount: number) {
  s.money = Math.round(s.money + amount);
  s.ledger.push({ day: s.day, kind: description, amount });
  s.ledger = s.ledger.slice(-600);
}
function eventSpend(
  s: State & { progression: Progression },
  description: string,
  amount: number,
) {
  log(s, description, -amount);
  if (s.phase === "summary") {
    s.stats.expenses += amount;
    s.stats.profit -= amount;
    if (s.history.length) s.history[s.history.length - 1] = { ...s.stats };
  } else
    s.progression.eventExpenses = (s.progression.eventExpenses ?? 0) + amount;
}
const level = (p: Progression, id: string) =>
  p.staff[id]?.active ? p.staff[id].level : 0;
function updateMetrics(s: State & { progression: Progression }) {
  const p = s.progression;
  p.metrics.days = Math.max(
    p.metrics.days,
    s.phase === "summary" ? s.day : s.day - 1,
  );
  p.metrics.savings = Math.max(p.metrics.savings, s.money);
  p.metrics.staff = Object.keys(p.staff).length;
  p.metrics.security = Object.keys(p.security).length;
  p.metrics.recipes = recipes.filter(
    (r) =>
      r.day <= s.day &&
      unlocked(s, r.tea) &&
      unlocked(s, r.topping) &&
      unlocked(s, r.flavor) &&
      (r.size === "M" || s.upgrades.size),
  ).length;
}
export function applyProgression(
  previous: State,
  next: State,
  action: { type: string },
): State & { progression: Progression } {
  if (previous === next) return next as State & { progression: Progression };
  const s = next as State & { progression: Progression };
  s.progression ??= createProgression();
  const p = s.progression;
  if (action.type === "buy" && s.money < previous.money) {
    p.metrics.purchases++;
    const refund = Math.round(
      (previous.money - s.money) *
        Math.min(0.15, p.boosts.discount + 0.01 * level(p, "manager")),
    );
    if (refund) log(s, "Ưu đãi nhập kho", refund);
  }
  if (action.type === "upgrade" && s.money < previous.money)
    p.metrics.upgrades++;
  if (
    action.type === "decor" &&
    JSON.stringify(s.decor) !== JSON.stringify(previous.decor)
  )
    p.metrics.decorations++;
  if (
    action.type === "seal" &&
    s.cup &&
    previous.cup &&
    s.cup.sealLeft > previous.cup.sealLeft
  )
    s.cup.sealLeft = Math.max(
      0.25,
      s.cup.sealLeft - 0.15 * level(p, "barista") - p.boosts.seal,
    );
  const oldIds = new Set(previous.orders.map((o) => o.id));
  for (const o of s.orders)
    if (!oldIds.has(o.id)) {
      const bonus =
        3 * level(p, "server") + 2 * level(p, "courier") + p.boosts.patience;
      o.total += bonus;
      o.remaining += bonus;
    }
  if (action.type === "serve" && s.stats.served > previous.stats.served) {
    p.metrics.served++;
    p.metrics.revenue += Math.max(0, s.stats.revenue - previous.stats.revenue);
    const o = previous.orders[0];
    if (o) {
      const key = String(o.customer);
      if ((p.relationships[key] ?? 0) > 0) p.metrics.regulars++;
      p.relationships[key] = (p.relationships[key] ?? 0) + 1;
      if (s.feedback?.mood === "happy") {
        p.metrics.accurate++;
        if (customers[o.customer].personality === "VIP") p.metrics.vip++;
        if (o.recipe.sugar <= 50) p.metrics.lowSugar++;
        if (o.recipe.size === "L") p.metrics.large++;
        if (o.recipe.flavor !== "plain") p.metrics.flavored++;
        if (!p.tasted.includes(o.recipe.topping))
          p.tasted.push(o.recipe.topping);
        p.metrics.toppings = p.tasted.length;
        const bonus = Math.round(
          o.recipe.price * (p.boosts.tip + 0.01 * level(p, "cashier")),
        );
        if (bonus) {
          log(s, "Tip chăm sóc khách hàng", bonus);
          s.stats.revenue += bonus;
          p.metrics.revenue += bonus;
        }
      }
    }
  }
  if (previous.phase !== "summary" && s.phase === "summary") {
    if (s.stats.served > 0 && s.stats.lost === 0) p.metrics.perfectDays++;
    const eventCosts = p.eventExpenses ?? 0;
    s.stats.expenses += eventCosts;
    s.stats.profit -= eventCosts;
    p.eventExpenses = 0;
    const wages = staffCatalog.reduce(
      (n, x) => n + (p.staff[x.id]?.active ? x.wage : 0),
      0,
    );
    const paid = Math.min(Math.max(0, s.money), wages);
    if (paid) {
      log(s, "Lương đội ngũ", -paid);
      s.stats.expenses += paid;
      s.stats.profit -= paid;
    }
    s.stats.profit =
      s.stats.revenue - s.stats.cogs - s.stats.expenses - s.stats.waste;
    if (s.history.length) s.history[s.history.length - 1] = { ...s.stats };
    if (paid < wages) {
      Object.values(p.staff).forEach((x) => (x.active = false));
      s.message +=
        " Đội ngũ tạm nghỉ vì quỹ lương chưa đủ; có thể phân công lại.";
    }
  }
  if (s.day > previous.day) {
    p.boosts = { patience: 0, seal: 0, tip: 0, discount: 0 };
    p.eventExpenses = 0;
    if (!p.event && s.day >= 3 && s.day - p.lastEventDay >= 3) {
      const roll = (Math.imul(s.seed ^ s.day, 1103515245) >>> 0) % 100;
      if (roll < 42) {
        const available = events.filter(
          (e) =>
            !["theft", "power", "machine"].includes(e.id) &&
            e.day <= s.day &&
            s.day - (p.cooldowns[e.id] ?? -999) >= e.cooldown,
        );
        if (available.length) {
          const weight = available.reduce((n, e) => n + e.priority, 0);
          let ticket = (roll + s.day) % weight;
          const event = available.find((e) => {
            ticket -= e.priority;
            return ticket < 0;
          })!;
          p.event = { id: event.id, day: s.day };
          p.lastEventDay = s.day;
        }
      }
    }
  }
  updateMetrics(s);
  return s;
}
export function reduceProgression(
  input: State,
  action: ProgressionAction,
): State & { progression: Progression } {
  const s = migrateProgression(structuredClone(input));
  const p = s.progression;
  if (action.type === "ownerName") {
    const name = action.name.trim().replace(/\s+/g, " ");
    if (validOwnerName(name)) p.ownerName = name;
    else s.message = "Tên cần 2–30 ký tự chữ, số hoặc dấu cách phù hợp.";
    return s;
  }
  if (action.type === "reducedMotion") {
    p.reducedMotion = !p.reducedMotion;
    return s;
  }
  if (action.type === "claimQuest") {
    const q = quests.find((x) => x.id === action.id);
    if (q && p.metrics[q.metric] >= q.target && !p.claimed.includes(q.id)) {
      p.claimed.push(q.id);
      log(s, `Hoàn thành: ${q.name}`, q.reward);
      s.message = `✨ ${q.name}: +${q.reward.toLocaleString("vi-VN")}đ`;
    }
    return s;
  }
  if (action.type === "eventChoice") {
    const e = events.find((x) => x.id === p.event?.id),
      c = e?.choices.find((x) => x.id === action.choice);
    if (!e || !c) return s;
    if (c.requires && !securityActive(s, c.requires)) {
      s.message = "Cần mua thiết bị phù hợp trước.";
      return s;
    }
    if ((c.cost ?? 0) > s.money) {
      s.message = "Chưa đủ tiền cho lựa chọn này.";
      return s;
    }
    if (e.id === "bulk" && c.id === "accept") {
      if (s.phase === "open") {
        s.message =
          "Hãy kết sổ trước khi nhận tiệc trà để giữ đủ nguyên liệu cho các đơn đang chờ.";
        return s;
      }
      const needed: Record<string, number> = {
        milk: 5,
        cupM: 5,
        lid: 5,
        pearl: 5,
        milkPowder: 2,
      };
      if (
        Object.entries(needed).some(
          ([id, n]) => (s.stock[id] ?? []).reduce((t, l) => t + l.qty, 0) < n,
        )
      ) {
        s.message = "Chưa đủ kho cho 5 ly; có thể từ chối mà không bị phạt.";
        return s;
      }
      let ingredientCost = 0;
      for (const [id, n] of Object.entries(needed)) {
        ingredientCost += (supplies.find((x) => x.id === id)?.price ?? 0) * n;
        let left = n;
        for (const lot of s.stock[id]) {
          const used = Math.min(left, lot.qty);
          lot.qty -= used;
          left -= used;
        }
        s.stock[id] = s.stock[id].filter((l) => l.qty > 0);
      }
      s.stats.cogs += ingredientCost;
      s.stats.served += 5;
      p.metrics.served += 5;
      log(s, "Tiệc trà 5 ly", 100000);
      s.stats.revenue += 100000;
      p.metrics.revenue += 100000;
    }
    if (c.cost) eventSpend(s, e.name, c.cost);
    let text = c.description;
    switch (e.id) {
      case "theft": {
        const loss = securityActive(s, "lock")
          ? 0
          : Math.floor(
              Math.max(0, s.money) * (securityActive(s, "safe") ? 0.05 : 0.1),
            );
        const recovered =
          c.id === "camera"
            ? 1
            : c.id === "inventory"
              ? level(p, "manager")
                ? 0.8
                : 0.5
              : 0;
        const amount = Math.round(loss * (1 - recovered));
        if (amount) eventSpend(s, "Chênh lệch quầy đã đối chiếu", amount);
        text = `Đã đối chiếu sổ; thất thoát ${amount.toLocaleString("vi-VN")}đ. Chưa có bằng chứng buộc tội bất kỳ ai.`;
        break;
      }
      case "vip":
        if (c.id === "welcome") p.boosts.tip += 0.05;
        else s.reputation += 0.1;
        break;
      case "power":
        if (c.id === "wait") {
          if (s.incidents) s.incidents.powerLeft = 60;
        } else if (c.id === "notice") s.reputation -= 0.03;
        break;
      case "inspection":
        if (c.id === "clean") s.reputation += 0.05;
        else {
          let expired = false;
          for (const lots of Object.values(s.stock))
            for (const l of lots)
              if (l.expires <= s.day && l.qty > 0) {
                l.qty = 0;
                expired = true;
              }
          if (!expired) s.reputation += 0.1;
          text = expired
            ? "Đã loại nguyên liệu quá hạn, không phạt tiền."
            : "Kho đạt yêu cầu; danh tiếng +0,1.";
        }
        break;
      case "demanding":
        if (c.id === "listen") p.boosts.patience += 8;
        else s.reputation += 0.05;
        break;
      case "shortage":
        if (c.id === "alternate") p.boosts.discount += 0.03;
        else p.boosts.patience += 3;
        break;
      case "festival":
        if (c.id === "join") p.boosts.tip += 0.08;
        else s.reputation += 0.15;
        break;
      case "celebrity":
        if (c.id === "story") s.reputation += 0.08;
        else p.boosts.tip += 0.1;
        break;
      case "lost":
        s.reputation += c.id === "return" ? 0.1 : 0.05;
        if (c.id === "return") p.metrics.regulars++;
        break;
      case "machine":
        if (c.id === "manual" && s.incidents) s.incidents.machineBroken = true;
        break;
      case "rival":
        if (c.id === "quality") p.boosts.patience += 5;
        else s.reputation += 0.15;
        break;
    }
    s.reputation = Math.max(1, Math.min(5, s.reputation));
    p.eventHistory.push({ id: e.id, day: s.day, choice: c.id, text });
    p.eventHistory = p.eventHistory.slice(-200);
    p.cooldowns[e.id] = s.day;
    p.metrics.events++;
    p.event = null;
    if (s.phase === "summary") {
      s.stats.profit =
        s.stats.revenue - s.stats.cogs - s.stats.expenses - s.stats.waste;
      if (s.history.length) s.history[s.history.length - 1] = { ...s.stats };
    }
    s.message = text;
    updateMetrics(s);
    return s;
  }
  if (s.phase === "open" && action.type !== "security") {
    s.message = "Hãy kết sổ để tuyển dụng, đào tạo hoặc mua thiết bị.";
    return s;
  }
  if (action.type === "security") {
    const item = securityCatalog.find((x) => x.id === action.id);
    if (
      item &&
      !securityActive(s, item.id) &&
      s.day >= item.day &&
      s.money >= item.cost
    ) {
      p.security[item.id] = 1;
      log(s, item.name, -item.cost);
      s.message = `Đã lắp ${item.name.toLowerCase()}.`;
    } else s.message = "Chưa đủ tiền hoặc điều kiện mua thiết bị.";
  } else {
    const member = staffCatalog.find((x) => x.id === action.id);
    if (!member) return s;
    const current = p.staff[member.id];
    if (action.type === "hire") {
      if (!current && s.day >= member.day && s.money >= member.cost) {
        p.staff[member.id] = { level: 1, active: true };
        log(s, `Tuyển ${member.name}`, -member.cost);
        s.message = `${member.name} đã sẵn sàng hỗ trợ tiệm!`;
      } else s.message = "Chưa đủ điều kiện tuyển dụng.";
    } else if (action.type === "train" && current) {
      const cost = 10000 * current.level;
      if (current.level < 5 && s.money >= cost) {
        log(s, `Đào tạo ${member.name}`, -cost);
        current.level++;
        p.metrics.training++;
        s.message = `${member.name} đạt cấp ${current.level}.`;
      } else s.message = "Chưa đủ tiền hoặc đã đạt cấp tối đa.";
    } else if (action.type === "staffAssign" && current)
      current.active = !current.active;
  }
  updateMetrics(s);
  return s;
}
