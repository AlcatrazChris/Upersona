export const VEHICLE_TYPES = [
  '进口车', '合资新能源', '合资燃油车', '国产新能源', '国产燃油车',
  '五菱宝骏', '新势力', '无旧车', '无法识别',
] as const;

const NO_ANSWER = /^(?:\(跳过\)|（跳过）|跳过|)$/i;
const NO_CAR = /^(?:无|没有|暂无|首购|首次购车)$/i;
const UNKNOWN = /^(?:nan|1|2|油车|suv|货卡)$/i;

const BRAND_RULES: [string, RegExp][] = [
  ['五菱', /上汽五菱|五菱|五零|五菱宏光|宏光|五菱之光|五菱荣光|五菱星光|五菱缤果|缤果|宾果|五菱迷你|五菱mini|mineev|mi'ni|2023星光|星光s|凯捷|^星光$|^迷你$/i],
  ['宝骏', /新宝骏|宝骏|宝俊|暴君/i],
  ['大众', /一汽大众|上汽大众|大众|高尔夫|帕萨特|帕沙特|迈腾|朗逸|朗行|宝来|桑塔纳|途观|途安|途昂|途锐|速腾|id3|polo|plol|捷达/i],
  ['丰田', /广汽丰田|一汽丰田|丰田|威驰|卡罗拉|凯美瑞|佳美|雷凌|汉兰达|rav4|荣放|致享|锐志|花冠|皇冠|埃尔法|chr|塞纳|威兰达|霸道/i],
  ['本田', /广汽本田|东风本田|本田|xrv|雅阁|歌诗图|飞度|奥德赛|艾力绅|缤智|思迪|凌派|crv|锋范|峰范/i],
  ['日产', /东风日产|郑州日产|日产|尼桑|逍客|骊威|丽威|天籁|蓝鸟|奇骏|轩逸|阳光|途达|途乐|西玛|风度mx6/i],
  ['现代', /北京现代|现代|瑞纳|途胜|索纳塔|索八|伊兰特|悦动|胜达|朗动|领动|ix35/i],
  ['起亚', /起亚|福瑞迪|奕跑|傲跑|智跑/i],
  ['马自达', /一汽马自达|长安马自达|马自达|昂克赛拉|cx-?[45]/i],
  ['铃木', /长安铃木|铃木|北斗星|奥拓|利亚纳/i],
  ['斯柯达', /斯柯达|斯科达|明锐|明睿|速派|柯洛克/i],
  ['别克', /别克|君威|君越|gl8|昂科威|昂科拉|昂科雷|英朗|威朗|凯越|世纪/i],
  ['雪佛兰', /雪佛兰|雪弗兰|雪佛来|科鲁兹|克鲁兹|科沃兹|迈锐宝|景程|赛欧|科帕奇/i],
  ['福特', /福特|福克斯|福睿斯|蒙迪欧|探险者|翼搏|翼虎|嘉年华|致胜/i],
  ['标致', /标致|标志/i], ['雪铁龙', /雪铁龙|世嘉/i], ['DS', /谛艾仕|\bds\s?[56]?\b/i],
  ['Jeep', /jeep|吉普|自由侠|自由光|指南者|大指挥官/i],
  ['克莱斯勒', /克莱斯勒|克拉斯勒|漫步者/i], ['菲亚特', /菲亚特|菲翔/i],
  ['三菱', /三菱|欧蓝德/i], ['雷诺', /雷诺/i],
  ['吉利', /吉利|帝豪|英伦|全球鹰|星瑞|星舰|银河|博越|搏越|远景|几何|华普/i],
  ['领克', /领克/i], ['极氪', /极氪/i],
  ['长安', /长安|欧尚|启源|起源|奔奔|逸动|逸达|悦翔|睿骋|unit|uni-?t|uniz|uni-?z|cs\d|x70a/i],
  ['深蓝', /深蓝/i], ['长城', /长城|哈弗|哈佛|wey|魏派|vv\d|欧拉|欧啦|坦克|500hi4t|长城炮|腾翼/i],
  ['奇瑞', /奇瑞|捷途|开瑞|凯翼|瑞虎|艾瑞泽|艾8|星途|风云|icar|\bv23\b|冰淇淋/i],
  ['荣威', /上汽荣威|荣威/i], ['名爵', /名爵|锐腾/i], ['大通', /上汽大通|大通|大拿大通/i],
  ['传祺', /广汽传祺|广祺|传祺|传奇|\bgs[348]\b/i], ['埃安', /广汽埃安|埃安/i],
  ['广汽', /^广汽$|广汽吉奥|吉奥/i],
  ['红旗', /红旗/i], ['奔腾', /奔腾|小马/i],
  ['东风', /东风|车风风光|风光580|风神|风行|菱智/i], ['启辰', /启辰/i], ['猛士', /猛士/i],
  ['北汽', /北汽|北京汽车|北京x7|北京bj\d+|绅宝|申宝|威旺|威望|幻速|昌河/i], ['极狐', /极狐/i],
  ['江淮', /江淮|^瑞风/i], ['比亚迪', /比亚迪|byd|腾势|秦plus|秦pLus/i],
  ['比亚迪', /唐dm|宋plus|驱逐舰|海鸥|方程豹/i],
  ['蔚来', /蔚来|乐道/i], ['小鹏', /小鹏/i], ['理想', /理想/i], ['零跑', /零跑|领跑|0跑/i],
  ['问界', /问界|atio问界/i], ['哪吒', /哪吒|合众汽车|合众哪吒/i], ['岚图', /岚图/i],
  ['智己', /智己/i], ['智界', /智界|鸿蒙智行/i], ['蓝电', /蓝电|赛力斯/i], ['小米', /小米|xiaomi/i], ['云度', /云度/i],
  ['特斯拉', /特斯拉/i], ['极星', /极星/i],
  ['宝马', /宝马|bmw/i], ['MINI', /宝马mini|^mini$/i], ['奔驰', /奔驰|benz|\bglc\b/i], ['奥迪', /奥迪|audi|\bq3\b/i],
  ['保时捷', /保时捷|macan/i], ['路虎', /路虎|陆虎|发现运动|神行/i], ['雷克萨斯', /雷克萨斯|雷克沙斯/i],
  ['凯迪拉克', /凯迪拉克|凯雷德/i], ['沃尔沃', /沃尔沃/i], ['林肯', /林肯/i],
  ['斯巴鲁', /斯巴鲁|森林人|傲虎/i], ['英菲尼迪', /英菲尼迪|英菲利迪/i], ['讴歌', /讴歌/i],
  ['玛莎拉蒂', /玛莎拉蒂/i], ['双龙', /双龙/i], ['道奇', /道奇/i], ['欧宝', /欧宝/i], ['smart', /smart/i],
  ['众泰', /众泰|大迈/i], ['海马', /海马|福美来|海福星/i], ['力帆', /力帆/i],
  ['东南', /东南|東南|dx3|富利卡/i], ['黄海', /黄海/i], ['野马', /野马/i], ['华颂', /华颂/i],
  ['江铃', /江铃|驭胜|陆风|陸風/i], ['猎豹', /猎豹/i], ['宝沃', /宝沃/i], ['汉腾', /汉腾/i], ['斯威', /斯威/i],
  ['华泰', /华泰/i], ['一汽', /一汽骏派|一汽威志|一汽森雅|骏派|森雅/i], ['金杯', /金杯/i], ['福迪', /福迪/i],
  ['纳智捷', /纳智捷/i], ['夏利', /夏利/i], ['中华', /华晨[_-]?中华|中华|骏捷/i],
];

const NEW_FORCES = new Set(['蔚来', '小鹏', '理想', '零跑', '特斯拉', '极星', '极氪', '问界', '哪吒', '岚图', '智己', '智界', '蓝电', '小米', '云度']);
const IMPORTED = new Set(['保时捷', '路虎', '雷克萨斯', 'MINI', '林肯', '斯巴鲁', '英菲尼迪', '讴歌', '玛莎拉蒂', '双龙', '道奇', '欧宝', 'smart']);
const JOINT = new Set([
  '大众', '丰田', '本田', '日产', '现代', '起亚', '马自达', '铃木', '斯柯达',
  '别克', '雪佛兰', '福特', '标致', '雪铁龙', 'Jeep', '克莱斯勒', '菲亚特',
  '三菱', '雷诺', '宝马', '奔驰', '奥迪', '凯迪拉克', '沃尔沃', 'DS',
]);

const EV_HINT = /新能源|纯电|电车|ev\b|dmi|dm-?i|双擎|id\.?[34]|model\s?3|e[126]\b|元plus|秦plus|汉\b|唐\b|宋\b|驱逐舰|海鸥|方程豹|护卫舰|冰淇淋|几何|埃安|深蓝|启源|起源|银河|极氪|icar|v23|hi4t|eu5|iev|ei6|猛士917|奔腾小马/i;
const BYD_FUEL = /f3|l3|s7|速锐|思锐/i;

function typeFor(text: string, brand: string): string {
  if (brand === '五菱' || brand === '宝骏') return '五菱宝骏';
  if (NEW_FORCES.has(brand)) return '新势力';
  if (IMPORTED.has(brand) || /奔驰gls|奥迪q7|宝马轿跑/.test(text)) return '进口车';
  if (JOINT.has(brand)) return EV_HINT.test(text) ? '合资新能源' : '合资燃油车';
  if (brand === '比亚迪') return BYD_FUEL.test(text) ? '国产燃油车' : '国产新能源';
  return EV_HINT.test(text) ? '国产新能源' : '国产燃油车';
}

export function classifyPreviousVehicle(value: unknown): { brand: string; type: string } {
  const text = String(value ?? '').trim().toLowerCase();
  if (NO_ANSWER.test(text)) return { brand: '', type: '' };
  if (NO_CAR.test(text)) return { brand: '无旧车', type: '无旧车' };
  if (UNKNOWN.test(text)) return { brand: '品牌无法识别', type: '无法识别' };

  const findBrands = (part: string) => {
    const matches = BRAND_RULES.flatMap(([brand, pattern]) => {
      const index = part.search(pattern);
      return index < 0 ? [] : [{ brand, index }];
    }).sort((a, b) => a.index - b.index);
    let found = [...new Set(matches.map(match => match.brand))];
    if (found.includes('宝骏')) found = found.filter(brand => brand !== '五菱');
    if (found.includes('MINI')) found = found.filter(brand => brand !== '宝马');
    if (/东风日产|东风本田|东风雪铁龙/.test(part)) found = found.filter(brand => brand !== '东风');
    if (/郑州日产东风风度|东风风度/.test(part)) found = found.filter(brand => brand !== '日产');
    if (/东风启辰/.test(part)) found = found.filter(brand => brand !== '东风');
    if (/长安铃木|长安马自达/.test(part)) found = found.filter(brand => brand !== '长安');
    if (/大众.*明[锐睿]/.test(part)) found = found.filter(brand => brand !== '大众');
    if (/丰田锋范/.test(part)) found = found.filter(brand => brand !== '丰田');
    return found;
  };
  const parts = text.split(/[，,、；;]/).map(part => part.trim()).filter(Boolean);
  const classified = parts.map(part => ({ part, brands: findBrands(part) }));
  const brands = [...new Set(classified.flatMap(item => item.brands))];
  if (!brands.length) return { brand: '品牌无法识别', type: '无法识别' };
  return {
    brand: brands.join('┋'),
    type: [...new Set(classified.flatMap(item => item.brands.map(brand => typeFor(item.part, brand))))].join('┋'),
  };
}
