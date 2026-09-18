/* Dungeon Summon — deep dive (TH)
 * ข้อมูลทั้งหมดอ่านจากเพลส Solo (placeId 78995314774794) ผ่าน Roblox Studio MCP เมื่อ 2026-09-18
 * ที่มา: ReplicatedStorage.Config.*, ServerScriptService.Services.*, Classes.*
 */

/* ---------------------------------------------------------------- boot flow */
const nodes = {
  bootstrap: {
    title: '1. Bootstrap — เริ่มระบบตามลำดับที่กำหนดเอง',
    body: '<code>ServerScriptService.Bootstrap</code> เป็น Script ธรรมดาที่ไม่ยอมให้ Roblox ตัดสินลำดับการโหลดเอง มันถือลิสต์ <code>SERVICE_ORDER</code> 20 ชื่อ แล้วทำงานเป็น 3 รอบแยกกัน',
    points: [
      '<b>รอบ 1 — require:</b> โหลดทุก ModuleScript ตามลำดับ ห่อด้วย <code>pcall</code> ถ้าตัวไหนพังจะ <code>warn</code> แล้วข้ามไป ไม่ล้มทั้งเซิร์ฟเวอร์',
      '<b>รอบ 2 — Init():</b> ทุก Service ต่อ Signal และผูก dependency ตรงนี้ ยังไม่สร้างของจริง',
      '<b>รอบ 3 — Start():</b> เรียกด้วย <code>task.spawn</code> ทุกตัว จึงเริ่มสร้าง Gate, ปาร์ตี้ และ world object ได้พร้อมกันโดยไม่บล็อกกัน',
      '<b>กันพลาด:</b> ถ้ามี ModuleScript ใน <code>Services/</code> ที่ไม่มีชื่อในลิสต์ จะขึ้นเตือนว่า “will not be started”',
    ],
  },
  services: {
    title: '2. Services — เจ้าของกฎและอายุของระบบ',
    body: 'Service คือระบบเดียวต่อเซิร์ฟเวอร์ แต่ละตัวเป็นเจ้าของ Class ที่มันสร้าง และเป็นที่เดียวที่มีสิทธิ์ทำลายมัน',
    points: [
      '<code>DataService</code> — โค้ดชิ้นเดียวในเกมที่แตะ DataStore ใช้ ProfileService store <code>PlayerData_v1</code> key <code>Player_&lt;UserId&gt;</code>',
      '<code>PartyService</code> — ถือ <code>Party</code> ของผู้เล่นแต่ละคน และเป็นเจ้าของการสลับตัวควบคุม',
      '<code>GateService</code> — ถือ <code>Gate</code> ทุกบาน คุม stability tick, rank cap, และโควตา break',
      '<code>DungeonService</code> — ถือ <code>DungeonInstance</code> และจัดการ slot สูงสุด 20 ชุด',
      '<code>InventoryService</code> + <code>ClassService</code> — ไม่ได้แก้ stat เอง แต่ลงทะเบียนผ่าน <code>PartyService.RegisterExtrasProvider</code>',
    ],
  },
  classes: {
    title: '3. Classes — state ของสิ่งที่มีได้หลายตัว',
    body: 'ใช้ metatable OOP แบบบาง ๆ: <code>.new()</code> + เมธอด + <code>:Destroy()</code> ไม่มีการสืบทอดลึก ความต่างมาจากข้อมูลใน Config',
    points: [
      '<b>7 คลาสในเพลส:</b> <code>Gate</code>, <code>Hunter</code>, <code>Party</code>, <code>Monster</code>, <code>AIBrain</code>, <code>DungeonInstance</code>, <code>RigAnimator</code>',
      '<b>ทุกตัวต้องมี <code>Destroy()</code></b> ที่ disconnect connection ใน <code>self._connections</code> — จำเป็นเพราะ Gate เกิด/ตายตลอดเวลา',
      '<b>คุยออกข้างนอกด้วย Signal:</b> เช่น <code>gate.StabilityZero</code>, <code>party.Wiped</code>, <code>instance.Cleared</code>',
      '<b>Composition:</b> ทั้ง <code>Hunter</code> และ <code>Monster</code> ต่างมี <code>AIBrain</code> เป็นของตัวเอง ไม่ได้สืบทอดจากคลาสแม่ร่วมกัน',
    ],
  },
  remotes: {
    title: '4. Remotes — ข้ามจาก UI ไปหา Server อย่างปลอดภัย',
    body: 'มี 10 โฟลเดอร์แบ่งตามระบบ รวม 24 remote กติกาคือ Client <b>ขอ</b> เท่านั้น ไม่เคย <b>สั่ง</b>',
    points: [
      '<b>RemoteFunction</b> ใช้เมื่อ Client ต้องรู้ผลทันที เช่น <code>EnterGate</code> คืน <code>(ok, ข้อความ)</code> ให้เอาไปแสดงได้เลย',
      '<b>RemoteEvent</b> ใช้เมื่อไม่ต้องรอคำตอบ เช่น <code>RequestSwap</code>, <code>PartyState</code>',
      '<b>Attribute แทน Remote ถี่ ๆ:</b> Stability ของ Gate อัปเดตผ่าน attribute ทุก 0.5 วินาที ไม่ใช่ยิง Remote ทุกเฟรม',
      '<b>เกร็ดจากโค้ดจริง:</b> remote ชื่อ <code>Changed</code> ใช้ไม่ได้ เพราะชนกับ <code>Instance.Changed</code> ของโฟลเดอร์ จึงต้องตั้งชื่อ <code>KeyChanged</code>',
    ],
  },
  client: {
    title: '5. Controllers — ทำให้ผู้เล่นมองเห็นและควบคุมได้',
    body: '<code>ClientBootstrap</code> ใช้ pattern เดียวกับฝั่ง Server เป๊ะ ๆ แต่โหลด 15 controller',
    points: [
      '<code>GuiController</code> ต้องมาก่อนสุด เพราะ <code>CharacterAutoLoads = false</code> ทำให้ Roblox ไม่ copy StarterGui ให้เอง',
      '<code>DataController</code> เก็บสำเนา profile ไว้ในเครื่อง controller อื่นอ่านจากสำเนานี้ ไม่ยิง Remote ซ้ำ',
      '<code>CameraController</code> จำเป็นเพราะกล้องไม่ตามตัวละครที่ถูก reassign ผ่าน <code>player.Character</code>',
      '<b>Controller ไม่ตัดสินอะไรเลย</b> — Gold, ดาเมจ, ผล Gate ทั้งหมดมาจาก Server แล้ว controller แค่วาด',
      '<b>คีย์ลัด:</b> <code>1/2/3</code> สลับ Hunter · <code>Q</code> วง AI mode · <code>P</code> ปาร์ตี้ · <code>B</code> กระเป๋า · <code>H</code> ยา · <code>T</code> กับดัก · <code>K</code> คลาส · <code>J</code> เควส',
    ],
  },
};

