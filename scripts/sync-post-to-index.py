import json
import subprocess
import sys
from pathlib import Path

POSTS_DIR = Path("forum/posts")
INDEX_FILE = POSTS_DIR / "index.json"

FIELDS = [
    "title",
    "title_pt",
    "title_fr",
    "excerpt",
    "excerpt_pt",
    "excerpt_fr",
    "readTime",
    "readTime_pt",
    "readTime_fr",
    "thumbnail",
    "tags",
    "destination",
    "category",
]

post_id = sys.argv[1]

post = json.loads(
    (POSTS_DIR / f"{post_id}.json").read_text(encoding="utf-8")
)

index = json.loads(
    INDEX_FILE.read_text(encoding="utf-8")
)

entry = next(item for item in index if item["id"] == post_id)

for field in FIELDS:
    if field in post:
        entry[field] = post[field]

INDEX_FILE.write_text(
    json.dumps(index, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8"
)

subprocess.run(
    ["git", "config", "user.name", "Travel Frontiers Bot"],
    check=True
)

subprocess.run(
    ["git", "config", "user.email", "bot@travelfrontiers.pt"],
    check=True
)

subprocess.run(
    ["git", "add", "forum/posts/index.json"],
    check=True
)

subprocess.run(
    ["git", "commit", "-m", f"bot: sync index for {post_id}"],
    check=True
)

subprocess.run(["git", "push"], check=True)
