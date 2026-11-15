from pathlib import Path
p=Path(__file__).resolve().parents[1]/'public/assets'
def svg(name,body,w=180,h=180):
 (p/(name+'.svg')).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><g stroke="#795447" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">{body}</g></svg>')
colors=['#b7cca7','#eab6b6','#f3d395','#a7c6cd','#bfafd6']
for i in range(20):
 hair=['#674c42','#ae7957','#4b4543','#b79573'][i%4]; shirt=colors[i%5]
 b=f'<ellipse cx="90" cy="165" rx="67" ry="10" fill="#795447" opacity=".12" stroke="none"/><path d="M34 165 Q31 111 90 113 Q147 111 148 165Z" fill="{shirt}"/><path d="M72 122 L90 138 108 122" fill="#fff0d8"/><ellipse cx="90" cy="74" rx="51" ry="56" fill="{hair}"/><ellipse cx="39" cy="87" rx="9" ry="13" fill="#f6d4ba"/><ellipse cx="141" cy="87" rx="9" ry="13" fill="#f6d4ba"/><path d="M46 63 Q89 27 134 63 L134 91 Q132 126 90 128 Q47 126 46 91Z" fill="#f6d4ba"/><path d="M43 72 Q37 20 88 18 Q142 14 139 71 Q110 65 91 43 Q78 66 43 72Z" fill="{hair}"/><ellipse cx="62" cy="98" rx="10" ry="5" fill="#eea2a3" stroke="none"/><ellipse cx="119" cy="98" rx="10" ry="5" fill="#eea2a3" stroke="none"/><path d="M69 84 v7 m42-7 v7" stroke-width="5"/><path d="M81 102 Q90 111 100 102" fill="none"/>'
 if i%4==0:b+='<path d="M48 45 Q25 24 42 19 Q60 16 61 42 M48 45 Q79 15 81 32 Q83 49 48 45" fill="#f3a6b2"/>'
 if i%4==1:b+='<path d="M56 86 Q72 78 82 86 L82 97 Q67 106 56 96Z M98 86 Q114 78 125 86 L125 97 Q110 106 98 96Z M82 88 h16" fill="none" stroke-width="2"/>'
 if i%4==3:b+='<path d="M48 29 L61 10 79 24 94 6 112 25 131 12 134 39Z" fill="#f6d99c"/>'
 svg('customer-'+str(i),b)
for id,color in [('milk','#cc9c77'),('black','#b7734d'),('matcha','#a8c88a'),('green','#b6c178'),('oolong','#d7a664'),('thai','#eea355')]:
 svg('tea-'+id,f'<ellipse cx="60" cy="142" rx="42" ry="7" fill="#795447" opacity=".12" stroke="none"/><path d="M25 29 Q60 13 95 29 L91 119 Q60 137 29 119Z" fill="#f8ead5"/><path d="M30 58 Q60 68 91 58 L88 115 Q60 128 33 115Z" fill="{color}"/><ellipse cx="60" cy="29" rx="35" ry="9" fill="#f5d8bb"/><path d="M48 16 h24 v10 H48Z" fill="#b89077"/><path d="M91 52 Q119 53 108 89 L93 94" fill="none" stroke-width="7"/><path d="M43 41 v49" stroke="#fff7eb" stroke-width="7" opacity=".7"/><path d="M51 121 v12 h17 v8 H52" fill="#b89077"/><ellipse cx="60" cy="89" rx="16" ry="19" fill="#fff0d8"/><path d="M52 89 q8-12 16 0 q-8 13-16 0Z" fill="{color}"/>',120,155)
svg('shop','''<defs><pattern id="wall" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M15 4 v2 M4 17 h2" stroke="#c59f83" opacity=".2"/></pattern></defs><path d="M0 0 H420 V370 H0Z" fill="#f7e4c9" stroke="none"/><path d="M0 0 H420 V220 H0Z" fill="url(#wall)" stroke="none"/><path d="M16 24 H112 V144 H16Z" fill="#b9d0ca"/><path d="M24 32 H104 V136 H24Z" fill="#deebe0"/><path d="M64 32 V136 M24 83 H104" stroke="#b5a58c"/><path d="M0 195 Q200 186 420 195 V370 H0Z" fill="#d1aa88"/><path d="M0 211 H420 M0 328 H420" stroke="#bb8e6f"/><ellipse cx="201" cy="303" rx="84" ry="13" fill="#795447" opacity=".12" stroke="none"/><path d="M312 170 H395 V304 H312Z" fill="#f0b9b4"/><path d="M321 180 H385 V230 H321Z" fill="#fff0d8"/><path d="M333 199 H373" stroke-width="8"/><path d="M329 246 H379 V255 H329Z" fill="#795447"/><path d="M318 289 H389 V304 H318Z" fill="#b98579"/><circle cx="379" cy="189" r="4" fill="#a8c88a"/><path d="M20 164 h44 l-5 33 H25Z" fill="#f3a6b2"/><path d="M42 165 V122 M42 147 Q12 120 28 117 Q44 121 42 147 M42 153 Q70 121 72 139 Q67 155 42 153" fill="#a8c88a"/><path d="M143 18 H276 Q285 18 285 27 V65 Q285 76 275 76 H143 Q134 76 134 65 V28 Q134 18 143 18Z" fill="#fff5e1"/><path d="M148 36 Q159 25 170 36 Q183 19 196 36 Q216 28 218 43 H148Z" fill="#f3a6b2"/><path d="M156 57 H263" stroke="#c4a180" stroke-width="2"/>''',420,370)
svg('cloud','<path d="M31 116 Q8 113 13 90 Q15 72 40 74 Q36 44 64 42 Q79 15 104 36 Q134 27 140 56 Q168 54 169 81 Q182 112 153 117Z" fill="#fff9ec"/><path d="M68 82 v5 m43-5 v5 M82 98 q8 7 16 0" fill="none"/><ellipse cx="54" cy="96" rx="8" ry="4" fill="#f3a6b2" stroke="none"/><ellipse cx="122" cy="96" rx="8" ry="4" fill="#f3a6b2" stroke="none"/>')
# Consistent expressions for every character, kept as independent reusable assets.
for i in range(20):
 original=(p/f'customer-{i}.svg').read_text()
 for mood,mouth in [('happy','M79 101 Q90 123 102 101Z'),('satisfied','M79 102 Q90 114 102 102'),('sad','M81 109 Q90 99 100 109'),('angry','M81 110 Q90 104 100 110')]:
  body=original.replace('M81 102 Q90 111 100 102',mouth)
  if mood=='angry':body=body.replace('M69 84 v7 m42-7 v7','M63 80 l12 5 m31 0 12-5 M69 87 v4 m42-4 v4')
  if mood=='happy':body=body.replace('M69 84 v7 m42-7 v7','M63 88 q6-9 12 0 m30 0 q6-9 12 0')
  (p/f'customer-{i}-{mood}.svg').write_text(body)