/* ---------------------------------------------------- config tables (real) */
const configTabs = [
  {
    id: 'gates',
    label: 'Gate ทั้ง 7 ระดับ',
    note: 'จาก <code>Config/GateDefs.Ranks</code> · <b>Stability</b> คือเวลาเต็มจาก 100% ถึง 0% ที่ความเร็ว 1.0 และผู้เล่น 3 คนขึ้นไป · <b>Mon &times;</b> คือตัวคูณ HP และ ATK ของมอนสเตอร์ในนั้น',
    head: ['Rank', 'สี', 'Stability', 'พลังแนะนำ', 'โอกาสมี Modifier', 'น้ำหนักการเกิด', 'Mon &times;', 'Gold ที่ได้'],
    rows: [
      ['E', 'Blue', '20 นาที', '100', '0%', '40', '1.0', '50–80'],
      ['D', 'Blue', '25 นาที', '200', '0%', '25', '1.6', '90–140'],
      ['C', 'Blue', '30 นาที', '400', '5%', '15', '2.5', '160–240'],
      ['B', 'Purple', '35 นาที', '700', '10%', '10', '4.0', '280–400'],
      ['A', 'Red', '45 นาที', '1,200', '40%', '6', '6.5', '500–750'],
      ['S', 'Red', '60 นาที', '2,000', '60%', '3', '10.0', '900–1,300'],
      ['Secret (Abyss)', 'Black', '30 นาที', '3,500', '100%', '1', '16.0', '2,000–3,000'],
    ],
    after: '<div class="callout"><b>ตั้งค่าระดับระบบ</b> (<code>GateDefs.Settings</code>): spawn ทุก <b>90 วินาที</b> · เปิดพร้อมกันสูงสุด <b>4</b> บาน · เริ่มเซิร์ฟเวอร์ด้วย <b>3</b> บาน · เข้าได้เมื่ออยู่ใน <b>20 studs</b> · break พร้อมกันได้ <b>1</b> · พื้น stability ตอนคิว <b>5%</b> · cooldown หลัง break <b>300 วินาที</b> · rank cap <b>&times;1.5</b> ของปาร์ตี้ที่แข็งที่สุด</div>',
  },
  {
    id: 'roles',
    label: 'Hunter 5 บทบาท',
    note: 'จาก <code>Config/RoleDefs</code> — ค่าที่ Lv 1 · เคยปรับ HP&times;2, ATK&times;2, DEF&times;1.5 ตามที่ผู้เล่นขอทีมที่แข็งขึ้น · <b>Power</b> คำนวณด้วย <code>ATK&times;2 + DEF + HP/10</code>',
    head: ['Role', 'HP', 'ATK', 'DEF', 'Speed', 'ระยะโจมตี', 'ระยะที่ชอบยืน', 'คูลดาวน์', 'Power'],
    rows: [
      ['Fighter', '240', '24', '12', '16', '6', '4', '0.8 วิ', '84'],
      ['Mage', '140', '36', '5', '15', '30', '20', '1.2 วิ', '91'],
      ['Tank', '400', '12', '23', '14', '6', '3', '1.0 วิ', '87'],
      ['Healer', '160', '10', '8', '15', '25', '15', '1.5 วิ', '44'],
      ['Assassin', '150', '30', '6', '20', '5', '3', '0.5 วิ', '81'],
    ],
    after: '<div class="callout">สังเกตว่า <b>Power ของ Healer ต่ำที่สุดมาก</b> (44 เทียบกับ 84–91) เพราะสูตรพลังนับแต่ ATK/DEF/HP ไม่ได้นับค่าการฮีล นี่เป็นคำถามออกแบบที่ยังเปิดอยู่ว่าจุดอ่อน “Healer เล่นเดี่ยวยาก” ยังมีความหมายไหมเมื่อมี AI Companion ตลอดเวลา<br><br>ชั่วคราวจนกว่า Stage 5 จะมาถึง: combat ฮีลเป็น <code>ATK &times; 2</code> ดังนั้น <code>StatCalc</code> จึงเอา <code>HealingMultiplier</code> ไปคูณ ATK ของ Healer โดยตรง</div>',
  },
  {
    id: 'hunters',
    label: 'Hunter 11 ตัว',
    note: 'จาก <code>Config/HunterDefs</code> · <b>Rarity</b> มีผลสองทาง: โอกาสสุ่มได้ตอน recruit และตัวคูณ stat (<code>RarityStatMultiplier</code>)',
    head: ['ชื่อ', 'id', 'Role', 'Rarity', 'ตัวคูณ stat', 'ที่มา'],
    rows: [
      ['Kang Doyun', 'hunter_fighter_01', 'Fighter', 'Common', '&times;1.00', 'ปาร์ตี้เริ่มต้น'],
      ['Han Seoa', 'hunter_mage_01', 'Mage', 'Common', '&times;1.00', 'ปาร์ตี้เริ่มต้น'],
      ['Choi Mina', 'hunter_healer_01', 'Healer', 'Common', '&times;1.00', 'ปาร์ตี้เริ่มต้น'],
      ['Baek Taeho', 'hunter_tank_01', 'Tank', 'Common', '&times;1.00', 'Recruit'],
      ['Yoon Hyun', 'hunter_assassin_01', 'Assassin', 'Common', '&times;1.00', 'Recruit'],
      ['Park Jiwon', 'hunter_fighter_02', 'Fighter', 'Rare', '&times;1.10', 'Recruit'],
      ['Lee Hana', 'hunter_mage_02', 'Mage', 'Rare', '&times;1.10', 'Recruit'],
      ['Jung Minho', 'hunter_tank_02', 'Tank', 'Rare', '&times;1.10', 'Recruit'],
      ['Seo Yuna', 'hunter_healer_02', 'Healer', 'Epic', '&times;1.20', 'Recruit'],
      ['Kim Rian', 'hunter_assassin_02', 'Assassin', 'Epic', '&times;1.20', 'Recruit'],
      ['Go Taesan', 'hunter_fighter_03', 'Fighter', 'Legendary', '&times;1.35', 'Recruit'],
    ],
    after: '<div class="callout"><b>Recruit</b> (<code>RecruitDefs</code>): ครั้งละ <b>30 Diamonds</b> · น้ำหนัก Common 55 / Rare 32 / Epic 11 / Legendary 2 · ได้ตัวซ้ำจะแปลงเป็น <b>400 EXP</b> ให้ Hunter ตัวนั้นแทน<br><br><b>หมายเหตุจากโค้ด:</b> มีแต่ Hunter ชุด <code>_01</code> เท่านั้นที่มี Signature Weapon ส่วนตัวอื่นยังใช้ rig ที่ generate ขึ้นมาตอน runtime</div>',
  },
  {
    id: 'monsters',
    label: 'มอนสเตอร์',
    note: 'จาก <code>Config/MonsterDefs</code> — ค่าฐานที่ rank E · ค่าจริงในเกมคูณด้วย <code>MonsterStatMultiplier</code> ของ Gate rank นั้น (ดูแท็บ Gate)',
    head: ['ชื่อ', 'ธาตุ', 'HP', 'ATK', 'DEF', 'Speed', 'ระยะ', 'คูลดาวน์', 'EXP ที่ให้'],
    rows: [
      ['Goblin', 'Earth', '60', '7', '2', '13', '5', '1.2 วิ', '12'],
      ['Shadow Wolf', 'Dark', '45', '9', '1', '18', '5', '0.9 วิ', '14'],
      ['Orc Brute', 'Earth', '140', '12', '6', '11', '6', '1.6 วิ', '30'],
      ['Goblin Chief <span class="badge hot">บอส</span>', 'Earth', '600', '14', '6', '12', '8', '1.5 วิ', '150'],
    ],
    after: '<div class="callout"><b>สกิลบอส Ground Slam:</b> รัศมี <b>12 studs</b> · เล็งค้าง <b>1.5 วินาที</b> (มี telegraph ให้หลบ) · ดาเมจ <b>25</b> · คูลดาวน์ <b>7 วินาที</b> · เริ่มใช้เมื่อเป้าหมายอยู่ใน <b>20 studs</b><br><br><b>Modifier มีผลกับมอนสเตอร์อย่างไร:</b> Blood Moon ทำให้ธาตุ Dark แรงขึ้น <b>&times;1.5</b> (คือ Shadow Wolf) · Berserk ทำ ATK <b>&times;2</b> แต่ HP <b>&times;0.7</b> · Red Gate ให้รางวัล <b>&times;3</b> แต่ออกจาก Gate ไม่ได้จนกว่าบอสจะตาย</div>',
  },
  {
    id: 'classes',
    label: 'Player Class 9 คลาส',
    note: 'จาก <code>Config/ClassDefs</code> · modifier เป็น <b>ตัวคูณ</b> ที่ใส่ให้ Hunter ทุกตัวในทีม บางตัวจำกัดเฉพาะบาง role หรือเฉพาะชนิดดาเมจ',
    head: ['คลาส', 'Rarity', 'บัฟ', 'เดบัฟ'],
    rows: [
      ['Iron Vanguard', '<span class="badge todo">Common</span>', 'ทีม HP +15%', 'ทีม ATK &minus;5%'],
      ['Swift Blade', '<span class="badge todo">Common</span>', 'Fighter &amp; Assassin ATK +15%', 'Tank DEF &minus;10%'],
      ['Field Medic', '<span class="badge todo">Common</span>', 'การฮีล +20%', 'ATK กายภาพ &minus;5%'],
      ['Arcane Scholar', '<span class="badge ok">Rare</span>', 'Mage ATK +30%', 'ทีม HP &minus;10%'],
      ['Bulwark', '<span class="badge ok">Rare</span>', 'ทีม DEF +20%, Tank HP +20%', 'ทีม Speed &minus;10%'],
      ['War Chief', '<span class="badge wait">Epic</span>', 'ทีม ATK +20%', 'ทีม DEF &minus;10%'],
      ['Monarch of Shadows', '<span class="badge hot">Legendary</span>', 'Assassin ATK +50%', 'การฮีล &minus;20%'],
      ['Archangel', '<span class="badge hot">Legendary</span>', 'ทีม DEF +30%, ฟื้น HP +100%', 'ATK กายภาพ &minus;15%'],
      ['Sovereign of the Abyss', '<span class="badge who">Secret</span>', 'ทีม HP, ATK, DEF +25%', 'การฮีล &minus;10%'],
    ],
    after: '<div class="callout"><b>กติกาการปลุกพลัง:</b> ต้องเคลียร์ Gate ครบ <b>10</b> ครั้งก่อน · ครั้งแรก <b>ฟรี</b> · สุ่มใหม่ครั้งต่อไป <b>50 Diamonds</b> · สลับไปคลาสที่ปลดล็อกแล้ว <b>200 Gold</b><br>น้ำหนักการสุ่ม: Common 60 / Rare 28 / Epic 10 / Legendary 2 — <b>Secret สุ่มไม่ได้</b> ได้จากเควสลับอย่างเดียว<br><br><b>ชนิดดาเมจ:</b> กายภาพ = Fighter, Tank, Assassin · เวทมนตร์ = Mage, Healer<br><b>ฟื้น HP นอกการต่อสู้:</b> 0.4% ของ HP สูงสุดต่อวินาที เริ่มหลังไม่โดนตี 5 วินาที</div>',
  },
  {
    id: 'break',
    label: 'Dungeon Break',
    note: 'จาก <code>Config/BreakDefs</code> · เหตุการณ์ป้องกันฐานร่วมของทั้งเซิร์ฟเวอร์ ไม่ใช่บทลงโทษส่วนตัว · <b>ไม่มีการสูญเสียถาวร</b>',
    head: ['Rank ของ Gate ที่แตก', 'จำนวนระลอก', 'มอนสเตอร์ต่อระลอก', 'รวมทั้งหมด', 'Gold เมื่อชนะ', 'Diamonds เมื่อชนะ'],
    rows: [
      ['E', '3', '3', '9', '60', '3'],
      ['D', '3', '4', '12', '100', '5'],
      ['C', '4', '4', '16', '180', '8'],
      ['B', '4', '5', '20', '300', '12'],
      ['A', '5', '5', '25', '550', '18'],
      ['S', '5', '6', '30', '1,000', '25'],
      ['Secret', '6', '6', '36', '2,000', '40'],
    ],
    after: '<div class="callout"><b>กติกาเหตุการณ์:</b> ยาว <b>180 วินาที</b> · ระลอกห่างกัน <b>30 วินาที</b> (เร็วขึ้นเหลือ 5 วินาทีถ้าเคลียร์ระลอกก่อนหมดเวลา) · มอนสเตอร์จะหยุดสู้กับ Hunter/ยามที่อยู่ใน <b>30 studs</b> แล้วเดินต่อไปหา Core<br><br><b>Energy Core:</b> HP <b>2,500</b> · มอนสเตอร์ตีได้เมื่ออยู่ใน <b>5 studs</b> ดาเมจ <b>12</b> ทุก <b>1.5 วินาที</b> · มียาม NPC <b>2 ตัว</b> (HP 350, ATK 16) คอยช่วยตั้งรับในเซิร์ฟเวอร์ที่คนน้อย<br><br><b>3 ผลลัพธ์:</b> <b>Won</b> = เคลียร์ทุกระลอก ได้รางวัล · <b>Held</b> = หมดเวลา มอนสเตอร์ถอยกลับ · <b>Lost</b> = Core ถูกทำลาย ฐานเข้าสถานะ Damaged<br><br><b>ฐาน Damaged:</b> ล็อก <b>120 วินาที</b> หรือช่วยกันซ่อมให้ครบ <b>250 หน่วย</b> (กด prompt ครั้งละ 25 หน่วย, จ่าย 25 Gold ได้เป็นสองเท่า) ระหว่างนั้นโครงสร้างทุกอันใช้ไม่ได้</div>',
  },
  {
    id: 'items',
    label: 'ไอเทมและดรอป',
    note: 'จาก <code>Config/ItemDefs</code> · <b>Stats</b> คือค่าที่ +0 ส่วน <b>ต่อระดับ</b> คือค่าที่เพิ่มทุกครั้งที่ตีบวก',
    head: ['ไอเทม', 'ช่อง', 'Rarity', 'ใส่ได้เฉพาะ', 'Stats ที่ +0', 'ต่อระดับ', 'ตีบวกสูงสุด', 'ขายได้'],
    rows: [
      ['Rusty Sword', 'Weapon', 'Common', 'Fighter/Tank/Assassin', 'ATK 5', 'ATK 1.5', '+10', '15'],
      ['Oak Staff', 'Weapon', 'Common', 'Mage/Healer', 'ATK 5', 'ATK 1.5', '+10', '15'],
      ['Hunter Blade', 'Weapon', 'Rare', 'Fighter/Tank/Assassin', 'ATK 12', 'ATK 2.5', '+15', '60'],
      ['Crystal Staff', 'Weapon', 'Rare', 'Mage/Healer', 'ATK 12', 'ATK 2.5', '+15', '60'],
      ['Shadow Fang', 'Weapon', 'Epic', 'Assassin/Fighter', 'ATK 22', 'ATK 4', '+20', '200'],
      ['Leather Armor', 'Armor', 'Common', 'ทุก role', 'DEF 3, HP 20', 'DEF 1, HP 6', '+10', '15'],
      ['Chain Mail', 'Armor', 'Rare', 'Fighter/Tank', 'DEF 8, HP 50', 'DEF 2, HP 12', '+15', '60'],
      ['Mage Robe', 'Armor', 'Rare', 'Mage/Healer/Assassin', 'DEF 5, HP 40, ATK 4', 'DEF 1, HP 10, ATK 1', '+15', '60'],
      ['Copper Ring', 'Accessory', 'Common', 'ทุก role', 'HP 25', 'HP 8', '+10', '15'],
      ['Wolf Fang Charm', 'Accessory', 'Rare', 'ทุก role', 'ATK 6', 'ATK 1.5', '+15', '60'],
    ],
    after: '<div class="callout"><b>วัสดุและของใช้:</b> Beast Hide (3 Gold) · Iron Ore (4) · Mana Crystal (10) · Gate Core (40, จากบอส) · <b>Health Potion</b> ฟื้น 40% ของ Hunter ที่ควบคุมอยู่ [H] · <b>Spike Trap</b> ดาเมจ ATK&times;1.5 ต่อวินาที รัศมี 6 studs นาน 25 วินาที [T]<br><br><b>ตารางดรอป</b> สุ่มครั้งเดียวต่อผู้เล่นเมื่อเคลียร์ Gate — Gate E: Beast Hide 90%, Iron Ore 80%, อาวุธ Common 15%, Diamonds 10% (1–3 เม็ด) · Gate D เพิ่มอาวุธ Rare 8% และ Gate Core 8% · Gate C: Iron Ore 100%, Gate Core 20%, Shadow Fang 3%, Diamonds 20% (3–6 เม็ด)<br><b>หมายเหตุ:</b> rank B, A, S และ Secret ยังใช้ตารางเดียวกับ C อยู่ ยังไม่มีตารางของตัวเอง</div>',
  },
  {
    id: 'quests',
    label: 'เควส',
    note: 'จาก <code>Config/QuestDefs</code> · บอร์ดสุ่ม <b>3</b> เควสพร้อมกัน รีเฟรชทุก <b>30 นาที</b> · เควสบนบอร์ดนับความคืบหน้าทันทีโดยไม่ต้องกดรับ แต่ต้องไปกดรับรางวัลที่ Quest Board',
    head: ['เควส', 'ชนิด', 'เป้าหมาย', 'รางวัล'],
    rows: [
      ['Goblin Cull', 'ฆ่ามอนสเตอร์', 'Goblin 15 ตัว', '120 Gold + 150 EXP'],
      ['Wolf Hunt', 'ฆ่ามอนสเตอร์', 'Shadow Wolf 10 ตัว', '140 Gold + Beast Hide 3'],
      ['Pest Control', 'ฆ่ามอนสเตอร์', 'อะไรก็ได้ 30 ตัว', '200 Gold + 5 Diamonds'],
      ['Gate Patrol', 'เคลียร์ Gate', 'rank E ขึ้นไป 2 บาน', '150 Gold + Iron Ore 4'],
      ['Gate Sweep', 'เคลียร์ Gate', 'rank E ขึ้นไป 4 บาน', '10 Diamonds + 250 EXP'],
      ['Higher Ground', 'เคลียร์ Gate', 'rank D ขึ้นไป 1 บาน', '250 Gold + 10 Diamonds'],
      ['Hold the Line', 'ป้องกัน Break', 'สำเร็จ 1 ครั้ง', '15 Diamonds + Mana Crystal 2'],
    ],
    after: '<div class="callout"><b>เควสลับ “??? The Abyss Calls”</b> — คำใบ้จะโผล่บนบอร์ดได้เมื่อเคลียร์ Gate สะสมครบ <b>20</b> ครั้ง และมีโอกาส <b>30%</b> ต่อการรีเฟรชหนึ่งครั้ง<br>ข้อความใบ้ในโค้ด: “Walk through red, hold the line, descend deeper.”<br><br><b>3 ขั้นตอน:</b> 1) เคลียร์ Red Gate 1 บาน → 2) ป้องกัน Dungeon Break 3 ครั้ง → 3) เคลียร์ Gate rank C ขึ้นไป 3 บาน<br><b>รางวัล:</b> คลาส Secret <code>abyss_sovereign</code> ซึ่งเป็นทางเดียวที่จะได้คลาสระดับนี้</div>',
  },
];

