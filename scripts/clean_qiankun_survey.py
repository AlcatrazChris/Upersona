"""
华境S 乾坤深度体验用户招募问卷清洗脚本
将原始问卷 Excel 清洗为系统标准导入格式

使用方法：
    python scripts/clean_qiankun_survey.py <input.xlsx> [output.xlsx]
"""

import sys
import re
import pandas as pd
from pathlib import Path

# ── 省份 → 大区映射 ─────────────────────────────────────────────
PROVINCE_AREA: dict[str, str] = {
    '北京': '华北', '天津': '华北', '河北': '华北', '山西': '华北', '内蒙古': '华北',
    '辽宁': '东北', '吉林': '东北', '黑龙江': '东北',
    '上海': '华东', '江苏': '华东', '浙江': '华东', '安徽': '华东',
    '福建': '华东', '江西': '华东', '山东': '华东',
    '河南': '中原',
    '湖北': '中南', '湖南': '中南',
    '广东': '华南', '广西': '华南', '海南': '华南',
    '重庆': '西南', '四川': '西南', '贵州': '西南', '云南': '西南', '西藏': '西南',
    '陕西': '西北', '甘肃': '西北', '青海': '西北', '宁夏': '西北', '新疆': '西北',
}

# 直辖市：省 = 市
MUNICIPALITIES = {'北京', '上海', '天津', '重庆'}

# 城市 → 省份 反查（处理仅写城市名的情况）
CITY_PROVINCE: dict[str, str] = {
    # 山东
    '青岛': '山东', '济南': '山东', '烟台': '山东', '泰安': '山东',
    '日照': '山东', '潍坊': '山东', '济宁': '山东', '东营': '山东',
    '诸城': '山东', '淄博': '山东', '威海': '山东', '滨州': '山东',
    # 江苏
    '南京': '江苏', '苏州': '江苏', '无锡': '江苏', '南通': '江苏',
    '徐州': '江苏', '泰州': '江苏', '镇江': '江苏', '常州': '江苏',
    '扬州': '江苏', '盐城': '江苏', '连云港': '江苏', '宿迁': '江苏', '淮安': '江苏',
    # 浙江
    '杭州': '浙江', '宁波': '浙江', '温州': '浙江', '绍兴': '浙江',
    '金华': '浙江', '嘉兴': '浙江', '台州': '浙江', '舟山': '浙江',
    # 四川
    '成都': '四川', '达州': '四川', '内江': '四川', '南充': '四川',
    '攀枝花': '四川', '西昌': '四川', '绵阳': '四川', '德阳': '四川',
    '宜宾': '四川', '泸州': '四川', '自贡': '四川',
    # 广东
    '深圳': '广东', '广州': '广东', '东莞': '广东', '佛山': '广东',
    '珠海': '广东', '中山': '广东', '惠州': '广东', '湛江': '广东',
    '茂名': '广东', '肇庆': '广东', '汕头': '广东', '韶关': '广东',
    # 广西
    '南宁': '广西', '柳州': '广西', '桂林': '广西', '北海': '广西',
    '贵港': '广西', '河池': '广西', '玉林': '广西', '平果': '广西',
    # 湖北
    '武汉': '湖北', '咸宁': '湖北', '宜昌': '湖北', '十堰': '湖北',
    '荆州': '湖北', '黄石': '湖北', '孝感': '湖北', '黄冈': '湖北',
    # 湖南
    '长沙': '湖南', '株洲': '湖南', '湘潭': '湖南', '衡阳': '湖南',
    '永州': '湖南', '常德': '湖南', '邵阳': '湖南', '岳阳': '湖南',
    # 陕西
    '西安': '陕西', '宝鸡': '陕西', '咸阳': '陕西', '汉中': '陕西',
    '榆林': '陕西', '渭南': '陕西', '延安': '陕西',
    # 河北
    '石家庄': '河北', '保定': '河北', '唐山': '河北', '廊坊': '河北',
    '承德': '河北', '张家口': '河北', '衡水': '河北', '沧州': '河北',
    '邢台': '河北', '邯郸': '河北', '秦皇岛': '河北',
    # 山西
    '太原': '山西', '大同': '山西', '运城': '山西', '晋中': '山西',
    '临汾': '山西', '长治': '山西', '晋城': '山西', '朔州': '山西',
    # 云南
    '昆明': '云南', '玉溪': '云南', '曲靖': '云南', '大理': '云南',
    '丽江': '云南', '普洱': '云南',
    # 福建
    '福州': '福建', '厦门': '福建', '泉州': '福建', '漳州': '福建',
    '莆田': '福建', '龙岩': '福建', '三明': '福建', '南平': '福建',
    # 江西
    '南昌': '江西', '赣州': '江西', '九江': '江西', '宜春': '江西',
    '上饶': '江西', '吉安': '江西', '景德镇': '江西',
    # 贵州
    '贵阳': '贵州', '遵义': '贵州', '兴义': '贵州', '毕节': '贵州',
    # 安徽
    '合肥': '安徽', '芜湖': '安徽', '蚌埠': '安徽', '马鞍山': '安徽',
    # 河南
    '郑州': '河南', '洛阳': '河南', '开封': '河南', '南阳': '河南',
    # 辽宁
    '沈阳': '辽宁', '大连': '辽宁', '鞍山': '辽宁',
}


