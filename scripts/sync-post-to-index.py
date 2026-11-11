import json
from pathlib import Path

POSTS_DIR = Path("forum/posts")
INDEX_FILE = POSTS_DIR / "index.json"

FIELDS = [
    "title", "title_pt", "title_fr", "excerpt", "excerpt_pt", "excerpt_fr",
    "readTime", "readTime_pt", "readTime_fr", "thumbnail", "tags",
    "destination", "category", "date", "author", "likes",
]

existing = json.loads(INDEX_FILE.read_text(encoding="utf-8"))
sources = {}
for path in sorted(POSTS_DIR.glob("*.json")):
    if path == INDEX_FILE:
        continue
    source = json.loads(path.read_text(encoding="utf-8"))
    if source.get("id", path.stem) != path.stem:
        raise ValueError(f"Post ID does not match filename: {path}")
    sources[path.stem] = source

order = [entry["id"] for entry in existing if entry["id"] in sources]
order.extend(post_id for post_id in sources if post_id not in order)
entries = {entry["id"]: entry for entry in existing}
result = []
for post_id in order:
    source = sources[post_id]
    entry = dict(entries.get(post_id, {"id": post_id}))
    for field in FIELDS:
        if field in source:
            entry[field] = source[field]
    result.append(entry)

if result != existing:
    INDEX_FILE.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
