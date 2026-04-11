import html
import json
import re
from pathlib import Path
from urllib.request import Request, urlopen


NYX = 8425
SEASONS = [
    ("ÉTÉ - 2018", 13210),
    ("ÉTÉ - 2019", 14256),
    ("ÉTÉ - 2020", 15296),
    ("ÉTÉ - 2021", 15845),
    ("ÉTÉ - 2022", 16520),
    ("ÉTÉ - 2023", 17346),
    ("ÉTÉ - 2024", 17783),
    ("ÉTÉ - 2025", 18471),
]

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "backend" / "data"
OCR_DIR = Path(r"C:\Users\jp\OneDrive\Documents\Stats LHMA - ALLTime\_ocr")
OUTPUT_PATH = DATA_DIR / "historical-season-stats.json"

ROW_PATTERN = re.compile(
    r"<tr class='letr'><td class='tt12g pl10(?: btd)?' colspan='2'>"
    r"(\d+)&nbsp;&nbsp;<a href='players\.php\?nyx=8425&no=(\d+)' class='tt12b_n tooltip' title=\"(.*?)\">(.*?)</a></td>"
    r"<td class='tt12nc bl8(?: btd)?'>(.*?)</td>"
    r"<td class='tt12nc bl8(?: btd)?'>(.*?)</td>"
    r"<td class='tt12nc(?: btd)?'>(.*?)</td>"
    r"<td class='tt12nc(?: btd)? bgj'>(.*?)</td>"
    r"<td class='tt10gc(?: btd)?'>(.*?)</td>"
    r"<td class='tt12nc bl8(?: btd)?'>(.*?)</td>"
    r"<td class='tt12nc(?: btd)?'>(.*?)</td>"
    r"<td class='tt12nc(?: btd)?'>(.*?)</td></tr>",
    re.S,
)

META_PATTERN = re.compile(
    r"NO:<br />(?:É|E)?QUIPE:<br />POSITION:<br />NB SAISONS:</td>"
    r"<td[^>]*>(.*?)<br />(.*?)<br />(.*?)<br />(\d+)",
    re.S,
)


def fetch(url: str) -> str:
    req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(req, timeout=30) as response:
        raw = response.read()
    return raw.decode("latin-1", errors="ignore")


def to_int(value: str):
    value = html.unescape(value or "").strip().replace("\xa0", " ")
    if value in {"", "-"}:
        return 0
    value = re.sub(r"[^0-9-]", "", value)
    return int(value) if value else 0


def normalize_name(value: str) -> str:
    value = html.unescape(value or "")
    value = re.sub(r"\s+", " ", value).strip()
    return value.title()


def split_name(full_name: str):
    parts = normalize_name(full_name).split(" ")
    if len(parts) == 1:
        return parts[0], ""
    return " ".join(parts[:-1]), parts[-1]


def normalize_team_name(raw_team: str) -> str | None:
    if not raw_team:
        return None
    team = html.unescape(raw_team).strip().upper()
    replacements = {
        "PRÉDATEURS": "Prédateurs",
        "PRDATEURS": "Prédateurs",
        "STRARS": "Stars",
        "STARS": "Stars",
        "RANGERS": "Rangers",
        "BRUINS": "Bruins",
        "CANADIENS": "Canadiens",
        "FLYERS": "Flyers",
        "BLUES": "Blues",
    }
    for prefix, clean in replacements.items():
        if team.startswith(prefix):
            return clean
    return normalize_name(team)


def normalize_position(raw_position: str) -> str:
    pos = html.unescape(raw_position or "").strip().upper()
    if "GARD" in pos:
        return "G"
    if "D" in pos:
        return "D"
    return "A"


def parse_season_rows(season_name: str, season_id: int):
    url = f"https://www.marqueur.com/hockey/mbr/tools/hlg/statistics_02.php?nyx={NYX}&idp={season_id}&idt=1&ide=0"
    text = fetch(url)
    OCR_DIR.mkdir(parents=True, exist_ok=True)
    (OCR_DIR / f"marqueur_{season_name}.html").write_text(text, encoding="latin-1", errors="ignore")

    rows = []
    for match in ROW_PATTERN.finditer(text):
        (
            rank,
            marqueur_player_id,
            title_html,
            display_name,
            games_played,
            goals,
            assists,
            points,
            avg_points,
            pim,
            plus_minus,
            shots,
        ) = match.groups()

        meta_match = META_PATTERN.search(html.unescape(title_html))
        if meta_match:
            jersey_number, raw_team_name, raw_position, seasons_count = meta_match.groups()
        else:
            jersey_number, raw_team_name, raw_position, seasons_count = "", "", "ATTAQUANT", "0"

        first_name, last_name = split_name(display_name)
        row = {
            "first_name": first_name,
            "last_name": last_name,
            "team_name": normalize_team_name(raw_team_name),
            "position": normalize_position(raw_position),
            "games_played": to_int(games_played),
            "goals": to_int(goals),
            "assists": to_int(assists),
            "points": to_int(points),
            "pim": to_int(pim),
            "number": to_int(jersey_number),
            "marqueur_player_id": to_int(marqueur_player_id),
            "rank": to_int(rank),
            "avg_points": html.unescape(avg_points).strip(),
            "plus_minus": to_int(plus_minus),
            "shots": to_int(shots),
            "historical_seasons_count": to_int(seasons_count),
        }
        rows.append(row)

    return rows


def main():
    fixture = {}
    summary = []
    for season_name, season_id in SEASONS:
        rows = parse_season_rows(season_name, season_id)
        fixture[season_name] = rows
        summary.append({"season": season_name, "rows": len(rows)})

    OUTPUT_PATH.write_text(json.dumps(fixture, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"Fixture written to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
