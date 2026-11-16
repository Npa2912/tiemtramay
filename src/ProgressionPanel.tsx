import {
  events,
  migrateProgression,
  quests,
  securityCatalog,
  staffCatalog,
  type ProgressionAction,
} from "./progression";
import { money } from "./catalog";
import type { State } from "./engine";
export function ProgressionPanel({
  game,
  tab,
  act,
}: {
  game: State;
  tab: "events" | "staff" | "quests" | "achievements";
  act: (a: ProgressionAction) => void;
}) {
  const p = migrateProgression(game).progression;
  if (tab === "events") {
    const event = events.find((e) => e.id === p.event?.id);
    return (
      <div className="progression-panel">
        <h3>Chuyện ở góc phố</h3>
        {event ? (
          <article className="event-story">
            <h3>{event.name}</h3>
            <p>{event.story}</p>
            {event.choices.map((c) => (
              <button
                key={c.id}
                onClick={() => act({ type: "eventChoice", choice: c.id })}
                disabled={
                  (!!c.requires && !p.security[c.requires]) ||
                  (c.cost ?? 0) > game.money
                }
              >
                <b>{c.label}</b>
                <small>{c.description}</small>
              </button>
            ))}
          </article>
        ) : (
          <p className="hint">
            Hôm nay khu phố yên bình. Sự kiện có thể xuất hiện từ ngày 3, cách
            nhau ít nhất 3 ngày; mỗi sự kiện có thời gian hồi riêng.
          </p>
        )}
        <h3>Nhật ký khu phố</h3>
        {p.eventHistory.length === 0 ? (
          <p className="hint">Mây đang chờ câu chuyện đầu tiên.</p>
        ) : (
          p.eventHistory
            .slice()
            .reverse()
            .map((h, i) => (
              <article className="receipt" key={`${h.id}-${i}`}>
                <b>
                  Ngày {h.day} · {events.find((e) => e.id === h.id)?.name}
                </b>
                <p>{h.text}</p>
              </article>
            ))
        )}
        <h3>An ninh & dự phòng</h3>
        {securityCatalog.map((item) => (
          <article className="upgrade-card" key={item.id}>
            <div>
              <b>{item.name}</b>
              <p>{item.desc}</p>
              <small>Từ ngày {item.day}</small>
            </div>
            <button
              disabled={
                !!p.security[item.id] ||
                game.day < item.day ||
                game.money < item.cost ||
                game.phase === "open"
              }
              onClick={() => act({ type: "security", id: item.id })}
            >
              {p.security[item.id] ? "Đã lắp" : money(item.cost)}
            </button>
          </article>
        ))}
      </div>
    );
  }
  if (tab === "staff")
    return (
      <div className="progression-panel">
        <p className="hint">
          Nhân viên hỗ trợ khi được phân công. Lương được trừ lúc kết sổ; thiếu
          quỹ lương sẽ tạm nghỉ. Tuyển và đào tạo khi đóng cửa.
        </p>
        {staffCatalog.map((member, i) => {
          const current = p.staff[member.id];
          return (
            <article className="staff-card" key={member.id}>
              <img src={`/assets/customer-${i + 5}.svg`} alt="" width="58" />
              <div>
                <b>
                  {member.name} · {member.role}
                </b>
                <small>
                  {current
                    ? `Cấp ${current.level} · ${current.active ? "Đang hỗ trợ" : "Tạm nghỉ"}`
                    : `Từ ngày ${member.day}`}
                </small>
                <p>{member.desc}</p>
                <small>Lương {money(member.wage)}/ngày</small>
                {current ? (
                  <div className="staff-actions">
                    <button
                      disabled={game.phase === "open"}
                      onClick={() =>
                        act({ type: "staffAssign", id: member.id })
                      }
                    >
                      {current.active ? "Cho nghỉ" : "Phân công"}
                    </button>
                    <button
                      disabled={
                        current.level >= 5 ||
                        game.money < 10000 * current.level ||
                        game.phase === "open"
                      }
                      onClick={() => act({ type: "train", id: member.id })}
                    >
                      Đào tạo · {money(10000 * current.level)}
                    </button>
                  </div>
                ) : (
                  <button
                    disabled={
                      game.day < member.day ||
                      game.money < member.cost ||
                      game.phase === "open"
                    }
                    onClick={() => act({ type: "hire", id: member.id })}
                  >
                    Tuyển · {money(member.cost)}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    );
  const list = quests.filter((q) =>
    tab === "achievements"
      ? q.kind === "achievement"
      : q.kind !== "achievement",
  );
  return (
    <div className="progression-panel">
      <p className="hint">
        {tab === "achievements"
          ? "20 danh hiệu lưu cùng hành trình của tiệm."
          : "30 nhiệm vụ chính và 50 nhiệm vụ phụ. Hoàn thành mục tiêu và nhận thưởng một lần."}
      </p>
      {list.map((q) => {
        const value = p.metrics[q.metric],
          claimed = p.claimed.includes(q.id);
        return (
          <article
            className={`quest-card ${claimed ? "quest-claimed" : ""}`}
            key={q.id}
          >
            <div>
              <small>
                {q.kind === "main"
                  ? "HÀNH TRÌNH"
                  : q.kind === "side"
                    ? "CHUYỆN NHỎ"
                    : "THÀNH TỰU"}
              </small>
              <b>{q.name}</b>
              <p>{q.description}</p>
              <progress value={Math.min(value, q.target)} max={q.target} />
              <small>
                {Math.min(value, q.target).toLocaleString("vi-VN")} /{" "}
                {q.target.toLocaleString("vi-VN")}
              </small>
            </div>
            <button
              disabled={claimed || value < q.target}
              onClick={() => act({ type: "claimQuest", id: q.id })}
            >
              {claimed ? "✓ Đã nhận" : money(q.reward)}
            </button>
          </article>
        );
      })}
    </div>
  );
}
