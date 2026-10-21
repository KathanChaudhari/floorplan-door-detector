"""Check tracked Python files without installing dependencies or running models."""

import ast
from pathlib import Path
import subprocess
import sys
import tokenize


def main():
    root = Path(__file__).resolve().parents[1]
    result = subprocess.run(
        ["git", "ls-files", "-z", "--", "*.py"],
        cwd=root,
        check=True,
        capture_output=True,
    )
    paths = {root / name.decode() for name in result.stdout.split(b"\0") if name}
    paths.add(Path(__file__).resolve())
    failed = False
    for path in sorted(paths):
        try:
            with tokenize.open(path) as source:
                ast.parse(source.read(), filename=str(path))
        except (OSError, SyntaxError, UnicodeError) as error:
            print(f"FAIL {path.relative_to(root)}: {error}", file=sys.stderr)
            failed = True
    if failed:
        return 1
    print(f"Syntax check passed for {len(paths)} Python files.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
