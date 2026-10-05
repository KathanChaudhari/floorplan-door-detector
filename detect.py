from pathlib import Path

from ultralytics import YOLO

ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / "models" / "floorcad-yolov8n-detect.pt"
IMAGE_PATH = ROOT / "data" / "sample.png"
OUTPUT_PATH = ROOT / "outputs" / "sample-detected.jpg"

if not MODEL_PATH.exists():
    raise FileNotFoundError(f"Download the model first: {MODEL_PATH}")

if not IMAGE_PATH.exists():
    raise FileNotFoundError(f"Add your test image: {IMAGE_PATH}")

model = YOLO(str(MODEL_PATH))

# Read class IDs from the model instead of guessing their numbers.
wanted_classes = {
    "door",
    "single_door",
    "double_door",
    "sliding_door",
}

door_class_ids = [
    class_id
    for class_id, name in model.names.items()
    if name.lower().replace(" ", "_").replace("-", "_")
    in wanted_classes
]

if not door_class_ids:
    raise RuntimeError(f"No matching door classes: {model.names}")

print("Using door classes:")
for class_id in door_class_ids:
    print(f"  {class_id}: {model.names[class_id]}")

result = model.predict(
    source=str(IMAGE_PATH),
    classes=door_class_ids,
    conf=0.25,
    imgsz=640,
    device="cpu",
    verbose=False,
)[0]

OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
result.save(filename=str(OUTPUT_PATH))

print(f"\nDetected openings: {len(result.boxes)}")
print(f"Saved image: {OUTPUT_PATH}")