def parse_residence(raw: str) -> tuple[str, str, str]:
    """
    将现居住地自由文本解析为 (大区, 省份, 城市)
    """
    if not raw or str(raw).strip() in ('', 'nan', '(跳过)'):
        return '', '', ''

    raw = str(raw).strip()

    # 多地址取第一个
    for sep in [' and ', ' AND ', '，', ',', '和', ' & ', '；', ';', '或']:
        if sep in raw:
            raw = raw.split(sep)[0].strip()

    # 统一分隔符
    raw = raw.replace('+', '').replace('－', '').replace('-', ' ')\
             .replace('/', '').replace('／', '').replace('，', '')\
             .replace('~', '').replace('～', '')
    raw = re.sub(r'\s+', '', raw)

    # 去除末尾街道/区/开发区等（保留省市）
    raw = re.sub(r'(区|县|镇|乡|街道|经济开发区|高新区|新区|工业园|产业园|.+大道.+|.+路.+号.+)$', '', raw)

    province = ''
    city = ''

    # 尝试从头识别省份（按名称长度降序匹配，避免"广西"被"广东"错匹配）
    sorted_provinces = sorted(PROVINCE_AREA.keys(), key=len, reverse=True)
    for p in sorted_provinces:
        # 匹配省份名及常见后缀
        pattern = p + r'(省|市|壮族自治区|回族自治区|维吾尔自治区|自治区)?'
        m = re.match(pattern, raw)
        if m:
            province = p
            remainder = raw[m.end():]
            break
        # 省份在字符串中间（如"四川省成都市"）
        if p in raw:
            idx = raw.index(p)
            province = p
            remainder = raw[idx + len(p):]
            # 去掉省份后缀
            remainder = re.sub(r'^(省|市|自治区|壮族自治区)', '', remainder)
            break
    else:
        remainder = raw

    # 提取城市
    if province in MUNICIPALITIES:
        city = province
    else:
        # 从 remainder 提取第一个城市级别单位
        city_match = re.match(r'([^\s市区县]+)(市|区)?', remainder)
        if city_match:
            raw_city = city_match.group(1)
            # 最多取 4 字
            city = raw_city[:4]
        elif remainder:
            city = re.sub(r'[市区县]$', '', remainder[:4]).strip()

    # 如果没有识别到省份，尝试通过城市反查
    if not province and city:
        for known_city, known_prov in CITY_PROVINCE.items():
            if city.startswith(known_city) or known_city.startswith(city):
                province = known_prov
                city = known_city
                break

    # 如果还是没有省份，整个 raw 当城市反查
    if not province:
        clean_raw = re.sub(r'[市区县省]$', '', raw)
        province = CITY_PROVINCE.get(clean_raw, '')
        city = clean_raw if province else raw[:4]

    # 直辖市统一处理
    if province in MUNICIPALITIES:
        city = province

    area = PROVINCE_AREA.get(province, '其他' if province else '')
    return area, province, city


# ── 字段映射规则 ────────────────────────────────────────────────

INCOME_MAP = {
    '10万以下':  '15万以下',
    '10-15万':   '15万以下',
    '15-25万':   '20-24万',
    '25-35万':   '30-39万',
    '35万以上':  '40-49万',
}

FAMILY_MAP = {
    '未婚':     '单身',
    '已婚未育': '两口之家',
    '已婚1孩':  '三口之家',
    '2孩以上':  '四口之家',
}


