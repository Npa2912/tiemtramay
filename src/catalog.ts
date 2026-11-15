export const teas = [
  { id: "milk", name: "Trà sữa", color: 0xc99670, day: 1 },
  { id: "black", name: "Hồng trà", color: 0xb46e45, day: 1 },
  { id: "matcha", name: "Matcha", color: 0xa8c88a, day: 3 },
  { id: "green", name: "Lục trà", color: 0xb2bd69, day: 5 },
  { id: "oolong", name: "Oolong", color: 0xd7a664, day: 8 },
  { id: "thai", name: "Trà Thái", color: 0xeea355, day: 10 },
];
export const toppings = [
  { id: "pearl", name: "Trân châu", day: 1 },
  { id: "pudding", name: "Pudding", day: 3 },
  { id: "jelly", name: "Thạch cà phê", day: 5 },
  { id: "aloe", name: "Nha đam", day: 11 },
];
export const flavors = [
  { id: "plain", name: "Nguyên vị", day: 1 },
  { id: "peach", name: "Đào", day: 6 },
  { id: "berry", name: "Dâu", day: 10 },
];
export const supplies = [
  ...teas.map((t) => ({
    id: t.id,
    name: t.name,
    price: 2400,
    pack: 20,
    life: 4,
  })),
  { id: "milkPowder", name: "Sữa", price: 1500, pack: 20, life: 4 },
  { id: "sugar", name: "Đường", price: 300, pack: 20, life: 8 },
  { id: "ice", name: "Đá", price: 300, pack: 20, life: 2 },
  ...toppings.map((t) => ({
    id: t.id,
    name: t.name,
    price: 1000,
    pack: 20,
    life: 3,
  })),
  { id: "peach", name: "Hương đào", price: 600, pack: 20, life: 6 },
  { id: "berry", name: "Hương dâu", price: 600, pack: 20, life: 6 },
  { id: "cupM", name: "Ly M", price: 700, pack: 20, life: 999 },
  { id: "cupL", name: "Ly L", price: 900, pack: 20, life: 999 },
  { id: "lid", name: "Nắp", price: 300, pack: 20, life: 999 },
];
export const upgrades = [
  ...teas
    .filter((t) => t.day > 1)
    .map((t) => ({
      id: "tea-" + t.id,
      name: "Mở bình " + t.name,
      desc: "Cho phép pha và nhận đơn " + t.name,
      price: 12000 + t.day * 1000,
      day: t.day,
      max: 1,
    })),
  ...toppings
    .filter((t) => t.day > 1)
    .map((t) => ({
      id: "top-" + t.id,
      name: "Mở " + t.name,
      desc: "Thêm topping này vào menu",
      price: 14000,
      day: t.day,
      max: 1,
    })),
  ...flavors
    .filter((t) => t.day > 1)
    .map((t) => ({
      id: "flavor-" + t.id,
      name: "Mở hương " + t.name,
      desc: "Thêm hương vị này vào menu",
      price: 10000,
      day: t.day,
      max: 1,
    })),
  {
    id: "size",
    name: "Ly lớn, niềm vui lớn",
    desc: "Mở size L từ ngày 3",
    price: 25000,
    day: 3,
    max: 1,
  },
  {
    id: "sealer",
    name: "Máy dán nắp",
    desc: "Mỗi cấp giảm 0,35 giây",
    price: 18000,
    day: 1,
    max: 3,
  },
  {
    id: "counter",
    name: "Quầy rộng rãi",
    desc: "Khách kiên nhẫn thêm 15 giây/cấp",
    price: 22000,
    day: 2,
    max: 3,
  },
  {
    id: "storage",
    name: "Kho gọn gàng",
    desc: "Tăng sức chứa mỗi loại thêm 40",
    price: 18000,
    day: 1,
    max: 3,
  },
  {
    id: "fridge",
    name: "Tủ lạnh Mây",
    desc: "Hạn dùng tăng thêm 2 ngày/cấp",
    price: 28000,
    day: 3,
    max: 2,
  },
  {
    id: "staff",
    name: "Bạn đồng hành",
    desc: "Hỗ trợ máy nắp, lương 8.000đ/ngày",
    price: 30000,
    day: 5,
    max: 1,
  },
  {
    id: "decor",
    name: "Không gian ấm áp",
    desc: "Tăng tiền tip 5%/cấp",
    price: 14000,
    day: 1,
    max: 3,
  },
];
const names = [
  "An",
  "Bình",
  "Chi",
  "Dũng",
  "Hà",
  "Hải",
  "Hân",
  "Khôi",
  "Lan",
  "Linh",
  "Mai",
  "Minh",
  "My",
  "Nam",
  "Ngân",
  "Phúc",
  "Quân",
  "Thảo",
  "Trâm",
  "Vy",
];
export const customers = names.map((name, i) => ({
  id: i,
  name,
  avatar: `/assets/customer-${i}.svg`,
  personality: ["Dễ thương", "Khách quen", "Khó tính", "VIP"][i % 4],
  patience: 105 + (i % 5) * 12,
  strictness: i % 4 === 2 ? 1.2 : 1,
  preference: teas[i % 6].id,
}));
export interface Recipe {
  id: string;
  tea: string;
  size: "M" | "L";
  topping: string;
  flavor: string;
  sugar: number;
  ice: number;
  price: number;
  day: number;
  name: string;
}
export const recipes: Recipe[] = Array.from({ length: 36 }, (_, i) => {
  const t = teas[i % 6],
    p = toppings[Math.floor(i / 6) % 4],
    f = flavors[Math.floor(i / 12)];
  return {
    id: `recipe-${i}`,
    tea: t.id,
    size: i >= 18 ? "L" : "M",
    topping: p.id,
    flavor: f.id,
    sugar: [70, 50, 30][Math.floor(i / 6) % 3],
    ice: i % 3 === 0 ? 50 : 100,
    price: 26000 + (i >= 18 ? 6000 : 0) + (f.id !== "plain" ? 4000 : 0),
    day: Math.max(
      t.day,
      p.day,
      f.day,
      i >= 30 ? 21 : i >= 24 ? 11 : i >= 18 ? 11 : i >= 12 ? 6 : 1,
    ),
    name: `${t.name} ${p.name.toLowerCase()}`,
  };
});
export const money = (n: number) => Math.round(n).toLocaleString("vi-VN") + "đ";
export const label = (id: string) =>
  [...teas, ...toppings, ...flavors, ...supplies].find((x) => x.id === id)
    ?.name ?? id;

export function unlocked(
  s: { day: number; upgrades: Record<string, number> },
  id: string,
) {
  const tea = teas.find((t) => t.id === id),
    top = toppings.find((t) => t.id === id),
    flavor = flavors.find((t) => t.id === id);
  const item = tea ?? top ?? flavor;
  if (!item) return false;
  if (item.day === 1) return true;
  return (
    s.day >= item.day &&
    !!s.upgrades[(tea ? "tea-" : top ? "top-" : "flavor-") + id]
  );
}
