from PIL import Image
import os

# Paths
INPUT_PATH = r"C:/Users/isaki/.gemini/antigravity/brain/cae4b57f-e806-4ddd-a2b8-e86fd0a5bb65/uploaded_image_1767183704842.jpg"
OUTPUT_DIR = r"c:/Users/isaki/Code/else/game/uma/public"

# File names map (Top-Left -> Bottom-Right)
FILENAMES = [
    "horse_admire.png",   # Admire Normal
    "horse_curren.png",   # Curren Dice
    "horse_suayashi.png", # Suayashi King
    "horse_twin.png",     # Twin Turbo
    "horse_wild.png",     # Wild Paradox
    "horse_black.png",    # Black Box
    "horse_symboli.png",  # Symboli Rule
    "horse_lucky.png"     # Lucky Count
]

def slice_image():
    try:
        img = Image.open(INPUT_PATH)
        width, height = img.size
        print(f"Loaded image: {width}x{height}")
        
        # Grid: 4 cols, 2 rows
        cell_w = width / 4
        cell_h = height / 2
        
        count = 0
        for row in range(2):
            for col in range(4):
                if count >= len(FILENAMES): break
                
                left = col * cell_w
                top = row * cell_h
                right = left + cell_w
                bottom = top + cell_h
                
                # Crop
                # We want to crop slightly to remove potential borders? 
                # For now, strict grid.
                crop = img.crop((left, top, right, bottom))
                
                # Optional: Remove bottom 15% to cut off text labels
                # The text takes up a significant chunk at the bottom.
                # Let's crop to top 85% of the cell.
                crop_w, crop_h = crop.size
                crop = crop.crop((0, 0, crop_w, crop_h * 0.85))
                
                # Save
                out_path = os.path.join(OUTPUT_DIR, FILENAMES[count])
                crop.save(out_path)
                print(f"Saved {FILENAMES[count]}")
                count += 1
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    slice_image()
