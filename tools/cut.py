from rembg import remove, new_session
from PIL import Image
im=Image.open('tools/src.jpg').convert('RGB'); print(im.size)
for m in ['isnet-anime']:
    s=new_session(m)
    out=remove(im,session=s,alpha_matting=False)
    out.save(f'tools/cut_{m}.png')
