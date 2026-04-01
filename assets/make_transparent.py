import sys
import subprocess

# Auto-install Pillow if not universally available
try:
    from PIL import Image
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image

def remove_white_bg(img_path):
    try:
        img = Image.open(img_path).convert("RGBA")
        datas = img.getdata()
        
        # We assume the background is solid and matches the top-left pixel
        # which is extremely common for solid-background logos
        bg_color = datas[0]
        
        newData = []
        for item in datas:
            # Check if pixel is within tolerance of the background color
            if abs(item[0]-bg_color[0]) < 30 and abs(item[1]-bg_color[1]) < 30 and abs(item[2]-bg_color[2]) < 30:
                # Make transparent
                newData.append((255, 255, 255, 0))
            else:
                newData.append(item)
                
        img.putdata(newData)
        img.save(img_path, "PNG")
        print("✅ Background removed successfully for: " + img_path)
    except Exception as e:
        print("❌ Error processing " + img_path + ": " + str(e))

print("Processing adaptive-icon.png...")
remove_white_bg("adaptive-icon.png")

print("Processing icon.png...")
remove_white_bg("icon.png")

print("Finished!")
