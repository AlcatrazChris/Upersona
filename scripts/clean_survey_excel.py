"""Clean the raw Huajing S survey into the established analysis schema."""

from __future__ import annotations

import re
from collections import Counter, defaultdict
from copy import copy
from datetime import datetime
from pathlib import Path
from typing import Any

from openpyxl import Workbook, load_workbook


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "366639047_3644_3644.xlsx"
REFERENCE = ROOT / "华境S首批用户调研0617.xlsx"
OUTPUT = ROOT / "366639047_3644_3644_清洗后_带时间.xlsx"

DELIMITER = "┋"
SKIP_VALUES = {"(跳过)", "（跳过）", "跳过"}

# (raw source column, cleaned reference column), zero based.
DIRECT_COLUMNS = (
    [(6, 1)]
    + [(source_col, source_col - 2) for source_col in range(9, 33)]
    + [(source_col, source_col - 1) for source_col in range(33, 51)]
)

OTHER_RE = re.compile(r"其他(?:原因)?\s*[〖【][^〗】]*[〗】]")
EXPLANATION_RE = re.compile(r"\s*[（(][^（）()]*[）)]\s*")


def text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def parse_time(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    raw = text(value)
    if not raw:
        return None
    for fmt in (
        "%Y/%m/%d %H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y/%m/%d %H:%M",
        "%Y-%m-%d %H:%M",
        "%Y/%m/%d",
        "%Y-%m-%d",
    ):
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    return None


def build_clean_maps(
    source_rows: list[tuple[Any, ...]],
    reference_rows: list[tuple[Any, ...]],
) -> tuple[dict[int, dict[str, str]], dict[int, dict[str, str]]]:
    """Learn the exact cleaning vocabulary from the aligned reference rows."""
    whole_counts: dict[int, dict[str, Counter[str]]] = defaultdict(
        lambda: defaultdict(Counter)
    )
    token_counts: dict[int, dict[str, Counter[str]]] = defaultdict(
        lambda: defaultdict(Counter)
    )

    aligned_count = min(len(source_rows), len(reference_rows))
    for source_col, target_col in DIRECT_COLUMNS:
        for index in range(aligned_count):
            raw = text(source_rows[index][source_col])
            clean = text(reference_rows[index][target_col])
            whole_counts[source_col][raw][clean] += 1

            raw_parts = raw.split(DELIMITER)
            clean_parts = clean.split(DELIMITER)
            if len(raw_parts) == len(clean_parts):
                for raw_part, clean_part in zip(raw_parts, clean_parts):
                    token_counts[source_col][raw_part.strip()][clean_part.strip()] += 1

    whole_maps = {
        column: {raw: counts.most_common(1)[0][0] for raw, counts in mappings.items()}
        for column, mappings in whole_counts.items()
    }
    token_maps = {
        column: {raw: counts.most_common(1)[0][0] for raw, counts in mappings.items()}
        for column, mappings in token_counts.items()
    }
    return whole_maps, token_maps


def fallback_clean_token(value: str) -> str:
    value = value.strip()
    if not value or value in SKIP_VALUES:
        return ""
    value = OTHER_RE.sub("其他", value)
    # Explanatory parentheses in questionnaire options are descriptions,
    # not part of the category name.
    value = EXPLANATION_RE.sub("", value).strip()
    # Work/life-state options use "category: long description".
    if ":" in value or "：" in value:
        value = re.split(r"[:：]", value, maxsplit=1)[0].strip()
    return value


def clean_cell(
    value: Any,
    source_col: int,
    whole_maps: dict[int, dict[str, str]],
    token_maps: dict[int, dict[str, str]],
) -> str:
    raw = text(value)
    if not raw or raw in SKIP_VALUES:
        return ""
    if raw in whole_maps.get(source_col, {}):
        return whole_maps[source_col][raw]

    cleaned: list[str] = []
    for part in raw.split(DELIMITER):
        part = part.strip()
        result = token_maps.get(source_col, {}).get(part)
        if result is None:
            result = fallback_clean_token(part)
        if result and result not in cleaned:
            cleaned.append(result)
    return DELIMITER.join(cleaned)


def build_geo_maps(
    source_rows: list[tuple[Any, ...]],
    reference_rows: list[tuple[Any, ...]],
) -> tuple[dict[str, tuple[str, ...]], dict[str, tuple[str, ...]], dict[str, str]]:
    exact: dict[str, tuple[str, ...]] = {}
    city: dict[str, tuple[str, ...]] = {}
    province_region: dict[str, str] = {}

    for source_row, reference_row in zip(source_rows, reference_rows):
        raw = text(source_row[8])
        geo = tuple(text(value) for value in reference_row[2:7])
        if not raw:
            continue
        exact[raw] = geo
        parts = [part.strip() for part in raw.split("-")]
        if len(parts) >= 2:
            city[parts[1]] = geo
        if geo[1] and geo[0]:
            province_region[geo[1]] = geo[0]
    return exact, city, province_region


def resolve_geo(
    value: Any,
    exact_map: dict[str, tuple[str, ...]],
    city_map: dict[str, tuple[str, ...]],
    province_region: dict[str, str],
) -> tuple[str, str, str, str, str]:
    raw = text(value)
    if raw in exact_map:
        return exact_map[raw]  # type: ignore[return-value]

    parts = [part.strip() for part in raw.split("-")]
    province = parts[0] if parts else ""
    city = parts[1] if len(parts) > 1 else ""
    district = "-".join(parts[2:]) if len(parts) > 2 else ""
    known = city_map.get(city)
    if known:
        return known[0], province or known[1], city or known[2], district, known[4]
    return province_region.get(province, ""), province, city, district, ""


def build_car_map(
    source_rows: list[tuple[Any, ...]],
    reference_rows: list[tuple[Any, ...]],
) -> dict[str, str]:
    counts: dict[str, Counter[str]] = defaultdict(Counter)
    for source_row, reference_row in zip(source_rows, reference_rows):
        raw = text(source_row[32]).lower()
        category = text(reference_row[31])
        counts[raw][category] += 1
    return {raw: values.most_common(1)[0][0] for raw, values in counts.items()}


def classify_car(value: Any, known_map: dict[str, str]) -> str:
    raw = text(value)
    if not raw or raw in SKIP_VALUES:
        return ""
    lowered = raw.lower()
    if lowered in known_map:
        return known_map[lowered]

    if any(keyword in lowered for keyword in ("五菱", "宝骏")):
        return "五菱宝骏基盘"
    if any(keyword in lowered for keyword in (
        "问界", "理想", "蔚来", "小鹏", "零跑", "哪吒", "极氪", "阿维塔", "岚图",
    )):
        return "新势力"
    if any(keyword in lowered for keyword in (
        "比亚迪", "埃安", "深蓝", "银河", "欧拉", "启源", "腾势",
    )):
        return "国产新能源"
    if any(keyword in lowered for keyword in (
        "奔驰", "宝马", "奥迪", "保时捷", "路虎", "捷豹", "雷克萨斯",
        "凯迪拉克", "沃尔沃", "林肯", "英菲尼迪", "讴歌", "特斯拉",
    )):
        return "合资豪华"
    if any(keyword in lowered for keyword in (
        "吉利", "长安", "奇瑞", "传祺", "红旗", "哈弗", "领克", "名爵",
        "荣威", "江淮", "东风", "奔腾", "北京汽车", "北汽", "广汽",
    )):
        return "国产燃油"
    return "合资主流"


def copy_header_style(reference_sheet: Any, output_sheet: Any, offset: int = 1) -> None:
    for source_cell in reference_sheet[1]:
        target_cell = output_sheet.cell(1, source_cell.column + offset)
        if source_cell.has_style:
            target_cell._style = copy(source_cell._style)
        target_cell.font = copy(source_cell.font)
        target_cell.fill = copy(source_cell.fill)
        target_cell.border = copy(source_cell.border)
        target_cell.alignment = copy(source_cell.alignment)
        target_cell.number_format = source_cell.number_format
        target_cell.protection = copy(source_cell.protection)


def main() -> None:
    source_book = load_workbook(SOURCE, read_only=True, data_only=True)
    reference_book = load_workbook(REFERENCE, data_only=True)
    source_sheet = source_book.active
    reference_sheet = reference_book.active

    source_rows = list(source_sheet.iter_rows(min_row=2, values_only=True))
    reference_rows = list(reference_sheet.iter_rows(min_row=2, values_only=True))

    whole_maps, token_maps = build_clean_maps(source_rows, reference_rows)
    exact_geo, city_geo, province_region = build_geo_maps(source_rows, reference_rows)
    car_map = build_car_map(source_rows, reference_rows)

    output_book = Workbook()
    output_sheet = output_book.active
    output_sheet.title = "清洗数据"

    reference_headers = [cell.value for cell in reference_sheet[1]]
    output_sheet.append(["提交答卷时间", *reference_headers])
    copy_header_style(reference_sheet, output_sheet)
    # Match the target header style for the added time field.
    first_reference_header = reference_sheet.cell(1, 1)
    output_sheet.cell(1, 1)._style = copy(first_reference_header._style)
    output_sheet.cell(1, 1).font = copy(first_reference_header.font)
    output_sheet.cell(1, 1).fill = copy(first_reference_header.fill)
    output_sheet.cell(1, 1).border = copy(first_reference_header.border)
    output_sheet.cell(1, 1).alignment = copy(first_reference_header.alignment)

    output_count = 0
    removed_blank_rows = 0
    removed_skip_cells = 0
    other_normalized = 0

    for source_row in source_rows:
        removed_skip_cells += sum(text(value) in SKIP_VALUES for value in source_row)
        other_normalized += sum(
            bool(OTHER_RE.search(text(value))) for value in source_row if value is not None
        )

        cleaned_direct: dict[int, str] = {}
        for source_col, _ in DIRECT_COLUMNS:
            cleaned_direct[source_col] = clean_cell(
                source_row[source_col], source_col, whole_maps, token_maps
            )

        # A row is blank only when all actual survey answers are empty after cleaning.
        if not any(cleaned_direct.values()):
            removed_blank_rows += 1
            continue

        geo = resolve_geo(source_row[8], exact_geo, city_geo, province_region)
        row = [
            parse_time(source_row[1]),
            "已提车",
            cleaned_direct[6],
            *geo,
            *[cleaned_direct[column] for column in range(9, 33)],
            classify_car(source_row[32], car_map),
            *[cleaned_direct[column] for column in range(33, 51)],
        ]
        output_sheet.append(row)
        output_count += 1
        output_sheet.cell(output_sheet.max_row, 1).number_format = "yyyy-mm-dd hh:mm:ss"

    output_sheet.freeze_panes = "A2"
    output_sheet.auto_filter.ref = output_sheet.dimensions
    output_sheet.column_dimensions["A"].width = 21
    for column_index in range(1, reference_sheet.max_column + 1):
        source_letter = reference_sheet.cell(1, column_index).column_letter
        target_letter = output_sheet.cell(1, column_index + 1).column_letter
        output_sheet.column_dimensions[target_letter].width = (
            reference_sheet.column_dimensions[source_letter].width or 13
        )
    output_sheet.row_dimensions[1].height = reference_sheet.row_dimensions[1].height

    output_book.save(OUTPUT)
    print(f"输出文件: {OUTPUT}")
    print(f"源数据行: {len(source_rows)}")
    print(f"输出数据行: {output_count}")
    print(f"删除全空行: {removed_blank_rows}")
    print(f"清除跳过单元格: {removed_skip_cells}")
    print(f"归并其他选项: {other_normalized}")


if __name__ == "__main__":
    main()