/* --------------------------------------------------------- contracts tabs */
const contractTabs = [
  {
    id: 'remotes',
    label: 'Remotes (24 ตัว)',
    note: 'ทุกตัวอยู่ใน <code>ReplicatedStorage.Remotes</code> · <b>RF</b> = RemoteFunction (รอคำตอบ), <b>RE</b> = RemoteEvent (ไม่รอ)',
    head: ['โฟลเดอร์', 'Remote', 'ชนิด', 'ทิศทาง', 'Server ตรวจอะไรก่อน'],
    rows: [
      ['Party', 'RequestSwap', 'RE', 'Client → Server', 'มีปาร์ตี้จริง, index เป็นตัวเลข'],
      ['Party', 'SetAIMode', 'RE', 'Client → Server', 'มีปาร์ตี้จริง, mode เป็น string'],
      ['Party', 'PartyState', 'RE', 'Server → Client', 'ส่งเมื่อปาร์ตี้เปลี่ยนเท่านั้น'],
      ['Party', 'GetPartyState', 'RF', 'Client → Server', 'คืน state ของปาร์ตี้ตัวเอง'],
      ['Party', 'SetParty', 'RF', 'Client → Server', 'ต้อง 3 ตัวพอดี, เป็นเจ้าของทุกตัว, ห้ามซ้ำ, ไม่อยู่ใน Gate, ไม่ wipe'],
      ['Gate', 'GetGateInfo', 'RF', 'Client → Server', 'gateId เป็น string, Gate ยังมีอยู่'],
      ['Gate', 'EnterGate', 'RF', 'Client → Server', 'Gate เปิดอยู่, Hunter ยังไม่ตาย, อยู่ใน 20 studs'],
      ['Dungeon', 'DungeonState / Results / Message', 'RE', 'Server → Client', 'ส่งเฉพาะเจ้าของ instance'],
      ['Combat', 'BasicAttack', 'RE', 'Client → Server', 'ปาร์ตี้ไม่ wipe, Hunter ที่ควบคุมยังมีชีวิต'],
      ['Data', 'Snapshot / KeyChanged', 'RE', 'Server → Client', 'ส่งเฉพาะข้อมูลของผู้เล่นคนนั้น'],
      ['Data', 'GetSnapshot', 'RF', 'Client → Server', 'ใช้กู้กรณี snapshot มาก่อน controller พร้อม'],
      ['Items', 'Equip / Unequip', 'RF', 'Client → Server', 'เป็นเจ้าของไอเทม, role ใส่ได้, ไม่อยู่ใน Gate'],
      ['Items', 'Sell', 'RF', 'Client → Server', 'เป็นเจ้าของไอเทม'],
      ['Items', 'UseConsumable', 'RF', 'Client → Server', 'มีของจริง, Hunter ที่ควบคุมยังมีชีวิต'],
      ['Items', 'Craft', 'RF', 'Client → Server', 'อยู่ใกล้ Crafting Table, ฐานไม่ Damaged, มีวัสดุ + Gold ครบ'],
      ['Items', 'Upgrade / ForgeSignature', 'RF', 'Client → Server', 'อยู่ใกล้ Blacksmith, ระดับไม่เกิน cap ตาม Hunter Rank'],
      ['Class', 'Awaken', 'RF', 'Client → Server', 'เคลียร์ครบ 10 Gate, อยู่ที่แท่นบูชา, มี Diamonds พอ (ถ้าไม่ใช่ครั้งแรก)'],
      ['Class', 'SwitchClass', 'RF', 'Client → Server', 'ปลดล็อกคลาสนั้นแล้ว, มี 200 Gold, อยู่ที่แท่นบูชา'],
      ['Quest', 'Claim', 'RF', 'Client → Server', 'อยู่ที่ Quest Board, เควสครบเงื่อนไข, ยังไม่เคยรับ'],
      ['Quest', 'AcceptSecret', 'RF', 'Client → Server', 'คำใบ้ปรากฏบนบอร์ดแล้ว'],
      ['Recruit', 'Recruit', 'RF', 'Client → Server', 'อยู่ที่ Recruit Desk, มี 30 Diamonds'],
    ],
    after: '<div class="callout"><b>โฟลเดอร์ <code>Remotes/Base</code> ว่างเปล่า</b> — สถานะ Guild Base และความคืบหน้าการซ่อมไม่ได้ส่งผ่าน Remote แต่ใช้ <b>attribute</b> บนโมเดลฐานแทน เพราะเป็นข้อมูลที่ผู้เล่นทุกคนเห็นเหมือนกันและอัปเดตบ่อย</div>',
  },
  {
    id: 'signals',
    label: 'Signals ภายใน Server',
    note: 'Signal ทำให้ระบบคุยกันโดยไม่ต้อง <code>require</code> กันตรง ๆ จึงไม่เกิด dependency แบบวนกลับ',
    head: ['Signal', 'เจ้าของ', 'ยิงเมื่อไร', 'ใครฟังและทำอะไรต่อ'],
    rows: [
      ['GateSpawned', 'GateService', 'Gate ใหม่ถูกสร้าง', 'ระบบ UI ฝั่ง Client เห็นผ่าน attribute'],
      ['GateStabilityZero', 'GateService', 'Stability ถึง 0%', '<b>DungeonBreakService</b> เริ่มเหตุการณ์ป้องกันฐาน'],
      ['GateCleared', 'GateService', 'บอสตาย', 'Gate ถูกลบออกจากโลก'],
      ['PartyCreated / PartyRemoved', 'PartyService', 'ก่อน spawn / ก่อนทำลาย', '<b>HunterAIService</b> ผูกและถอด AI brain'],
      ['party.Wiped', 'Party (class)', 'Hunter ตายครบ 3', 'PartyService ตั้งเวลา respawn 5 วินาที · DungeonService หัก stability 10%'],
      ['PlayerCleared', 'DungeonService', 'ผู้เล่นเคลียร์ Gate สำเร็จ', '<b>ProgressionService</b> (EXP) · <b>InventoryService</b> (ดรอป) · <b>QuestService</b> (ความคืบหน้า)'],
      ['BreakEnded', 'DungeonBreakService', 'จบเหตุการณ์ (Won/Held/Lost)', 'QuestService นับเควสป้องกัน · GateService เริ่ม cooldown 300 วินาที'],
      ['ProfileLoaded', 'DataService', 'profile โหลดเสร็จ', 'PartyService spawn ปาร์ตี้ที่บันทึกไว้ · QuestService เช็กรีเฟรชบอร์ด'],
      ['DataChanged', 'DataService', 'ทุกครั้งที่ข้อมูลเปลี่ยน', 'replicate ไป Client ผ่าน <code>KeyChanged</code>'],
      ['LeveledUp / RankedUp', 'ProgressionService', 'Hunter ขึ้นเลเวล/แรงก์', 'แสดง toast และรีเฟรช stat ของ rig ที่มีชีวิตอยู่'],
    ],
  },
  {
    id: 'attributes',
    label: 'Attributes ที่ replicate',
    note: 'Roblox ส่ง attribute ให้ Client เอง จึงใช้แทน Remote สำหรับค่าที่เปลี่ยนบ่อยหรือที่ทุกคนเห็นเหมือนกัน',
    head: ['Attribute', 'อยู่บน', 'ค่า', 'ใครใช้'],
    rows: [
      ['Team', 'rig ทุกตัวที่สู้ได้', '"Hunter" หรือ "Monster"', 'ระบบ combat และ AI ใช้แยกฝ่าย'],
      ['OwnerUserId', 'rig ของ Hunter', 'UserId ของเจ้าของ', 'ใช้ระบุว่า EXP และ stat ของใคร'],
      ['HunterId / Role', 'rig ของ Hunter', 'key ใน HunterDefs / ชื่อ role', 'UI และ StatCalc'],
      ['IsControlled', 'rig ของ Hunter', 'true ถ้าผู้เล่นกำลังบังคับอยู่', 'AI หยุดคุมตัวนี้, HUD เน้นกรอบ'],
      ['AIMode', 'rig ของ Hunter', '1 ใน 5 โหมด', 'AIBrain อ่านทุก tick'],
      ['Level / HunterRank', 'rig ของ Hunter', 'ตัวเลข / E–S', 'แสดงบน HUD portrait'],
      ['ATK / DEF / MaxHealth', 'rig ทุกตัว', 'ค่าที่คำนวณเสร็จแล้ว', '<b>จุดเชื่อมสำคัญ</b> — Stage 5 จะอ่านค่าเหล่านี้แทนการคำนวณเอง'],
      ['HealingMultiplier / RegenMultiplier', 'rig ของ Hunter', 'ตัวคูณจาก Player Class', 'RegenService และ Stage 5 ในอนาคต'],
      ['IsStunned / IsAttacking / IsBlocking', 'rig ทุกตัว', 'bool', 'combat state'],
      ['Stability / SecondsLeft / GateState', 'โมเดล Gate', 'ตัวเลข / สถานะ', 'GateBillboard อัปเดตทุก 0.5 วินาที · <code>SecondsLeft = -1</code> แปลว่า “ค้างอยู่” (โดนแช่แข็งจาก rank cap หรือรออยู่ที่พื้น 5%)'],
      ['Rank / GateColor / Modifiers', 'โมเดล Gate', 'ข้อมูล Gate', 'billboard และ compass'],
      ['InDungeon', 'ตัวผู้เล่น', 'bool', 'กันเปลี่ยนปาร์ตี้และใส่เกียร์ตอนอยู่ใน Gate · ซ่อน compass'],
      ['DataLoaded', 'ตัวผู้เล่น', 'bool', 'บอกว่า profile พร้อมแล้ว'],
      ['StructureId', 'prompt ของโครงสร้างในฐาน', 'ชื่อโครงสร้าง', 'MenuController เอาไปเปิดแผงที่ถูกตัว'],
      ['DebugStabilitySpeed', 'ServerScriptService', 'ตัวเลข (Studio เท่านั้น)', 'เร่ง stability ตอนทดสอบ Dungeon Break'],
    ],
  },
];

