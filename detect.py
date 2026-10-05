from pathlib import Path

from ultralytics import YOLO

ROOT = Path(__file__).resolve().parent

MODEL_PATH = ROOT / "models" / "architect" / "best.pt"
IMAGE_PATH = ROOT / "data" / "sample1.jpg"
OUTPUT_PATH = ROOT / "outputs" / "architect-detected.jpg"

if not MODEL_PATH.exists():
    raise FileNotFoundError(f"Model not found: {MODEL_PATH}")

if not IMAGE_PATH.exists():
    raise FileNotFoundError(f"Image not found: {IMAGE_PATH}")

model = YOLO(str(MODEL_PATH))

print("Model classes:")
for class_id, class_name in model.names.items():
    print(f"  {class_id}: {class_name}")

door_names = {
    "door",
    "single_door",
    "double_door",
    "sliding_door",
}

door_class_ids = []

for class_id, class_name in model.names.items():
    normalized_name = (
        class_name.lower()
        .replace(" ", "_")
        .replace("-", "_")
    )

    if normalized_name in door_names:
        door_class_ids.append(class_id)

print("\nDoor classes:")
for class_id in door_class_ids:
    print(f"  {class_id}: {model.names[class_id]}")

# First run every class. This tells us whether the model understands
# anything in this style of construction drawing.
result = model.predict(
    source=str(IMAGE_PATH),
    conf=0.05,
    imgsz=1280,
    device="cpu",
    verbose=True,
)[0]

door_count = 0

print(f"\nAll detections: {len(result.boxes)}")

for box in result.boxes:
    class_id = int(box.cls[0])
    confidence = float(box.conf[0])
    coordinates = [round(value, 1) for value in box.xyxy[0].tolist()]
    class_name = model.names[class_id]

    if class_id in door_class_ids:
        door_count += 1

    print(
        f"{class_name:20} "
        f"confidence={confidence:.3f} "
        f"box={coordinates}"
    )

print(f"\nDetected doors: {door_count}")

OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
result.save(filename=str(OUTPUT_PATH))

print(f"Saved image: {OUTPUT_PATH}")