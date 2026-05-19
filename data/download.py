import argparse
import os
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path


DATA_DIR = Path(__file__).parent / "raw"
REQUIRED_FILES = ["sales_train_validation.csv", "sell_prices.csv", "calendar.csv"]
KAGGLE_COMPETITION = "m5-forecasting-accuracy"


def check_kaggle_credentials() -> bool:
    kaggle_json = Path.home() / ".kaggle" / "kaggle.json"
    if not kaggle_json.exists():
        print("ERROR: ~/.kaggle/kaggle.json not found.")
        print("To set up:")
        print("  1. Go to https://www.kaggle.com/account")
        print("  2. Click \"Create New API Token\" - downloads kaggle.json")
        print("  3. mv ~/Downloads/kaggle.json ~/.kaggle/kaggle.json")
        print("  4. chmod 600 ~/.kaggle/kaggle.json")
        return False
    return True


def check_kaggle_installed() -> bool:
    try:
        import kaggle  # noqa: F401

        return True
    except ImportError:
        print("ERROR: kaggle package not installed. Run: pip install kaggle")
        return False


def already_downloaded(data_dir: Path) -> bool:
    return all((data_dir / f).exists() for f in REQUIRED_FILES)


def download(data_dir: Path, force: bool = False) -> None:
    if already_downloaded(data_dir) and not force:
        print("M5 data already present in data/raw/. Use --force to re-download.")
        return

    data_dir.mkdir(parents=True, exist_ok=True)

    print("Downloading M5 competition data from Kaggle...")
    result = subprocess.run(
        ["kaggle", "competitions", "download", "-c", KAGGLE_COMPETITION, "-p", str(data_dir)],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print("Kaggle download failed:")
        print(result.stderr)
        print()
        print("Common fix: accept competition rules at:")
        print("  https://www.kaggle.com/competitions/m5-forecasting-accuracy/rules")
        sys.exit(1)

    zip_path = data_dir / f"{KAGGLE_COMPETITION}.zip"
    if zip_path.exists():
        print("Extracting zip...")
        with zipfile.ZipFile(zip_path, "r") as z:
            z.extractall(data_dir)
        zip_path.unlink()
        print("Zip extracted and removed.")

    missing = [f for f in REQUIRED_FILES if not (data_dir / f).exists()]
    if missing:
        print(f"WARNING: Expected files not found after extraction: {missing}")
        print("Files present:")
        for f in sorted(data_dir.iterdir()):
            print(f"  {f.name}")
        sys.exit(1)

    print("Download complete. Files in data/raw/:")
    for f in REQUIRED_FILES:
        size_mb = (data_dir / f).stat().st_size / 1024 / 1024
        print(f"  {f}: {size_mb:.1f} MB")


def validate(data_dir: Path) -> None:
    import pandas as pd

    print("Validating M5 data schema...")
    sales = pd.read_csv(data_dir / "sales_train_validation.csv", nrows=5)
    calendar = pd.read_csv(data_dir / "calendar.csv", nrows=5)
    prices = pd.read_csv(data_dir / "sell_prices.csv", nrows=5)
    assert "item_id" in sales.columns, "sales missing item_id"
    assert "store_id" in sales.columns, "sales missing store_id"
    assert "d_1" in sales.columns or any(c.startswith("d_") for c in sales.columns), "sales missing d_ columns"
    assert "date" in calendar.columns, "calendar missing date"
    assert "sell_price" in prices.columns, "prices missing sell_price"
    print("Schema OK.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download M5 Walmart dataset from Kaggle")
    parser.add_argument("--force", action="store_true", help="Re-download even if files exist")
    parser.add_argument("--validate", action="store_true", help="Validate schema after download")
    parser.add_argument("--check-only", action="store_true", help="Just check if data is present")
    args = parser.parse_args()

    if args.check_only:
        if already_downloaded(DATA_DIR):
            print("M5 data present in data/raw/.")
        else:
            print("M5 data NOT found. Run: python data/download.py")
        sys.exit(0)

    if not check_kaggle_installed() or not check_kaggle_credentials():
        sys.exit(1)

    download(DATA_DIR, force=args.force)

    if args.validate:
        validate(DATA_DIR)