/* ------------------------------------------------------------------ stages */
const stages = [
  {
    n: '0', name: 'Project Foundation', status: 'เสร็จ', cls: 'ok',
    summary: 'วางโครงให้ทุก stage ถัดไปมีที่เสียบ: ผังโฟลเดอร์ทั้งหมด, bootstrap ที่คุมลำดับเอง, <code>Signal</code>, <code>StateUtil</code> (state ที่ backed ด้วย attribute), ปิด <code>CharacterAutoLoads</code> แล้ว spawn rig R15 เอง และวาง world ทดสอบ',
    detail: ['ตัดสินใจเรื่องสำคัญที่ผูกทั้งโปรเจกต์: <b>rig R15 ทุกตัว</b> และ <b>Server เป็นคน spawn ตัวละคร</b> ผู้เล่นจึงไม่ได้ใช้ avatar ของตัวเอง แต่ควบคุม Hunter rig แทน'],
    files: 'Bootstrap · ClientBootstrap · Modules/Signal · Modules/StateUtil · GuiController',
  },
  {
    n: '1', name: 'Hunters & Solo Raid Party', status: 'เสร็จ', cls: 'ok',
    summary: 'ปาร์ตี้ Hunter 3 ตัว สลับตัวควบคุมแบบ real-time, AI 5 โหมด, HUD และ combat ชั่วคราว',
    detail: [
      '<b>กลไกการสลับตัวละครอธิบายเต็ม ๆ ที่หัวข้อ <a href="#swap">การสลับตัวละคร</a></b> — เป็นส่วนที่ยากและเจอบั๊กมากที่สุดของ stage นี้',
      'สรุปสั้น: Roblox <b>ทำลาย <code>Player.Character</code> ตัวเก่าทิ้ง</b> เมื่อ assign ตัวใหม่ แก้ด้วย <code>Hunter:_detachFromCharacter()</code> ที่ย้ายร่างไปไว้ใน Model ใหม่ก่อน',
      'การย้ายร่างทำให้ Humanoid ตกไปอยู่สถานะ <code>FallingDown</code> (ดูเหมือนตาย และตายจริงได้จาก neck check) แก้ด้วย <code>HumanoidUtil.Stabilize</code> และตั้ง <code>RequiresNeck = false</code> ทั้งสองฝั่ง',
      'กล้องไม่ตามตัวที่ถูก reassign จึงต้องมี <code>CameraController</code> แยก',
      'ยืนยันแล้ว: สลับ 11 ครั้งกลางการต่อสู้โดยไม่ล้มและไม่ตาย',
    ],
    files: 'Classes/Hunter · Classes/Party · Classes/AIBrain · PartyService · HunterAIService · PartyController',
  },
  {
    n: '2', name: 'Gate System', status: 'เสร็จ', cls: 'ok',
    summary: 'Gate เกิดตาม rank weight, stability ไหลลง, แผง Risk Assessment, modifier และเข็มทิศชี้ Gate',
    detail: [
      'บทเรียนเรื่อง streaming: ต้องตั้ง <code>ModelStreamingMode = Atomic</code> ให้ Gate ไม่งั้น Client อาจเห็นโมเดลที่ยังมาไม่ครบ ทำให้เอฟเฟกต์กะพริบไม่ทำงาน',
      'ProximityPrompt ที่วางไว้สูง 9.5 studs กดไม่ติด ต้องย้ายลงมาที่ระดับอก',
    ],
    files: 'Config/GateDefs · Config/ModifierDefs · Classes/Gate · GateService · GateBillboard · GatePanel · GateCompass',
  },
  {
    n: '3', name: 'Gate Exploration', status: 'รอตรวจเพิ่ม', cls: 'wait',
    summary: 'clone dungeon ไปไว้ slot ไกล ๆ, ห้อง, wave, บอสพร้อม telegraph, รางวัล และทางออก — เส้นทางหลักผ่านแล้ว',
    detail: [
      '<b>ผ่านแล้ว:</b> เข้า Gate → wave ห้อง 1 → ประตูเปิด → ห้อง 2 → บอส + Ground Slam → แผงผลลัพธ์ + Gold → ทางออกสีทอง',
      '<b>ยังค้าง:</b> Red Gate ที่ออกไม่ได้ · มอนสเตอร์ Berserk · ปาร์ตี้ wipe ข้างในแล้วโดนเด้ง (&minus;10% stability) · พฤติกรรมตอนมีหลายผู้เล่น ซึ่งต้องรอ Stage 7',
    ],
    files: 'Config/MonsterDefs · Config/DungeonDefs · Classes/Monster · Classes/DungeonInstance · DungeonService · ModifierRules',
  },
  {
    n: '4', name: 'Dungeon Break & Guild Base', status: 'เสร็จ', cls: 'ok',
    summary: 'เหตุการณ์ป้องกันฐานร่วม, ยาม NPC, ระบบซ่อม, ล็อกเอาต์ และผลลัพธ์ Won/Held/Lost',
    detail: [
      'ออกแบบใหม่จากเอกสารเดิม: จากเดิมที่เป็น “บทลงโทษ” กลายเป็น <b>เหตุการณ์ร่วมที่ผู้เล่นควบคุมได้</b> และ <b>ไม่มีการสูญเสียถาวร</b> — ไม่เสีย Gold ไอเทม หรือเลเวล',
      'บั๊กที่เจอและแก้: Gate ไม่เคยแตกเลยในสไลซ์แรก · การแข่งกันของหลาย Gate ที่แตกในเฟรมเดียวกัน (แก้ด้วยการเช็ก <code>CanBreak()</code> ต่อ Gate ไม่ใช่ต่อเฟรม)',
      'ยืนยันครบทั้งสามผลลัพธ์ในการเล่นจริง รวมถึง prompt ซ่อมที่ Core',
    ],
    files: 'Config/BreakDefs · Config/BaseDefs · GuildBaseService · DungeonBreakService · DungeonBreakController',
  },
  {
    n: '5', name: 'Combat Deep-Dive', status: 'มอบหมายแล้ว', cls: 'who',
    summary: 'นักพัฒนาอีกคนรับผิดชอบ จะเปลี่ยน <code>PlaceholderCombatService</code> เป็นระบบ combat จริง',
    detail: [
      'ระบบอื่นถูกออกแบบมาให้รองรับการเปลี่ยนนี้แล้ว: stat ทุกตัวส่งผ่าน <b>attribute บน rig</b> ไม่ได้ hardcode ในสูตรดาเมจ',
      'ต้นแบบที่จะพอร์ตมาอยู่ในเพลส <code>latestTest</code> — ข้อควรรู้จากการอ่านโค้ดนั้น: คอมโบ 4 ท่าเป็น R15 แต่ท่า Hit และ Block เป็น R6, ragdoll ทำงานกับ R6 เท่านั้น, StateManager ไม่ sync ไป Client และ Server เชื่อเลขคอมโบที่ Client ส่งมา (ต้องแก้)',
    ],
    files: 'PlaceholderCombatService (ชั่วคราว) → CombatService + DamageService',
  },
  {
    n: '6', name: 'Progression, Class & Saving', status: 'สร้างครบ รอ QA', cls: 'wait',
    summary: 'ห้าสไลซ์ย่อย 6A–6E สร้างครบแล้วถึง v0.3.3 — การบันทึก, เลเวล, ไอเทม, Player Class และเควส/recruit',
    detail: [
      '<b>6A</b> ProfileService store <code>PlayerData_v1</code> พร้อม session lock และ fallback เป็น mock store เมื่อปิด API access',
      '<b>6B</b> EXP, เลเวล, Hunter Rank, party editor (P) และพลังปาร์ตี้จริงที่ไปเปิด Gate rank สูงขึ้น',
      '<b>6C</b> ดรอป, กระเป๋า, โครงสร้างในฐาน 6 อย่าง, crafting, blacksmith, signature weapon, ยาและกับดัก',
      '<b>6D</b> awakening ที่แท่นบูชา 9 คลาส พร้อมระบบ modifier ที่ใส่ทั้งทีม',
      '<b>6E</b> quest board, เควสลับ 3 ขั้น และการ recruit Hunter',
    ],
    todo: [
      'ก่อน sign-off: ทดสอบขายของ, ใช้ยา, ถอดเกียร์, กับดักสร้างดาเมจ และโครงสร้างถูกล็อกตอนฐานเสียหาย',
      'ทดสอบรับเควสลับ, recruit Hunter แล้วใส่ปาร์ตี้ และการรีเฟรชบอร์ดข้ามรอบ',
      'ก่อนปล่อยจริง: ลบ <code>DebugService</code> ออก และพิจารณาขึ้น <code>PlayerData_v2</code> เพื่อล้างข้อมูลทดสอบ',
      'เมื่อผ่านครบ เป้าหมายเวอร์ชันคือ <b>v0.4.0</b>',
    ],
    files: 'DataService · ProgressionService · InventoryService · CraftingService · BlacksmithService · ClassService · QuestService · RecruitService · Modules/StatCalc',
  },
  {
    n: '7', name: 'Multiplayer Party', status: 'ยังไม่เริ่ม', cls: 'todo',
    summary: 'กติกา <code>3 + 3 + 3</code> — ผู้เล่นสูงสุด 3 คนต่อ Gate แต่ละคนพาปาร์ตี้ 3 Hunter ของตัวเองเข้ามา รวม 9 Hunter',
    detail: [
      'หลักการสำคัญ: การเข้า/ออกของผู้เล่นคนหนึ่งจะ <b>เพิ่มหรือลบเฉพาะปาร์ตี้ของคนนั้น</b> ไม่แตะปาร์ตี้ของคนอื่นเลย',
      'อนุญาตให้ Hunter แบบเดียวกันของคนละผู้เล่นอยู่ใน Gate เดียวกันได้ เพราะเป็นคนละตัวที่แต่ละคนเป็นเจ้าของ',
      'Stage นี้จะปลดล็อกการทดสอบที่ค้างมาจาก Stage 3 หลายข้อ',
    ],
    files: 'จะขยาย DungeonService, DungeonInstance และ PartyService',
  },
  {
    n: '8', name: 'Economy & Pawn', status: 'ยังไม่เริ่ม', cls: 'todo',
    summary: 'Gate Token, ร้านค้ากิลด์, ระบบเทรดปลอดภัย และสัญญาจำนำที่ปลอดภัยแม้ผู้เล่นออฟไลน์',
    detail: [
      'ระบบจำนำ: ไอเทมถูก lock ระหว่างสัญญา, ผู้จำนำมีเวลาไถ่ถอนตามกำหนด (เช่น 7 วัน), ถ้าไม่มาไถ่ไอเทมตกเป็นของผู้รับจำนำ',
      'ต้องออกแบบให้ทนต่อการที่ผู้เล่นออฟไลน์ตลอดช่วงสัญญา',
    ],
    files: 'จะเพิ่ม Classes/PawnContract และ service ฝั่งเศรษฐกิจ',
  },
];