def age_to_group(raw) -> str:
    """将原始年龄数字映射到标准年龄段"""
    try:
        n = int(re.sub(r'[^\d]', '', str(raw)))
    except (ValueError, TypeError):
        return ''
    if n < 1 or n > 120:
        return ''
    if n < 30:  return '30岁以下'
    if n < 35:  return '30-34岁'
    if n < 40:  return '35-39岁'
    if n < 45:  return '40-44岁'
    if n < 50:  return '45-49岁'
    return '50岁以上'


def clean_competing_models(raw) -> str:
    """将现有车型字段转换为多选格式（逗号分隔）"""
    if not raw or str(raw).strip() in ('', 'nan'):
        return ''
    text = str(raw).strip()
    # 按常见分隔符切分
    parts = re.split(r'[,，、\n]+', text)
    cleaned = [p.strip() for p in parts if p.strip()]
    return ','.join(cleaned)


def clean_survey(input_path: str, output_path: str) -> None:
    df = pd.read_excel(input_path)

    rows = []
    for _, r in df.iterrows():
        # ── 地区解析 ──
        area, province, city = parse_residence(str(r.get('现居住地', '')))

        # ── 年龄段 ──
        age_group = age_to_group(r.get('年龄:', ''))

        # ── 家庭结构 ──
        fam_raw = str(r.get('您的家庭情况:', '')).strip()
        family_structure = FAMILY_MAP.get(fam_raw, fam_raw)

        # ── 家庭年收入 ──
        inc_raw = str(r.get('家庭年收入范围:', '')).strip()
        annual_income = INCOME_MAP.get(inc_raw, inc_raw)

        # ── 职业 ──
        occ_raw = str(r.get('您目前从事的职业：', '')).strip()
        if occ_raw in ('/', 'nan', ''):
            occ_raw = ''

        # ── 对比车型（现有车型视为参考竞品） ──
        competing = clean_competing_models(r.get('您的现有车型（家里有的所有车型都尽量写上）:', ''))

        # ── 是否乾坤注册车主 ──
        qiankun_raw = str(r.get('您是否在华为乾崑APP绑定了车辆？', '')).strip()
        is_qiankun = qiankun_raw if qiankun_raw in ('是', '否') else ''

        rows.append({
            '姓名':              str(r.get('您的姓名:', '')).strip(),
            '大区':              area,
            '省份':              province,
            '城市':              city,
            '年龄段':            age_group,
            '学历':              '',
            '职业':              occ_raw,
            '家庭结构':          family_structure,
            '家庭年收入':        annual_income,
            '是否增换购':        '',
            '消费观念':          '',
            '对比车型':          competing,
            '用车场景':          '',
            '与老人小孩全家出行频率': '',
            '了解华境S的渠道':   '',
            '关注的汽车内容':    '',
            '日常爱好':          '',
            '金融期数':          0,
            '订单状态':          '未锁单',
            '是否乾坤注册车主':  is_qiankun,
        })

    out = pd.DataFrame(rows)
    out.to_excel(output_path, index=False)

    # ── 统计报告 ──
    total = len(out)
    qiankun_yes = (out['是否乾坤注册车主'] == '是').sum()
    area_dist = out['大区'].value_counts()
    missing_city = (out['城市'] == '').sum()

    import sys as _sys
    _sys.stdout.reconfigure(encoding='utf-8') if hasattr(_sys.stdout, 'reconfigure') else None
    print(f"[OK] 清洗完成：{total} 条记录 -> {output_path}")
    print(f"   乾坤注册车主：{qiankun_yes} 人 ({qiankun_yes/total*100:.1f}%)")
    print(f"   城市解析缺失：{missing_city} 条")
    print("   大区分布：")
    for _area, cnt in area_dist.items():
        print(f"     {(_area or '未知'):6s}  {cnt:3d} 条")


if __name__ == '__main__':
    default_input = (
        r'C:\Users\19660\xwechat_files\wxid_odesh66hlq9k22_ea35'
        r'\msg\file\2026-06\366918074_按文本_华境S深度体验用户招募_258_258.xlsx'
    )
    inp = sys.argv[1] if len(sys.argv) > 1 else default_input
    out = sys.argv[2] if len(sys.argv) > 2 else str(
        Path(__file__).parent.parent / 'data' / 'qiankun_survey_cleaned.xlsx'
    )
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    clean_survey(inp, out)
