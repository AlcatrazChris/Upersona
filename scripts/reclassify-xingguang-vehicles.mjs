import XLSX from 'xlsx';

const file = '.data/星光/星光L首批用户调研555.xlsx';

function classifyVehicle(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text || /^(nan|无|没有|暂无|首购|首次购车|1|2|油车|suv)$/.test(text)) return '无';

  const brands = [
    ['上汽通用五菱', /上汽五菱|五菱|五零|宝骏|暴君|宏光|缤果|凯捷|星光/],
    ['大众', /一汽大众|上汽大众|大众|高尔夫|帕萨特|帕沙特|迈腾|朗逸|宝来|桑塔纳|途观|途安|polo|plol/],
    ['丰田', /广汽丰田|一汽丰田|丰田|威驰|卡罗拉|凯美瑞|雷凌|汉兰达|rav4|荣放|致享|锐志|花冠|chr|塞纳|霸道/],
    ['本田', /广汽本田|东风本田|本田|xrv|雅阁|歌诗图|飞度|奥德赛|缤智|思迪|凌派|crv|锋范/],
    ['日产', /东风日产|郑州日产|日产|尼桑|逍客|骊威|天籁|蓝鸟|奇骏/],
    ['现代', /北京现代|现代|瑞纳|途胜|索纳塔|索八|伊兰特|悦动|胜达|ix35/],
    ['马自达', /一汽马自达|长安马自达|马自达|昂克赛拉/],
    ['铃木', /长安铃木|铃木|北斗星|奥拓|利亚纳/],
    ['吉利', /吉利|帝豪|领克|极氪|银河/],
    ['长安', /长安|深蓝|启源/],
    ['长城', /长城|哈弗|哈佛|wey|vv\d|欧拉|坦克/],
    ['奇瑞', /奇瑞|捷途|开瑞|凯翼/],
    ['上汽', /上汽大通|上汽荣威|荣威|名爵|大通/],
    ['广汽', /广汽传祺|广汽埃安|传祺|传奇|埃安/],
    ['一汽', /红旗|奔腾/],
    ['东风', /东风|启辰|猛士/],
    ['北汽', /北汽|绅宝|申宝|极狐/],
    ['江淮', /江淮/],
    ['比亚迪', /比亚迪|byd|腾势/],
    ['宝马', /宝马|bmw|mini/],
    ['奔驰', /奔驰|benz/],
    ['奥迪', /奥迪|audi/],
    ['保时捷', /保时捷/],
    ['路虎', /路虎/],
    ['雷克萨斯', /雷克萨斯|雷克沙斯/],
    ['凯迪拉克', /凯迪拉克/],
    ['沃尔沃', /沃尔沃/],
    ['林肯', /林肯/],
    ['特斯拉', /特斯拉/],
    ['别克', /别克|君威|gl8|昂科威|英朗|威朗|凯越|世纪/],
    ['雪佛兰', /雪佛兰|雪弗兰|科鲁兹|科沃兹|迈锐宝|景程/],
    ['福特', /福特|福克斯|福睿斯|蒙迪欧|翼搏|翼虎|嘉年华/],
    ['起亚', /起亚/],
    ['斯柯达', /斯柯达|斯科达|明锐|速派/],
    ['标致', /标致/],
    ['雪铁龙', /雪铁龙/],
    ['Jeep', /jeep|吉普/],
    ['克莱斯勒', /克莱斯勒|克拉斯勒/],
    ['菲亚特', /菲亚特/],
    ['纳智捷', /纳智捷/],
    ['蔚来', /蔚来/],
    ['小鹏', /小鹏/],
    ['理想', /理想/],
    ['零跑', /零跑/],
    ['众泰', /众泰/],
    ['海马', /海马/],
    ['力帆', /力帆/],
    ['东南', /东南|東南/],
    ['黄海', /黄海/],
    ['野马', /野马/],
    ['华颂', /华颂/],
  ];

  const matches = brands.flatMap(([brand, pattern]) => {
    const index = text.search(pattern);
    return index < 0 ? [] : [{ brand, index }];
  });
  if (matches.length) return matches.sort((a, b) => a.index - b.index)[0].brand;
  return '其他/无法识别';
}

const workbook = XLSX.readFile(file);
const sheetName = workbook.SheetNames[0];
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
  header: 1,
  defval: '',
});
const brandIndex = rows[0].indexOf('上一辆车');
const categoryIndex = rows[0].indexOf('上一辆车类别');
if (brandIndex < 0 || categoryIndex < 0) throw new Error('未找到上一辆车字段');

const counts = new Map();
for (let index = 1; index < rows.length; index += 1) {
  const category = classifyVehicle(rows[index][brandIndex]);
  rows[index][categoryIndex] = category;
  counts.set(category, (counts.get(category) ?? 0) + 1);
}

const output = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(output, XLSX.utils.aoa_to_sheet(rows), '清洗数据');
XLSX.writeFile(output, file, {
  bookType: 'xlsx',
  bookSST: true,
  compression: true,
});

console.log(JSON.stringify(Object.fromEntries(
  [...counts].sort((a, b) => b[1] - a[1])
), null, 2));