/* ------------------------------------------------------------------ render */
function table(head, rows) {
  const th = head.map((h) => `<th>${h}</th>`).join('');
  const tr = rows
    .map((r) => `<tr>${r.map((c, i) => `<td${i > 0 && /^[\d,.–+×&]+$/.test(String(c)) ? ' class="num"' : ''}>${c}</td>`).join('')}</tr>`)
    .join('');
  return `<div class="table-responsive"><table class="table"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
}

function buildTabs(tabsEl, panelEl, data) {
  function show(item) {
    panelEl.innerHTML =
      `<p class="tab-note">${item.note}</p>` + table(item.head, item.rows) + (item.after || '');
    tabsEl.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.tab === item.id));
  }
  data.forEach((item) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.tab = item.id;
    b.textContent = item.label;
    b.addEventListener('click', () => show(item));
    tabsEl.append(b);
  });
  show(data[0]);
}

/* boot-flow nodes */
const nodeDetail = document.querySelector('#node-detail');
function showNode(key) {
  const node = nodes[key];
  const list = node.points ? `<ul>${node.points.map((p) => `<li>${p}</li>`).join('')}</ul>` : '';
  nodeDetail.innerHTML = `<h3>${node.title}</h3><p>${node.body}</p>${list}`;
  document.querySelectorAll('.flow-node').forEach((b) => b.classList.toggle('active', b.dataset.node === key));
}
document.querySelectorAll('.flow-node').forEach((b) => b.addEventListener('click', () => showNode(b.dataset.node)));

/* stage picker */
const picker = document.querySelector('#stage-picker');
const stageDetail = document.querySelector('#stage-detail');
function showStage(stage) {
  const detail = stage.detail ? `<ul>${stage.detail.map((d) => `<li>${d}</li>`).join('')}</ul>` : '';
  const todo = stage.todo
    ? `<h3>งานที่ยังค้าง</h3><ul>${stage.todo.map((t) => `<li>${t}</li>`).join('')}</ul>`
    : '';
  const files = stage.files ? `<p class="files">ไฟล์หลัก: <code>${stage.files}</code></p>` : '';
  stageDetail.innerHTML =
    `<h3>Stage ${stage.n}: ${stage.name} <span class="badge ${stage.cls}">${stage.status}</span></h3>` +
    `<p>${stage.summary}</p>${detail}${todo}${files}`;
  document.querySelectorAll('[data-stage]').forEach((b) => b.classList.toggle('active', b.dataset.stage === stage.n));
}
stages.forEach((stage) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.stage = stage.n;
  b.textContent = `${stage.n} · ${stage.name}`;
  b.addEventListener('click', () => showStage(stage));
  picker.append(b);
});

/* init */
showNode('bootstrap');
showStage(stages[6]);
buildTabs(document.querySelector('#config-tabs'), document.querySelector('#config-panel'), configTabs);
buildTabs(document.querySelector('#contract-tabs'), document.querySelector('#contract-panel'), contractTabs);
