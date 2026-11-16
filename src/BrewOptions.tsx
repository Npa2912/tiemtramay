import { flavors, toppings, unlocked, label } from './catalog';
import type { Action, State } from './engine';
export function BrewOptions({game:s,act}:{game:State;act:(a:Action)=>void}) {
 const c=s.cup;
 function choose(a:Action){if(s.paused)act({type:'pause'});act(a);if(s.paused)act({type:'pause'});}
 return <div className="brew-controls"><p className="hint">{s.orders[0]?`${label(s.orders[0].recipe.tea)} · ${s.orders[0].recipe.size} · ${label(s.orders[0].recipe.topping)} · ${label(s.orders[0].recipe.flavor)} · ${s.orders[0].recipe.sugar}% đường · ${s.orders[0].recipe.ice}% đá`:'Hãy mở cửa và chọn ly trước khi pha.'}</p><p className="hint">Nguyên liệu đã thêm không thể lấy lại. Chọn đúng theo đơn khách nhé.</p>
 {([{title:'Topping',items:toppings,type:'top',selected:c?.topping},{title:'Hương vị',items:flavors,type:'flavor',selected:c?.flavor}] as const).map(group=><section key={group.type}><h3>{group.title}</h3><div className="brew-grid">{group.items.map(t=><button key={t.id} className={group.selected===t.id?'active':''} disabled={!c||s.phase!=='open'||!!group.selected||!unlocked(s,t.id)||c.sealed||c.sealLeft>0} onClick={()=>choose({type:group.type,id:t.id})}>{t.name}</button>)}</div></section>)}
 {([{title:'Đường',type:'sugar',values:[0,30,50,70,100],selected:c?.sugar},{title:'Đá',type:'ice',values:[0,50,100],selected:c?.ice}] as const).map(group=><section key={group.type}><h3>{group.title}</h3><div className="brew-grid">{group.values.map(v=><button key={v} className={group.selected===v?'active':''} disabled={!c||s.phase!=='open'||group.selected!==null||c.sealed||c.sealLeft>0} onClick={()=>choose({type:group.type,value:v})}>{v}%</button>)}</div></section>)}
 </div>;
}
